// Copyright © 2026 ReactVision. All rights reserved.
// MIT License — see LICENSE file.

package com.viromedia.bridge.module;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.facebook.react.ReactActivity;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.PermissionListener;
import com.viro.core.ViroMediaRecorder;
import com.viro.core.ViroMediaRecorder.Error;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Screenshot and video capture shared by the navigator modules.
 *
 * What differs between them is only where the frame comes from: the AR navigator
 * copies its surface with PixelCopy, and the Quest navigator reads one eye back
 * through the renderer's {@link ViroMediaRecorder}. Everything after that — the
 * free-tier watermark, where the file goes, publishing to the gallery, the
 * permission request and the {@code {success, url, errorCode}} result — is the
 * same on both, so it lives here once.
 */
final class MediaCapture {
    /** The platform or view cannot capture at all. */
    static final int UNSUPPORTED_PLATFORM_ERROR = 6;
    /** The view can capture, but not yet: the Quest recorder needs the XR swapchains. */
    static final int NOT_READY_ERROR = 7;

    static final String SUCCESS_KEY = "success";
    static final String URL_KEY = "url";
    static final String ERROR_KEY = "errorCode";

    private static final int PERMISSION_REQ_CODE_AUDIO = 1;
    private static final int PERMISSION_REQ_CODE_STORAGE = 2;

    private final ReactApplicationContext mContext;
    // Remembers whether the in-flight video recording should also be published to
    // the device gallery. Set on startVideoRecording, consumed on stopVideoRecording
    // (the native recorder always writes to app-specific storage; gallery publishing
    // happens bridge-side once the mp4 exists).
    private volatile boolean mRecordingSaveToCameraRoll = false;

    MediaCapture(ReactApplicationContext context) {
        mContext = context;
    }

    /** The result every capture call resolves with when it did not produce a file. */
    static WritableMap failure(int errorCode) {
        WritableMap returnMap = Arguments.createMap();
        returnMap.putBoolean(SUCCESS_KEY, false);
        returnMap.putInt(ERROR_KEY, errorCode);
        returnMap.putString(URL_KEY, null);
        return returnMap;
    }

    /**
     * Starts recording into {@code recorder}. Errors, at start or during the
     * recording, reach {@code reactErrorDelegate} as a numeric code.
     */
    void startVideoRecording(final ViroMediaRecorder recorder, final String fileName,
                             final boolean saveToCameraRoll, final Callback reactErrorDelegate) {
        // Construct an error listener callback that may be triggered during recording.
        final ViroMediaRecorder.RecordingErrorListener viroErrorDelegate = new ViroMediaRecorder.RecordingErrorListener() {
            @Override
            public void onRecordingFailed(Error error) {
                reactErrorDelegate.invoke(error.toInt());
            }
        };

        // Remember the gallery preference for stopVideoRecording. The native
        // recorder always writes the mp4 to app-specific storage (no permission
        // needed, so it is always produced); gallery publishing is done
        // bridge-side once the file exists (see stopVideoRecording).
        mRecordingSaveToCameraRoll = saveToCameraRoll;

        // Free-tier recordings are watermarked. Unlike screenshots (composited
        // on a CPU bitmap here), video frames are rendered straight into the
        // encoder surface, so the mark is drawn in the native GL record pass —
        // hand the recorder the watermark bitmap + placement. Mirrors the iOS
        // free-tier gating (VRTARSceneNavigator.mm) and the Android photo path.
        if (RVStudioWatermarkState.getInstance().isFreeTier()) {
            recorder.setWatermark(buildWatermarkBitmap(), 1.0f, 0.04f);
        } else {
            recorder.clearWatermark();
        }

        // Start recording if we have the right permissions
        checkPermissionsAndRun(new PermissionListener() {
            @Override
            public boolean onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
                recorder.startRecordingAsync(fileName, false, viroErrorDelegate);
                return true;
            }
        }, true);
    }

    /** Stops the recording in {@code recorder} and resolves with its file. */
    void stopVideoRecording(final ViroMediaRecorder recorder, final Promise promise) {
        // Construct a completion delegate callback to be notified of the result of the recording.
        final ViroMediaRecorder.VideoRecordingFinishListener completionCallback =
                new ViroMediaRecorder.VideoRecordingFinishListener() {
            @Override
            public void onError(Error error) {
                promise.resolve(failure(error.toInt()));
            }

            @Override
            public void onSuccess(String url) {
                // Publish the finished mp4 into the device gallery if the caller
                // asked to save to the camera roll. Non-fatal: the recording at
                // `url` (app-specific storage) exists regardless and is returned.
                if (mRecordingSaveToCameraRoll && url != null) {
                    File mp4 = new File(url);
                    if (mp4.exists()) {
                        Uri galleryUri = publishToGallery(mp4, mp4.getName(), true);
                        if (galleryUri == null) {
                            Log.w("Viro", "Video saved locally but could not be published to the gallery");
                        }
                    }
                }
                WritableMap returnMap = Arguments.createMap();
                returnMap.putBoolean(SUCCESS_KEY, true);
                returnMap.putInt(ERROR_KEY, Error.NONE.toInt());
                returnMap.putString(URL_KEY, url);
                promise.resolve(returnMap);
            }
        };

        // Stop recording if we have the right permissions
        checkPermissionsAndRun(new PermissionListener() {
            @Override
            public boolean onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
                recorder.stopRecordingAsync(completionCallback);
                return true;
            }
        }, true);
    }

    /**
     * Watermarks (free tier), saves and resolves a captured frame. Recycles
     * {@code bitmap}.
     */
    void resolveScreenshot(Bitmap bitmap, String fileName, boolean saveToCameraRoll,
                           Promise promise) {
        // The capture doesn't include the overlay View, so burn the mark into
        // the bitmap (covers both the file and camera roll).
        Bitmap output = bitmap;
        if (RVStudioWatermarkState.getInstance().isFreeTier()) {
            output = drawWatermark(bitmap);
        }

        String filePath = saveScreenshotToFile(output, fileName, saveToCameraRoll);

        WritableMap returnMap;
        if (filePath != null) {
            returnMap = Arguments.createMap();
            returnMap.putBoolean(SUCCESS_KEY, true);
            returnMap.putInt(ERROR_KEY, Error.NONE.toInt());
            returnMap.putString(URL_KEY, filePath);
        } else {
            returnMap = failure(Error.WRITE_TO_FILE.toInt());
        }
        if (output != bitmap) {
            output.recycle();
        }
        bitmap.recycle();
        promise.resolve(returnMap);
    }

    // Composites the pill bottom-centre; returns the source unchanged if a
    // mutable copy can't be allocated.
    private Bitmap drawWatermark(Bitmap source) {
        Bitmap result = source.copy(Bitmap.Config.ARGB_8888, true);
        if (result == null) {
            return source;
        }
        Canvas canvas = new Canvas(result);
        float w = result.getWidth();
        float h = result.getHeight();

        String text = "Powered by ReactVision Studio";
        float textSize = Math.max(28f, w * 0.030f);
        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.WHITE);
        textPaint.setTextSize(textSize);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        textPaint.setTextAlign(Paint.Align.CENTER);

        Paint.FontMetrics fm = textPaint.getFontMetrics();
        float textHeight = fm.descent - fm.ascent;

        // Vertical padding scaled off the 12sp live-overlay baseline (6dp).
        float padY = textSize * (6f / 12f);
        float barH = textHeight + padY * 2;
        float margin = w * 0.04f;
        float top = h - barH - margin;

        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.argb(153, 0, 0, 0)); // ~60% black
        canvas.drawRect(0, top, w, top + barH, bgPaint);
        canvas.drawText(text, w / 2f, top + padY - fm.ascent, textPaint);

        return result;
    }

    // Builds the free-tier watermark bar as a standalone (transparent-background)
    // bitmap for the video recorder. The native GL pass scales this to the full video
    // width preserving its aspect ratio, so only the aspect matters — a fixed reference
    // width keeps the text crisp. Styling mirrors drawWatermark() (the photo path).
    private Bitmap buildWatermarkBitmap() {
        int w = 1080;
        String text = "Powered by ReactVision Studio";
        float textSize = Math.max(28f, w * 0.030f);
        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.WHITE);
        textPaint.setTextSize(textSize);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        textPaint.setTextAlign(Paint.Align.CENTER);

        Paint.FontMetrics fm = textPaint.getFontMetrics();
        float textHeight = fm.descent - fm.ascent;
        float padY = textSize * (6f / 12f);
        int barH = (int) Math.ceil(textHeight + padY * 2);

        Bitmap bmp = Bitmap.createBitmap(w, barH, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.argb(153, 0, 0, 0)); // ~60% black
        canvas.drawRect(0, 0, w, barH, bgPaint);
        canvas.drawText(text, w / 2f, padY - fm.ascent, textPaint);
        return bmp;
    }

    /**
     * Saves a bitmap to an app-specific file and, if requested, also publishes a copy
     * to the device gallery. Returns the local file path (parity with iOS, which
     * returns the temp-file path while separately saving to the photo library).
     *
     * The local write targets app-specific external storage, which needs NO runtime
     * permission on any API level, so the file is always produced. This fixes the
     * "file not generated" bug on API 29+ where the previous raw File write into the
     * public Pictures/ directory threw EACCES under scoped storage.
     */
    private String saveScreenshotToFile(Bitmap bitmap, String fileName, boolean saveToCameraRoll) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return null;
        }

        File dir = getAppMediaDir(Environment.DIRECTORY_PICTURES);
        if (dir == null) {
            Log.e("Viro", "Failed to resolve app media directory");
            return null;
        }

        File outputFile = new File(dir, fileName + ".jpg");
        BufferedOutputStream bos = null;
        try {
            bos = new BufferedOutputStream(new FileOutputStream(outputFile));
            bitmap.compress(Bitmap.CompressFormat.JPEG, 100, bos);
            bos.flush();
        } catch (IOException e) {
            Log.e("Viro", "Failed to save screenshot: " + e.getMessage());
            return null;
        } finally {
            closeQuietly(bos);
        }

        // Also publish into the device gallery when requested. Non-fatal: the
        // app-local file above already exists and is returned regardless.
        if (saveToCameraRoll) {
            Uri galleryUri = publishToGallery(outputFile, fileName + ".jpg", false);
            if (galleryUri == null) {
                Log.w("Viro", "Screenshot saved locally but could not be published to the gallery");
            }
        }

        return outputFile.getAbsolutePath();
    }

    /**
     * App-specific external media directory (falls back to internal files dir).
     * Always writable without a runtime storage permission on every API level.
     */
    private File getAppMediaDir(String subDir) {
        File dir = mContext.getExternalFilesDir(subDir);
        if (dir == null) {
            dir = mContext.getFilesDir();
        }
        if (dir != null && !dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private static String getAppName(Context context) {
        ApplicationInfo appInfo = context.getApplicationInfo();
        CharSequence appLabel = context.getPackageManager().getApplicationLabel(appInfo);
        return (appLabel != null && appLabel.length() > 0)
                ? appLabel.toString()
                : context.getPackageName();
    }

    /**
     * Publishes a media file into the device gallery in a scoped-storage-safe way.
     * On API 29+ inserts through MediaStore (no storage permission required); on
     * older API levels copies into the public collection and triggers a media scan.
     * Returns the published content Uri, or null on failure (caller treats as non-fatal).
     */
    private Uri publishToGallery(File src, String displayName, boolean isVideo) {
        try {
            ContentResolver resolver = mContext.getContentResolver();
            String appName = getAppName(mContext);
            String mime = isVideo ? "video/mp4" : "image/jpeg";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        (isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES) + "/" + appName);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri collection = isVideo
                        ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                        : MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri item = resolver.insert(collection, values);
                if (item == null) {
                    return null;
                }
                InputStream in = null;
                OutputStream out = null;
                try {
                    in = new FileInputStream(src);
                    out = resolver.openOutputStream(item);
                    copyStream(in, out);
                } finally {
                    closeQuietly(in);
                    closeQuietly(out);
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(item, values, null, null);
                return item;
            } else {
                // Legacy (API < 29): copy into the public collection (needs
                // WRITE_EXTERNAL_STORAGE, declared with maxSdkVersion="28").
                File publicDir = Environment.getExternalStoragePublicDirectory(
                        isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                File dir = new File(publicDir, appName);
                if (!dir.exists() && !dir.mkdirs()) {
                    return null;
                }
                File dst = new File(dir, displayName);
                InputStream in = null;
                OutputStream out = null;
                try {
                    in = new FileInputStream(src);
                    out = new FileOutputStream(dst);
                    copyStream(in, out);
                } finally {
                    closeQuietly(in);
                    closeQuietly(out);
                }
                Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                scan.setData(Uri.fromFile(dst));
                mContext.sendBroadcast(scan);
                return Uri.fromFile(dst);
            }
        } catch (Exception e) {
            Log.e("Viro", "Failed to publish media to gallery: " + e.getMessage());
            return null;
        }
    }

    private static void copyStream(InputStream in, OutputStream out) throws IOException {
        if (in == null || out == null) {
            throw new IOException("null stream");
        }
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }

    private static void closeQuietly(java.io.Closeable c) {
        if (c != null) {
            try {
                c.close();
            } catch (IOException e) {
                Log.e("Viro", "Failed to close stream: " + e.getMessage());
            }
        }
    }

    /**
     * Requests only the permissions actually needed:
     *  - RECORD_AUDIO for video recording (audioAndRecordingPerm == true).
     *  - WRITE_EXTERNAL_STORAGE ONLY on API < 29 (the legacy gallery-copy path).
     *    On API 29+ media writes go through app-specific storage + MediaStore,
     *    which need no runtime storage permission — requesting the (unheld,
     *    auto-denied) legacy permission there was the previous no-op/broken flow.
     * The listener is invoked once the request resolves; it is also invoked
     * immediately when nothing needs to be requested.
     */
    private void checkPermissionsAndRun(PermissionListener listener, boolean audioAndRecordingPerm) {
        Activity activity = mContext.getCurrentActivity();

        List<String> needed = new ArrayList<>();
        if (audioAndRecordingPerm && !hasPermission(mContext, Manifest.permission.RECORD_AUDIO)) {
            needed.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && !hasPermission(mContext, Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }

        if (needed.isEmpty()) {
            listener.onRequestPermissionsResult(0, new String[0], new int[0]);
            return;
        }

        if (!(activity instanceof ReactActivity)) {
            Log.e("Viro", "Error: Missing ReactActivity required for checking recording permissions!");
            // Trigger the callback so the caller can proceed / surface an error.
            listener.onRequestPermissionsResult(0, new String[0], new int[0]);
            return;
        }

        ((ReactActivity) activity).requestPermissions(
                needed.toArray(new String[0]),
                audioAndRecordingPerm ? PERMISSION_REQ_CODE_AUDIO : PERMISSION_REQ_CODE_STORAGE,
                listener);
    }

    private static boolean hasPermission(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED;
    }
}
