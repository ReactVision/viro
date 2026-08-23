//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.

package com.viromedia.bridge.component;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.viromedia.bridge.utility.ViroEvents;
import com.viromedia.bridge.utility.ViroEventEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Zero-size view that taps the enclosing ViroViewARCore's camera feed, throttles
 * frame delivery to maxFPS, runs YOLOE inference via the registered provider on a
 * background thread, and emits detection results to JS via ViroEventEmitter. It
 * renders nothing of its own — the AR scene navigator owns the camera preview.
 *
 * The detector works only in AR: it must be mounted as a child or sibling of a
 * <ViroARSceneNavigator>, whose ViroViewARCore it attaches a camera-image listener to.
 *
 * Props (set by VRTObjectDetectorViewManager via @ReactProp):
 *   model               — ONNX model path or asset name (without extension)
 *   mode                — "prompt-free" | "text" | "visual"
 *   categories          — String[] for text mode
 *   confidenceThreshold — float [0,1], default 0.4
 *   iouThreshold        — float [0,1], default 0.45
 *   maxFPS              — int, default 15
 */
public class VRTObjectDetectorView extends FrameLayout {

    private static final String TAG = "VRTObjectDetector";

    // -------------------------------------------------------------------------
    // Pluggable inference provider (installed by react-viro-onnx)
    // -------------------------------------------------------------------------

    public interface InferenceProvider {
        /**
         * Run inference on a preprocessed Float32 NCHW buffer.
         *
         * @param modelPath     absolute path to the .onnx model
         * @param nchwData      float[] of shape [1, 3, inputSize, inputSize], normalized [0,1]
         * @param inputSize     width == height of the square input (e.g. 640)
         * @param confThreshold minimum confidence to emit a detection
         * @return list of detection maps: {label, confidence, boundingBox:{x,y,width,height}}
         */
        List<java.util.Map<String, Object>> infer(
            String modelPath, float[] nchwData, int inputSize, float confThreshold);
    }

    private static InferenceProvider sInferenceProvider = null;

    /** Called by react-viro-onnx at install time. */
    public static void registerInferenceProvider(InferenceProvider provider) {
        sInferenceProvider = provider;
    }

    private static final int   DEFAULT_MAX_FPS    = 15;
    private static final int   DEFAULT_MAX_DETS   = 20;
    private static final float DEFAULT_CONFIDENCE = 0.4f;
    private static final float DEFAULT_IOU        = 0.45f;
    private static final int   MODEL_INPUT_SIZE   = 640;
    // Verbose per-frame / per-detection logging. Keep false in shipping builds — the
    // screen-box log alone fires up to maxDetections × maxFPS times per second.
    private static final boolean DEBUG = false;

    // --- Props ---
    private String       mModel               = "yoloe-26s";
    private String       mMode                = "prompt-free";
    private List<String> mCategories          = new ArrayList<>();
    private float        mConfidenceThreshold = DEFAULT_CONFIDENCE;
    private float        mIouThreshold        = DEFAULT_IOU;
    private int          mMaxFPS              = DEFAULT_MAX_FPS;
    private int          mMaxDetections       = DEFAULT_MAX_DETS;
    private boolean      mProjectToWorld      = true;

    // --- State ---
    private boolean      mModelLoaded   = false;
    private boolean      mReadyFired    = false;
    private boolean      mSessionStarted = false;

    // Source camera-image dimensions of the last processed frame (for screen mapping). This is the
    // FULL rotated frame (uncropped); the viewport crop rect below maps it onto the view.
    private int          mLastSrcW = 0;
    private int          mLastSrcH = 0;
    // Viewport crop rect (px, in the full frame's space): the region the AR background shows on
    // screen. Android analog of iOS displayTransform. Set per frame in onARCameraImage.
    private int          mCropL = 0, mCropT = 0, mCropW = 0, mCropH = 0;

    // --- AR session mode (shares the enclosing ViroViewARCore's camera feed) ---
    private com.viro.core.ViroViewARCore mViroView   = null;
    private boolean      mArListenerActive = false;
    private int          mArRetryCount     = 0;

    // --- Quest mode: no ARCore camera, so capture from the Meta Passthrough Camera
    // API and feed the same pipeline. Non-null only while running on Quest. ---
    private QuestPassthroughCamera mQuestCamera = null;
    // The <ViroARSceneNavigator> mounts asynchronously and is usually a SIBLING of this
    // view, so the first lookups can miss it. Retry ~3s (30 × 100ms) before erroring.
    private static final int MAX_AR_RETRIES = 30;
    private final java.util.concurrent.atomic.AtomicBoolean mArBusy =
        new java.util.concurrent.atomic.AtomicBoolean(false);

    // Background thread for preprocessing + inference (the AR feed arrives on the render thread).
    private ExecutorService       mCameraExecutor;
    private long                  mLastInferenceMs = 0;

    // Reused across frames to keep the hot path allocation-free. Only ever touched within a
    // single inference cycle: the mArBusy guard blocks a new frame from writing these while
    // inference is still reading them, so no extra synchronization is needed.
    private Bitmap                mFrameBitmap;   // matches the delivered frame size
    private Bitmap                mScaledBitmap;  // 640x640 model input
    private android.graphics.Canvas mScaleCanvas;
    private final android.graphics.Rect  mSrcRect = new android.graphics.Rect();
    private final android.graphics.Rect  mDstRect =
        new android.graphics.Rect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    private final android.graphics.Paint mScalePaint =
        new android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG);
    private int[]                 mPixels;        // int[640*640], reused
    private float[]               mNchw;          // float[3*640*640], reused

    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    public VRTObjectDetectorView(Context context) {
        super(context);
        mCameraExecutor = Executors.newSingleThreadExecutor();
    }

    // -------------------------------------------------------------------------
    // Prop setters
    // -------------------------------------------------------------------------

    public void setModel(String model) {
        mModel = model;
        mModelLoaded = false;
        restartIfRunning();
    }

    public void setMode(String mode) {
        mMode = mode;
        restartIfRunning();
    }

    public void setCategories(ReadableArray categories) {
        mCategories = new ArrayList<>();
        for (int i = 0; i < categories.size(); i++) {
            mCategories.add(categories.getString(i));
        }
    }

    public void setConfidenceThreshold(float threshold) {
        mConfidenceThreshold = threshold;
    }

    public void setIouThreshold(float threshold) {
        mIouThreshold = threshold;
    }

    public void setMaxFPS(int maxFPS) {
        mMaxFPS = maxFPS;
    }

    public void setMaxDetections(int maxDetections) {
        mMaxDetections = maxDetections;
    }

    public void setProjectToWorld(boolean projectToWorld) {
        mProjectToWorld = projectToWorld;
    }

    // -------------------------------------------------------------------------
    // View lifecycle
    // -------------------------------------------------------------------------

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        startSession();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        stopSession();
    }

    // -------------------------------------------------------------------------
    // Session management
    // -------------------------------------------------------------------------

    private void startSession() {
        if (mSessionStarted) return;
        mSessionStarted = true;
        mArRetryCount = 0;

        mCameraExecutor.execute(() -> {
            // The inference provider (react-viro-onnx) owns model loading + inference; it
            // resolves models/<name>.onnx from assets itself. There is no built-in ORT
            // fallback — without the provider the detector does nothing (mirrors iOS).
            if (sInferenceProvider == null) {
                emitError("No ONNX inference provider registered — install "
                    + "@reactvision/react-viro-onnx.");
                return;
            }
            mModelLoaded = true;
            mMainHandler.post(this::startARMode);
        });
    }

    // -------------------------------------------------------------------------
    // AR session mode — tap the enclosing ViroViewARCore's camera feed instead of
    // opening our own CameraX session (no duplicate camera).
    // -------------------------------------------------------------------------

    private void startARMode() {
        // May have been torn down while a retry was pending.
        if (!mSessionStarted) return;

        com.viro.core.ViroViewARCore arView = findARView();
        if (arView != null) {
            mViroView = arView;
            arView.setCameraImageListener(arView.getViroContext(), this::onARCameraImage);
            mArListenerActive = true;
            Log.i(TAG, "AR mode active: listener attached to ViroViewARCore "
                + arView.getWidth() + "x" + arView.getHeight()
                + " (provider=" + (sInferenceProvider != null) + ", model=" + mModel + ")");
            if (!mReadyFired) {
                mReadyFired = true;
                emitReady();
            }
            return;
        }

        // No ARCore view. On a Quest headset there's no ARCore camera and the
        // passthrough layer isn't app-readable, so capture from the Meta Passthrough
        // Camera API instead. The detector is a plain RN view (the camera is
        // independent of the renderer), so detect Quest by device, not the view tree.
        if (isQuestDevice()) {
            startQuestCamera();
            return;
        }

        if (mArRetryCount++ < MAX_AR_RETRIES) {
            mMainHandler.postDelayed(this::startARMode, 100);
            return;
        }
        emitError("No <ViroARSceneNavigator> found and not running on a Quest headset.");
    }

    // Quest: capture from the headset camera (Camera2 / Passthrough Camera API) and
    // feed each RGBA frame into the SAME pipeline as the ARCore listener — full-frame
    // crop, no AR viewport, no intrinsics. addScreenBox no-ops (mViroView == null) so
    // detections carry labels + normalized boundingBox (no screenBoundingBox in v1).
    private void startQuestCamera() {
        if (mQuestCamera != null) return;
        mQuestCamera = new QuestPassthroughCamera(getContext());
        mQuestCamera.start(
            (rgba, w, h) -> onARCameraImage(rgba, w, h, null, 0, 0, w, h),
            this::emitError);
        Log.i(TAG, "Quest passthrough-camera mode active (provider="
            + (sInferenceProvider != null) + ", model=" + mModel + ")");
        if (!mReadyFired) {
            mReadyFired = true;
            emitReady();
        }
    }

    private void stopQuestCamera() {
        if (mQuestCamera != null) {
            mQuestCamera.stop();
            mQuestCamera = null;
        }
    }

    // Quest headsets report MANUFACTURER "Oculus" (older OS) or "Meta" (newer).
    private static boolean isQuestDevice() {
        String m = android.os.Build.MANUFACTURER;
        return m != null && (m.equalsIgnoreCase("Oculus") || m.equalsIgnoreCase("Meta"));
    }

    private void stopARMode() {
        if (mViroView != null && mArListenerActive) {
            // Teardown race: when the AR scene unmounts (or the app is backgrounded), the
            // ViroContext/renderer can be disposed before this detach runs (it's posted to the
            // main Handler). Passing a freed native context ref to nativeSetCameraImageListener
            // crashes natively (SIGSEGV, not catchable by try/catch). A disposed context has
            // nativeRef == 0 — skip the native call in that case.
            com.viro.core.ViroContext ctx = mViroView.getViroContext();
            if (ctx != null && ctx.getNativeRef() != 0) {
                try { mViroView.setCameraImageListener(ctx, null); }
                catch (Exception ignored) {}
            }
        }
        mArListenerActive = false;
        mViroView = null;
    }

    // Find the enclosing AR scene navigator's ViroViewARCore. The detector is typically a
    // SIBLING of <ViroARSceneNavigator> (the navigator only hosts AR scenes, so it can
    // never be an ancestor), so search the whole attached view tree — not just ancestors.
    private com.viro.core.ViroViewARCore findARView() {
        View root = getRootView();
        if (root instanceof ViewGroup) {
            return searchForARView((ViewGroup) root);
        }
        return null;
    }

    private com.viro.core.ViroViewARCore searchForARView(ViewGroup group) {
        for (int i = 0; i < group.getChildCount(); i++) {
            View child = group.getChildAt(i);
            if (child instanceof VRTARSceneNavigator) {
                com.viro.core.ViroViewARCore v = ((VRTARSceneNavigator) child).getARView();
                if (v != null) return v;
            }
            if (child instanceof com.viro.core.ViroViewARCore) {
                return (com.viro.core.ViroViewARCore) child;
            }
            if (child instanceof ViewGroup) {
                com.viro.core.ViroViewARCore v = searchForARView((ViewGroup) child);
                if (v != null) return v;
            }
        }
        return null;
    }

    // Called on the render thread each AR frame with the RGBA8888 camera image.
    private void onARCameraImage(java.nio.ByteBuffer buffer, int width, int height,
                                 com.viro.core.CameraIntrinsics intrinsics,
                                 int cropLeft, int cropTop, int cropWidth, int cropHeight) {
        if (!mModelLoaded || buffer == null) return;

        long now = System.currentTimeMillis();
        long minIntervalMs = 1000L / (mMaxFPS > 0 ? mMaxFPS : DEFAULT_MAX_FPS);
        if ((now - mLastInferenceMs) < minIntervalMs) return;
        mLastInferenceMs = now;

        // Skip if a previous inference is still in flight. The guard also guarantees the
        // reusable bitmap below is only written here when no inference thread is reading it
        // (the buffer is recycled by the caller next frame, so we must copy it now).
        if (!mArBusy.compareAndSet(false, true)) return;

        try {
            if (mFrameBitmap == null
                || mFrameBitmap.getWidth() != width || mFrameBitmap.getHeight() != height) {
                if (mFrameBitmap != null) mFrameBitmap.recycle();
                mFrameBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            }
            buffer.rewind();
            mFrameBitmap.copyPixelsFromBuffer(buffer);
        } catch (Exception e) {
            Log.w(TAG, "AR frame copy failed", e);
            mArBusy.set(false);
            return;
        }
        mLastSrcW = width;
        mLastSrcH = height;
        mCropL = cropLeft; mCropT = cropTop; mCropW = cropWidth; mCropH = cropHeight;

        mCameraExecutor.execute(() -> {
            try {
                float[] nchw = preprocessFrame();
                List<WritableMap> dets = runInference(nchw);
                emitDetections(dets);
            } catch (Exception e) {
                Log.e(TAG, "AR inference failed", e);
            } finally {
                mArBusy.set(false);
            }
        });
    }

    private void stopSession() {
        if (!mSessionStarted) return;
        mSessionStarted = false;
        mModelLoaded    = false;
        mReadyFired     = false;

        if (mArListenerActive) {
            mMainHandler.post(this::stopARMode);
        }
        stopQuestCamera();
    }

    private void restartIfRunning() {
        if (!mSessionStarted) return;
        stopSession();
        startSession();
    }

    // -------------------------------------------------------------------------
    // Preprocessing
    // -------------------------------------------------------------------------

    // Center-square crop → scale to 640 → Float32 NCHW [1,3,640,640], normalized [0,1].
    //
    // Crops the central side×side region (side = min(w,h)) instead of stretching the
    // whole frame: a wide camera frame squished to a square shrinks objects ~2x and the
    // detector stops recognising them. Cropping keeps objects large and undistorted.
    // The crop+downscale is a single filtered Canvas blit into a reused 640x640 bitmap
    // (no intermediate bitmaps), and the pixel/NCHW buffers are reused across frames, so
    // the per-frame allocation is zero in steady state. The screen-coordinate mapping
    // (see addScreenBox) inverts this crop. Mirrors iOS.
    private float[] preprocessFrame() {
        final int width  = mFrameBitmap.getWidth();
        final int height = mFrameBitmap.getHeight();
        final int side   = Math.min(width, height);
        final int cropX  = (width  - side) / 2;
        final int cropY  = (height - side) / 2;

        if (mScaledBitmap == null) {
            mScaledBitmap = Bitmap.createBitmap(
                MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, Bitmap.Config.ARGB_8888);
            mScaleCanvas = new android.graphics.Canvas(mScaledBitmap);
        }
        // Center-square crop + downscale to 640 in one bilinear blit.
        mSrcRect.set(cropX, cropY, cropX + side, cropY + side);
        mScaleCanvas.drawBitmap(mFrameBitmap, mSrcRect, mDstRect, mScalePaint);

        final int pixelCount = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
        if (mPixels == null) mPixels = new int[pixelCount];
        if (mNchw == null)   mNchw   = new float[3 * pixelCount];
        mScaledBitmap.getPixels(mPixels, 0, MODEL_INPUT_SIZE, 0, 0,
            MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

        final int[] pixels = mPixels;
        final float[] nchw = mNchw;
        for (int i = 0; i < pixelCount; i++) {
            int px = pixels[i];
            nchw[i]                  = ((px >> 16) & 0xFF) / 255.0f; // R
            nchw[pixelCount + i]     = ((px >>  8) & 0xFF) / 255.0f; // G
            nchw[2 * pixelCount + i] = ( px        & 0xFF) / 255.0f; // B
        }
        return nchw;
    }

    // -------------------------------------------------------------------------
    // Inference — delegated entirely to the registered provider (react-viro-onnx).
    // No built-in ONNX Runtime fallback: without a provider the detector emits nothing.
    // -------------------------------------------------------------------------

    private List<WritableMap> runInference(float[] nchwData) {
        List<WritableMap> results = new ArrayList<>();
        if (nchwData == null || sInferenceProvider == null) return results;

        String modelPath = mModel.startsWith("/") || mModel.startsWith("file://")
            ? mModel.replace("file://", "")
            : mModel;
        List<java.util.Map<String, Object>> dets =
            sInferenceProvider.infer(modelPath, nchwData, MODEL_INPUT_SIZE, mConfidenceThreshold);
        for (java.util.Map<String, Object> d : dets) {
            String label = (String) d.get("label");
            if (!matchesCategories(label)) continue;
            WritableMap det = Arguments.createMap();
            det.putString("label", label);
            det.putDouble("confidence", ((Number) d.get("confidence")).doubleValue());
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> bb = (java.util.Map<String, Object>) d.get("boundingBox");
            double nx = ((Number) bb.get("x")).doubleValue();
            double ny = ((Number) bb.get("y")).doubleValue();
            double nw = ((Number) bb.get("width")).doubleValue();
            double nh = ((Number) bb.get("height")).doubleValue();
            WritableMap bbox = Arguments.createMap();
            bbox.putDouble("x", nx); bbox.putDouble("y", ny);
            bbox.putDouble("width", nw); bbox.putDouble("height", nh);
            det.putMap("boundingBox", bbox);
            addScreenBox(det, label, nx, ny, nw, nh);
            results.add(det);
        }
        return capToMax(results);
    }

    // -------------------------------------------------------------------------
    // Screen-coordinate mapping (AR mode)
    // -------------------------------------------------------------------------

    // Adds screenBoundingBox (pixels) by inverting the center-square crop back to the
    // delivered camera frame, then stretching that frame directly onto the AR view. The
    // delivered frame is already the exact on-screen region (native cropImage matched it
    // to the ARCore background texcoords + viewport), so the renderer stretches it to fill
    // the view and we map with the same plain stretch.
    private void addScreenBox(WritableMap det, String label, double nx, double ny, double nw, double nh) {
        if (mViroView == null || mLastSrcW <= 0 || mLastSrcH <= 0) return;
        int viewW = mViroView.getWidth();
        int viewH = mViroView.getHeight();
        if (viewW <= 0 || viewH <= 0) return;

        // 1. crop-normalized → FULL-frame pixels. The model input is the center-square crop of the
        //    full (uncropped) frame (see preprocessFrame, side=min(w,h)), so invert that crop.
        double side = Math.min(mLastSrcW, mLastSrcH);
        double cropX0 = (mLastSrcW - side) / 2.0;
        double cropY0 = (mLastSrcH - side) / 2.0;
        double fx = cropX0 + nx * side;
        double fy = cropY0 + ny * side;
        double fw = nw * side;
        double fh = nh * side;

        // 2. full-frame pixels → view pixels through the on-screen region (the viewport crop rect).
        //    The native rect includes an extra "viewport excess" crop (left over from the old
        //    cropImage path) that over-trims the axis whose aspect differs from the view — that made
        //    the horizontal scale (1080/594) larger than the vertical (2400/1920), so boxes came out
        //    too wide and positions drifted outward from the anchor. The region the GL background
        //    actually shows is the texcoord region BEFORE that excess; re-add it. The excess is
        //    deterministic from the rotated-frame dims vs the view (cover-fit), matching native.
        double cl, ct, cw, ch;
        if (mCropW > 0 && mCropH > 0) {
            double scaleX = (double) viewW / mLastSrcW;
            double scaleY = (double) viewH / mLastSrcH;
            double cover  = Math.max(scaleX, scaleY);
            double excessX = mLastSrcW * (cover / scaleX - 1.0);
            double excessY = mLastSrcH * (cover / scaleY - 1.0);
            cl = mCropL - excessX / 2.0;
            ct = mCropT - excessY / 2.0;
            cw = mCropW + excessX;
            ch = mCropH + excessY;
        } else {
            cl = 0; ct = 0; cw = mLastSrcW; ch = mLastSrcH;
        }
        double sx = (fx - cl) / cw * viewW;
        double sy = (fy - ct) / ch * viewH;
        double sw = fw / cw * viewW;
        double sh = fh / ch * viewH;

        // React Native lays out the overlay in density-independent pixels (dp), and iOS already
        // emits points (dp-equivalent, via ARKit's point-based viewport). But viewW/viewH and thus
        // sx/sy above are PHYSICAL pixels (mViroView.getWidth()). Convert to dp so the boxes line up
        // with the camera preview and match iOS — without this, px coords (0..2400) are read as dp
        // on a ~384×853 dp screen and almost everything renders off-screen.
        float density = getResources().getDisplayMetrics().density;
        if (density <= 0f) density = 1f;
        double dx = sx / density, dy = sy / density, dw = sw / density, dh = sh / density;

        // Diagnostic: compare dp=[x,y,w,h] against where the object actually sits on the dp screen.
        if (DEBUG) {
            Log.i(TAG, String.format(java.util.Locale.US,
                "BOX %s norm=[%.3f,%.3f,%.3f,%.3f] src=%dx%d crop=[%d,%d,%d,%d] view=%dx%d dens=%.2f dp=[%.0f,%.0f,%.0f,%.0f]",
                label, nx, ny, nw, nh, mLastSrcW, mLastSrcH, mCropL, mCropT, mCropW, mCropH,
                viewW, viewH, density, dx, dy, dw, dh));
        }

        WritableMap sb = Arguments.createMap();
        sb.putDouble("x",      dx);
        sb.putDouble("y",      dy);
        sb.putDouble("width",  dw);
        sb.putDouble("height", dh);
        det.putMap("screenBoundingBox", sb);
    }

    // -------------------------------------------------------------------------
    // Post-processing: text-mode category filter + maxDetections cap
    // -------------------------------------------------------------------------

    // When mode="text", keep only detections whose label shares a whole word with a
    // requested category (case-insensitive): "cup" ↔ "coffee cup", "phone" ↔ "cell
    // phone", but NOT "pen" ↔ "pencil". No-op in prompt-free mode. Mirrors iOS.
    private boolean matchesCategories(String label) {
        if (!"text".equals(mMode) || mCategories.isEmpty() || label == null) return true;
        java.util.Set<String> wanted = new java.util.HashSet<>();
        for (String cat : mCategories) {
            for (String w : cat.toLowerCase().split("\\s+")) {
                if (!w.isEmpty()) wanted.add(w);
            }
        }
        for (String w : label.toLowerCase().split("\\s+")) {
            if (!w.isEmpty() && wanted.contains(w)) return true;
        }
        return false;
    }

    // Keep the first mMaxDetections entries (provider returns them confidence-sorted).
    private List<WritableMap> capToMax(List<WritableMap> results) {
        if (mMaxDetections > 0 && results.size() > mMaxDetections) {
            return new ArrayList<>(results.subList(0, mMaxDetections));
        }
        return results;
    }

    // -------------------------------------------------------------------------
    // Event emission helpers
    // -------------------------------------------------------------------------

    private void emitDetections(List<WritableMap> detections) {
        WritableArray array = Arguments.createArray();
        for (WritableMap d : detections) {
            array.pushMap(d);
        }
        WritableMap event = Arguments.createMap();
        event.putArray("detections", array);
        emitEvent(ViroEvents.ON_DETECTION, event);
    }

    private void emitReady() {
        emitEvent(ViroEvents.ON_DETECTOR_READY, Arguments.createMap());
    }

    private void emitError(String message) {
        WritableMap event = Arguments.createMap();
        event.putString("error", message);
        emitEvent(ViroEvents.ON_DETECTOR_ERROR, event);
    }

    private void emitEvent(final String eventName, final WritableMap eventData) {
        final int viewId = getId();
        mMainHandler.post(() -> {
            // ViroEventEmitter uses the modern EventDispatcher path; the legacy
            // getJSModule(RCTEventEmitter) throws on RN bridgeless (new architecture).
            ViroEventEmitter.emit((ReactContext) getContext(), viewId, eventName, eventData);
        });
    }
}
