package com.viromedia.bridge.module;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Data;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.viromedia.bridge.R;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * PUTs a prepared scan zip to its signed Storage URL, then POSTs Studio's
 * upload/complete. WorkManager reruns it from the start after the system
 * stops it (lost network, process death), which is safe: a PUT of an object
 * that is already stored counts as uploaded, and complete is idempotent.
 */
public final class VpsScanUploadWorker extends Worker {
    private static final String CHANNEL_ID = "viro_vps_uploads";
    // WorkManager refuses output Data over 10 KB serialized, and JSON escaping can grow a
    // character to six bytes, so a body or message in the result is cut to this.
    private static final int MAX_TEXT_CHARS = 1000;
    private static final long[] COMPLETE_RETRY_DELAYS_MS = {2000, 10000};

    private volatile HttpURLConnection mConnection;

    public VpsScanUploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        JSONObject request;
        try {
            request = new JSONObject(getInputData().getString(VpsScanUpload.KEY_REQUEST));
        } catch (Exception e) {
            return Result.failure(output(result(null, false, "upload", "error", "Invalid transfer request")));
        }
        String scanId = VpsScanUpload.string(request, "scan_id");
        String putUrl = VpsScanUpload.string(request, "put_url");

        JSONObject result = putUrl != null ? put(request, scanId, putUrl) : null;
        if (result == null) result = complete(request, scanId);

        if (isStopped()) {
            // WorkManager ignores this result and runs the work again unless it was cancelled.
            return Result.retry();
        }
        VpsScanUpload.deletePreparedZip(getApplicationContext(), VpsScanUpload.string(request, "zip_path"));
        Data output = output(result);
        return result.optBoolean("success") ? Result.success(output) : Result.failure(output);
    }

    /** Pre-Android 12 runs expedited work as a foreground service, which needs this notification. */
    @NonNull
    @Override
    public ForegroundInfo getForegroundInfo() {
        Context context = getApplicationContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                    context.getString(R.string.viro_vps_uploads_channel), NotificationManager.IMPORTANCE_LOW);
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        int icon = context.getApplicationInfo().icon;
        // Android 8.0's System UI crashes on an adaptive launcher icon used as a small icon.
        if (icon == 0 || Build.VERSION.SDK_INT == Build.VERSION_CODES.O) {
            icon = android.R.drawable.stat_sys_upload;
        }
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(icon)
                .setContentTitle(context.getString(R.string.viro_vps_upload_notification))
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build();
        return new ForegroundInfo(getId().hashCode(), notification);
    }

    @Override
    public void onStopped() {
        HttpURLConnection connection = mConnection;
        if (connection != null) connection.disconnect();
    }

    /** Null once the zip is stored, by this PUT or an earlier one whose answer was lost. */
    private JSONObject put(JSONObject request, String scanId, String putUrl) {
        File zip = new File(request.optString("zip_path"));
        long bytes = request.optLong("bytes", -1);
        if (!zip.isFile()) {
            return result(scanId, false, "upload", "error", "The recording zip is missing: " + zip);
        }
        if (zip.length() != bytes) {
            return result(scanId, false, "upload", "error",
                    "The recording zip is " + zip.length() + " bytes, not " + bytes);
        }
        HttpURLConnection put = null;
        try {
            put = open(putUrl, "PUT", 120000);
            put.setRequestProperty("Content-Type", "application/zip");
            VpsScanUpload.applyHeaders(put, request.optJSONObject("put_headers"));
            // Fixed length so HttpURLConnection streams the body instead of
            // buffering all of it to compute Content-Length.
            put.setFixedLengthStreamingMode(bytes);
            byte[] buf = new byte[64 * 1024];
            try (InputStream in = new FileInputStream(zip);
                 OutputStream os = put.getOutputStream()) {
                int n;
                while ((n = in.read(buf)) != -1) os.write(buf, 0, n);
            }
            int status = put.getResponseCode();
            String body = VpsScanUpload.readResponseBody(put, status);
            if (status >= 200 && status < 300) return null;
            if (status == 409 || (status == 400 && (body.contains("Duplicate") || body.contains("already exists")))) {
                return null;
            }
            return result(scanId, false, "upload", "status", status, "body", body);
        } catch (Exception e) {
            return result(scanId, false, "upload", "error", String.valueOf(e.getMessage()));
        } finally {
            mConnection = null;
            if (put != null) put.disconnect();
        }
    }

    /** Transport errors and 5xx are retried; Studio's sweep finalizes a stored upload anyway. */
    private JSONObject complete(JSONObject request, String scanId) {
        String url = request.optString("complete_url");
        JSONObject headers = request.optJSONObject("complete_headers");
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        JSONObject last;
        for (int attempt = 0; ; attempt++) {
            HttpURLConnection post = null;
            try {
                post = open(url, "POST", 60000);
                post.setRequestProperty("Content-Type", "application/json");
                VpsScanUpload.applyHeaders(post, headers);
                post.setFixedLengthStreamingMode(body.length);
                try (OutputStream os = post.getOutputStream()) {
                    os.write(body);
                }
                int status = post.getResponseCode();
                String response = VpsScanUpload.readResponseBody(post, status);
                boolean ok = status >= 200 && status < 300;
                last = result(scanId, ok, "complete", "status", status, "body", response);
                if (status < 500) return last;
            } catch (Exception e) {
                last = result(scanId, false, "complete", "error", String.valueOf(e.getMessage()));
            } finally {
                mConnection = null;
                if (post != null) post.disconnect();
            }
            if (attempt == COMPLETE_RETRY_DELAYS_MS.length || isStopped()) return last;
            try {
                Thread.sleep(COMPLETE_RETRY_DELAYS_MS[attempt]);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return last;
            }
        }
    }

    private HttpURLConnection open(String url, String method, int readTimeoutMs) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        mConnection = connection;
        // onStopped may have run before mConnection was set, and would not have disconnected this one.
        if (isStopped()) throw new IOException("The upload was stopped");
        connection.setRequestMethod(method);
        connection.setConnectTimeout(30000);
        connection.setReadTimeout(readTimeoutMs);
        connection.setDoOutput(true);
        return connection;
    }

    private static JSONObject result(String scanId, boolean success, String stage, Object... keyValues) {
        JSONObject object = new JSONObject();
        try {
            object.put("success", success).put("stage", stage).put("scan_id", scanId);
            for (int i = 0; i + 1 < keyValues.length; i += 2) {
                Object value = keyValues[i + 1];
                if (value instanceof String && ((String) value).length() > MAX_TEXT_CHARS) {
                    value = ((String) value).substring(0, MAX_TEXT_CHARS);
                }
                object.put((String) keyValues[i], value);
            }
        } catch (JSONException e) {
            // Only thrown for non-finite doubles, which nothing here passes.
        }
        return object;
    }

    private static Data output(JSONObject result) {
        return new Data.Builder().putString(VpsScanUpload.KEY_RESULT, result.toString()).build();
    }
}
