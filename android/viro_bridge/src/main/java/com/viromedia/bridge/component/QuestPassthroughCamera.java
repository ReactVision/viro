// Copyright © 2026 ReactVision. All rights reserved.
// MIT License — see LICENSE file.

package com.viromedia.bridge.component;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.ImageFormat;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;
import android.util.Size;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Captures frames from the Meta Quest passthrough (headset) RGB camera via the
 * standard Camera2 API — Meta's "Passthrough Camera API", available on Quest 3 /
 * 3S running Horizon OS v74+. Delivers RGBA8888 frames so they can be fed into the
 * exact same YOLOE preprocessing path VRTObjectDetectorView uses for the ARCore
 * camera feed (no separate inference code).
 *
 * Requires android.permission.CAMERA + horizonos.permission.HEADSET_CAMERA, both
 * granted at runtime. On unsupported headsets / OS versions the camera simply
 * won't open and onError fires.
 */
class QuestPassthroughCamera {

    private static final String TAG = "QuestPTCamera";

    // Meta vendor characteristic that tags the passthrough cameras. Value 0 = passthrough.
    private static final String META_CAMERA_SOURCE = "com.meta.extra_metadata.camera_source";

    interface FrameListener {
        /** RGBA8888, width×height. The buffer is only valid for the call duration. */
        void onFrame(ByteBuffer rgba, int width, int height);
    }
    interface ErrorListener {
        void onError(String message);
    }

    private final Context        mContext;
    private FrameListener        mFrameListener;
    private ErrorListener        mErrorListener;

    private HandlerThread        mThread;
    private Handler              mHandler;
    private CameraDevice         mCamera;
    private CameraCaptureSession mSession;
    private ImageReader          mImageReader;
    private int                  mWidth, mHeight;

    // Reusable RGBA output buffer (sized on first frame).
    private byte[]               mRgba;

    QuestPassthroughCamera(Context context) {
        mContext = context.getApplicationContext();
    }

    void start(FrameListener frameListener, ErrorListener errorListener) {
        mFrameListener = frameListener;
        mErrorListener = errorListener;

        if (mContext.checkSelfPermission(Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            fail("CAMERA permission not granted");
            return;
        }
        // HEADSET_CAMERA is a custom Horizon OS permission; checkSelfPermission returns
        // DENIED on non-Quest devices (permission undefined), which is fine — they have
        // no passthrough camera anyway. On Quest it must be granted at runtime.
        if (mContext.checkSelfPermission("horizonos.permission.HEADSET_CAMERA")
                != PackageManager.PERMISSION_GRANTED) {
            fail("horizonos.permission.HEADSET_CAMERA not granted — request it at runtime "
                + "or `adb shell pm grant <pkg> horizonos.permission.HEADSET_CAMERA`");
            return;
        }

        mThread = new HandlerThread("QuestPTCamera");
        mThread.start();
        mHandler = new Handler(mThread.getLooper());
        mHandler.post(this::openCamera);
    }

    @SuppressWarnings("MissingPermission")  // permissions checked in start()
    private void openCamera() {
        CameraManager mgr = (CameraManager) mContext.getSystemService(Context.CAMERA_SERVICE);
        if (mgr == null) { fail("CameraManager unavailable"); return; }

        try {
            String cameraId = pickPassthroughCamera(mgr);
            if (cameraId == null) { fail("No usable passthrough/back camera found"); return; }

            CameraCharacteristics chars = mgr.getCameraCharacteristics(cameraId);
            StreamConfigurationMap map = chars.get(
                CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            Size size = pickSize(map);
            mWidth = size.getWidth();
            mHeight = size.getHeight();
            Log.i(TAG, "Opening passthrough camera " + cameraId + " @ " + mWidth + "x" + mHeight);

            mImageReader = ImageReader.newInstance(mWidth, mHeight, ImageFormat.YUV_420_888, 2);
            mImageReader.setOnImageAvailableListener(this::onImageAvailable, mHandler);

            mgr.openCamera(cameraId, new CameraDevice.StateCallback() {
                @Override public void onOpened(CameraDevice device) {
                    mCamera = device;
                    createSession();
                }
                @Override public void onDisconnected(CameraDevice device) { device.close(); mCamera = null; }
                @Override public void onError(CameraDevice device, int error) {
                    device.close(); mCamera = null;
                    fail("Camera open error " + error);
                }
            }, mHandler);
        } catch (CameraAccessException | SecurityException e) {
            fail("openCamera failed: " + e.getMessage());
        }
    }

    private void createSession() {
        try {
            List<android.view.Surface> outputs = new ArrayList<>();
            outputs.add(mImageReader.getSurface());
            mCamera.createCaptureSession(outputs, new CameraCaptureSession.StateCallback() {
                @Override public void onConfigured(CameraCaptureSession session) {
                    if (mCamera == null) return;
                    mSession = session;
                    try {
                        CaptureRequest.Builder req =
                            mCamera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                        req.addTarget(mImageReader.getSurface());
                        session.setRepeatingRequest(req.build(), null, mHandler);
                    } catch (CameraAccessException e) {
                        fail("setRepeatingRequest failed: " + e.getMessage());
                    }
                }
                @Override public void onConfigureFailed(CameraCaptureSession session) {
                    fail("Capture session configuration failed");
                }
            }, mHandler);
        } catch (CameraAccessException e) {
            fail("createCaptureSession failed: " + e.getMessage());
        }
    }

    private void onImageAvailable(ImageReader reader) {
        Image image = null;
        try {
            image = reader.acquireLatestImage();
            if (image == null || mFrameListener == null) return;
            ByteBuffer rgba = yuv420ToRgba(image);
            mFrameListener.onFrame(rgba, image.getWidth(), image.getHeight());
        } catch (Exception e) {
            Log.w(TAG, "frame convert failed", e);
        } finally {
            if (image != null) image.close();
        }
    }

    void stop() {
        if (mHandler != null) {
            mHandler.post(() -> {
                try { if (mSession != null) mSession.close(); } catch (Exception ignored) {}
                try { if (mCamera != null) mCamera.close(); } catch (Exception ignored) {}
                try { if (mImageReader != null) mImageReader.close(); } catch (Exception ignored) {}
                mSession = null; mCamera = null; mImageReader = null;
            });
        }
        if (mThread != null) {
            mThread.quitSafely();
            mThread = null;
            mHandler = null;
        }
        mFrameListener = null;
        mErrorListener = null;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    // Prefer the Meta passthrough camera (vendor metadata); else the first back-facing
    // camera; else the first camera in the list.
    private String pickPassthroughCamera(CameraManager mgr) throws CameraAccessException {
        String firstBack = null, firstAny = null;
        for (String id : mgr.getCameraIdList()) {
            if (firstAny == null) firstAny = id;
            CameraCharacteristics c = mgr.getCameraCharacteristics(id);

            // Read the Meta vendor "camera_source" tag if present (value 0 = passthrough).
            for (CameraCharacteristics.Key<?> key : c.getKeys()) {
                if (META_CAMERA_SOURCE.equals(key.getName())) {
                    Object v = c.get(key);
                    int src = (v instanceof Byte) ? ((Byte) v) & 0xFF
                            : (v instanceof byte[] && ((byte[]) v).length > 0) ? ((byte[]) v)[0] : -1;
                    if (src == 0) {
                        Log.i(TAG, "picked passthrough camera " + id + " (meta camera_source=0)");
                        return id;
                    }
                }
            }
            Integer facing = c.get(CameraCharacteristics.LENS_FACING);
            if (firstBack == null && facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) {
                firstBack = id;
            }
        }
        String chosen = (firstBack != null) ? firstBack : firstAny;
        Log.i(TAG, "no meta passthrough tag; falling back to camera " + chosen);
        return chosen;
    }

    // Smallest supported YUV size with both dims ≥ 640 (the model input) to keep the
    // per-frame CPU conversion cheap; else the largest available.
    private Size pickSize(StreamConfigurationMap map) {
        Size[] sizes = map.getOutputSizes(ImageFormat.YUV_420_888);
        Size best = null;
        for (Size s : sizes) {
            if (s.getWidth() >= 640 && s.getHeight() >= 640) {
                if (best == null || (long) s.getWidth() * s.getHeight()
                        < (long) best.getWidth() * best.getHeight()) {
                    best = s;
                }
            }
        }
        if (best != null) return best;
        return Collections.max(java.util.Arrays.asList(sizes),
            (a, b) -> Long.compare((long) a.getWidth() * a.getHeight(),
                                    (long) b.getWidth() * b.getHeight()));
    }

    // YUV_420_888 → packed RGBA8888 (R,G,B,255). Honors per-plane row/pixel strides.
    private ByteBuffer yuv420ToRgba(Image image) {
        int w = image.getWidth(), h = image.getHeight();
        if (mRgba == null || mRgba.length != w * h * 4) {
            mRgba = new byte[w * h * 4];
        }
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer yBuf = planes[0].getBuffer();
        ByteBuffer uBuf = planes[1].getBuffer();
        ByteBuffer vBuf = planes[2].getBuffer();
        int yRow = planes[0].getRowStride();
        int uRow = planes[1].getRowStride();
        int vRow = planes[2].getRowStride();
        int uPix = planes[1].getPixelStride();
        int vPix = planes[2].getPixelStride();

        byte[] out = mRgba;
        for (int row = 0; row < h; row++) {
            int yOff = row * yRow;
            int uvRow = (row >> 1);
            int uOff = uvRow * uRow;
            int vOff = uvRow * vRow;
            for (int col = 0; col < w; col++) {
                int y = (yBuf.get(yOff + col) & 0xFF);
                int uvCol = (col >> 1);
                int u = (uBuf.get(uOff + uvCol * uPix) & 0xFF) - 128;
                int v = (vBuf.get(vOff + uvCol * vPix) & 0xFF) - 128;

                int r = y + ((1402 * v) >> 10);
                int g = y - ((352 * u + 731 * v) >> 10);
                int b = y + ((1774 * u) >> 10);

                int o = (row * w + col) * 4;
                out[o]     = (byte) (r < 0 ? 0 : r > 255 ? 255 : r);
                out[o + 1] = (byte) (g < 0 ? 0 : g > 255 ? 255 : g);
                out[o + 2] = (byte) (b < 0 ? 0 : b > 255 ? 255 : b);
                out[o + 3] = (byte) 255;
            }
        }
        return ByteBuffer.wrap(out);
    }

    private void fail(String msg) {
        Log.e(TAG, msg);
        if (mErrorListener != null) mErrorListener.onError(msg);
    }
}
