package com.viromedia.bridge.module;

import android.content.Context;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.Observer;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.UiThreadUtil;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.UUID;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

final class VpsScanUpload {
    static final String KEY_REQUEST = "request";
    static final String KEY_RESULT = "result";

    /** The two files of a ViroReact AR recording, in the order they go in the zip. */
    private static final String[] RECORDING_FILES = {"session.jsonl", "video.mp4"};
    private static final String UPLOADS_DIR = "viro-vps-uploads";
    private static final long ZIP_MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000;
    private static final String WORK_NAME_PREFIX = "viro-vps-upload-";
    // Lets a call refused as a duplicate tell whether its zip is the one the running work reads.
    private static final String ZIP_TAG_PREFIX = "viro-vps-upload-zip:";

    private VpsScanUpload() {}

    static String prepare(Context context, String recordingDir) {
        if (recordingDir == null) return zipFailure("Missing recording directory");
        File dir = new File(recordingDir);
        for (String name : RECORDING_FILES) {
            File f = new File(dir, name);
            if (!f.isFile()) return zipFailure(name + " is missing from " + recordingDir);
            if (!f.canRead()) return zipFailure(name + " is not readable");
        }

        File uploads = uploadsDir(context);
        if (!uploads.isDirectory() && !uploads.mkdirs()) return zipFailure("Could not create " + uploads);
        deleteOldZips(uploads);

        File zip = new File(uploads, UUID.randomUUID() + ".zip");
        try {
            writeZip(zip, dir);
        } catch (IOException e) {
            zip.delete();
            return zipFailure(String.valueOf(e.getMessage()));
        }
        return json("success", true, "path", zip.getAbsolutePath(), "bytes", zip.length());
    }

    /** Blocks on WorkManager's database, so call it off the main thread. */
    static void transfer(Context context, String requestJson, final Promise promise) {
        final Context appContext = context.getApplicationContext();
        JSONObject request;
        try {
            request = new JSONObject(requestJson);
        } catch (Exception e) {
            promise.resolve(json("success", false, "stage", "upload", "error", "Invalid transfer request"));
            return;
        }
        final String scanId = string(request, "scan_id");
        final String zipPath = string(request, "zip_path");
        String putUrl = string(request, "put_url");
        String problem = null;
        if (scanId == null || scanId.isEmpty() || string(request, "complete_url") == null) {
            problem = "Missing scan_id or complete_url";
        } else if (putUrl != null && (zipPath == null || request.optLong("bytes", 0) <= 0)) {
            problem = "Missing zip_path or bytes";
        }
        if (problem != null) {
            deletePreparedZip(appContext, zipPath);
            promise.resolve(json("success", false, "stage", "upload", "scan_id", scanId, "error", problem));
            return;
        }

        String zipTag = ZIP_TAG_PREFIX + zipPath;
        final OneTimeWorkRequest work;
        final WorkManager workManager;
        try {
            work = new OneTimeWorkRequest.Builder(VpsScanUploadWorker.class)
                    .setInputData(new Data.Builder().putString(KEY_REQUEST, requestJson).build())
                    .setConstraints(new Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .addTag(zipTag)
                    .build();
            workManager = WorkManager.getInstance(appContext);
            String name = WORK_NAME_PREFIX + scanId;
            workManager.enqueueUniqueWork(name, ExistingWorkPolicy.KEEP, work).getResult().get();
            // KEEP drops the new request without saying so while an unfinished one holds the name.
            boolean kept = false;
            boolean zipInUse = false;
            for (WorkInfo info : workManager.getWorkInfosForUniqueWork(name).get()) {
                if (info.getId().equals(work.getId())) {
                    kept = true;
                } else if (!info.getState().isFinished() && info.getTags().contains(zipTag)) {
                    zipInUse = true;
                }
            }
            if (!kept) {
                if (!zipInUse) deletePreparedZip(appContext, zipPath);
                promise.resolve(json("success", false, "stage", "upload", "scan_id", scanId,
                        "code", "UPLOAD_IN_PROGRESS", "error", "An upload of this scan is already running"));
                return;
            }
        } catch (Exception e) {
            deletePreparedZip(appContext, zipPath);
            promise.resolve(json("success", false, "stage", "upload", "scan_id", scanId,
                    "error", String.valueOf(e.getMessage())));
            return;
        }

        final UUID workId = work.getId();
        UiThreadUtil.runOnUiThread(() -> {
            final LiveData<WorkInfo> live = workManager.getWorkInfoByIdLiveData(workId);
            live.observeForever(new Observer<WorkInfo>() {
                @Override
                public void onChanged(WorkInfo info) {
                    if (info != null && !info.getState().isFinished()) return;
                    live.removeObserver(this);
                    String result = info != null ? info.getOutputData().getString(KEY_RESULT) : null;
                    if (result == null) {
                        // Cancelled, or the worker threw: either way it left the zip behind.
                        deletePreparedZip(appContext, zipPath);
                        Object state = info != null ? info.getState() : "removed";
                        result = json("success", false, "stage", "upload", "scan_id", scanId,
                                "error", "The upload ended without a result (" + state + ")");
                    }
                    promise.resolve(result);
                }
            });
        });
    }

    static File uploadsDir(Context context) {
        return new File(context.getFilesDir(), UPLOADS_DIR);
    }

    /** The path comes from JS, so nothing outside the uploads directory is ever deleted. */
    static void deletePreparedZip(Context context, String path) {
        if (path == null || path.isEmpty()) return;
        try {
            File zip = new File(path).getCanonicalFile();
            if (uploadsDir(context).getCanonicalFile().equals(zip.getParentFile())) zip.delete();
        } catch (IOException ignored) {
        }
    }

    /** The value at {@code key}, or null when it is missing or JSON null (optString answers "null"). */
    static String string(JSONObject object, String key) {
        return object.isNull(key) ? null : object.optString(key);
    }

    /** A JSON object string from key/value pairs; values are escaped by JSONObject. */
    static String json(Object... keyValues) {
        JSONObject object = new JSONObject();
        try {
            for (int i = 0; i + 1 < keyValues.length; i += 2) {
                object.put((String) keyValues[i], keyValues[i + 1]);
            }
        } catch (JSONException e) {
            // Only thrown for non-finite doubles, which nothing here passes.
        }
        return object.toString();
    }

    static void applyHeaders(HttpURLConnection connection, JSONObject headers) {
        if (headers == null) return;
        Iterator<String> keys = headers.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = headers.opt(key);
            if (value instanceof String) connection.setRequestProperty(key, (String) value);
        }
    }

    static String readResponseBody(HttpURLConnection connection, int status) {
        InputStream in = null;
        try {
            in = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (in == null) return "";
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        } finally {
            if (in != null) {
                try { in.close(); } catch (IOException ignored) { }
            }
        }
    }

    private static String zipFailure(String error) {
        return json("success", false, "stage", "zip", "error", error);
    }

    private static void deleteOldZips(File uploads) {
        File[] zips = uploads.listFiles((d, name) -> name.endsWith(".zip"));
        if (zips == null) return;
        long cutoff = System.currentTimeMillis() - ZIP_MAX_AGE_MS;
        for (File zip : zips) {
            if (zip.lastModified() < cutoff) zip.delete();
        }
    }

    /**
     * Streams each file through a fixed buffer. video.mp4 is already
     * compressed, so it goes in with compression level 0; session.jsonl is
     * text and deflates well.
     */
    private static void writeZip(File zip, File dir) throws IOException {
        byte[] buf = new byte[64 * 1024];
        try (ZipOutputStream zos = new ZipOutputStream(
                new BufferedOutputStream(new FileOutputStream(zip), 64 * 1024))) {
            for (String name : RECORDING_FILES) {
                File f = new File(dir, name);
                zos.setLevel(name.endsWith(".mp4") ? Deflater.NO_COMPRESSION : Deflater.DEFAULT_COMPRESSION);
                ZipEntry entry = new ZipEntry(name);
                entry.setTime(f.lastModified());
                zos.putNextEntry(entry);
                try (InputStream in = new FileInputStream(f)) {
                    int n;
                    while ((n = in.read(buf)) != -1) zos.write(buf, 0, n);
                }
                zos.closeEntry();
            }
        }
    }
}
