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

import android.app.Activity;
import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.viromedia.bridge.utility.ViroEvents;

import com.google.common.util.concurrent.ListenableFuture;

import java.io.IOException;
import java.io.InputStream;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;

/**
 * Zero-size View that opens a CameraX ImageAnalysis use case, throttles frame
 * delivery to maxFPS, runs YOLOE inference via ONNX Runtime on a background
 * thread, and emits detection results to JS via RCTEventEmitter.
 *
 * Props (set by VRTObjectDetectorViewManager via @ReactProp):
 *   model               — ONNX model path or asset name (without extension)
 *   mode                — "prompt-free" | "text" | "visual"
 *   categories          — String[] for text mode
 *   confidenceThreshold — float [0,1], default 0.4
 *   iouThreshold        — float [0,1], default 0.45
 *   maxFPS              — int, default 15
 *   cameraPosition      — "back" | "front"
 */
public class VRTObjectDetectorView extends View {

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
    private static final float DEFAULT_CONFIDENCE = 0.4f;
    private static final float DEFAULT_IOU        = 0.45f;
    private static final int   MODEL_INPUT_SIZE   = 640;

    // YOLOE output: [1, 300, 38]  — 38 = xyxy(4) + conf(1) + cls(1) + mask_coefs(32)
    private static final int OUTPUT_ROWS        = 300;
    private static final int OUTPUT_COLS        = 38;
    private static final int IDX_X1             = 0;
    private static final int IDX_Y1             = 1;
    private static final int IDX_X2             = 2;
    private static final int IDX_Y2             = 3;
    private static final int IDX_CONF           = 4;
    private static final int IDX_CLS            = 5;

    // --- Props ---
    private String       mModel               = "yoloe-26s";
    private String       mMode                = "prompt-free";
    private List<String> mCategories          = new ArrayList<>();
    private float        mConfidenceThreshold = DEFAULT_CONFIDENCE;
    private float        mIouThreshold        = DEFAULT_IOU;
    private int          mMaxFPS              = DEFAULT_MAX_FPS;
    private String       mCameraPosition      = "back";

    // --- State ---
    private boolean      mModelLoaded   = false;
    private boolean      mReadyFired    = false;
    private boolean      mSessionStarted = false;

    // --- ONNX Runtime ---
    private OrtEnvironment mOrtEnv     = null;
    private OrtSession     mOrtSession = null;

    // --- Camera ---
    private ProcessCameraProvider mCameraProvider;
    private ExecutorService       mCameraExecutor;
    private long                  mLastInferenceMs = 0;

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

    public void setCameraPosition(String cameraPosition) {
        if (mCameraPosition.equals(cameraPosition)) return;
        mCameraPosition = cameraPosition;
        restartIfRunning();
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

        mCameraExecutor.execute(() -> {
            boolean loaded = loadModel();
            if (!loaded) {
                emitError("Failed to load YOLOE model: " + mModel);
                return;
            }
            mModelLoaded = true;
            startCameraX();
        });
    }

    private void stopSession() {
        if (!mSessionStarted) return;
        mSessionStarted = false;
        mModelLoaded    = false;
        mReadyFired     = false;

        if (mCameraProvider != null) {
            mCameraProvider.unbindAll();
            mCameraProvider = null;
        }

        // Close ONNX session
        try {
            if (mOrtSession != null) { mOrtSession.close(); mOrtSession = null; }
            if (mOrtEnv    != null) { mOrtEnv.close();    mOrtEnv    = null; }
        } catch (OrtException e) {
            Log.w(TAG, "Error closing ORT session", e);
        }
    }

    private void restartIfRunning() {
        if (!mSessionStarted) return;
        stopSession();
        startSession();
    }

    // -------------------------------------------------------------------------
    // Model loading — ONNX Runtime
    // -------------------------------------------------------------------------

    private boolean loadModel() {
        try {
            mOrtEnv = OrtEnvironment.getEnvironment();
            OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
            opts.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.BASIC_OPT);

            byte[] modelBytes;

            if (mModel.startsWith("/") || mModel.startsWith("file://")) {
                // Absolute path on device
                String path = mModel.startsWith("file://") ? mModel.substring(7) : mModel;
                java.io.File f = new java.io.File(path);
                modelBytes = new byte[(int) f.length()];
                try (java.io.FileInputStream fis = new java.io.FileInputStream(f)) {
                    //noinspection ResultOfMethodCallIgnored
                    fis.read(modelBytes);
                }
            } else {
                // Load from assets: models/<mModel>.onnx
                String assetPath = "models/" + mModel + ".onnx";
                AssetManager assets = getContext().getAssets();
                try (InputStream is = assets.open(assetPath)) {
                    modelBytes = readAllBytes(is);
                }
            }

            mOrtSession = mOrtEnv.createSession(modelBytes, opts);
            Log.i(TAG, "ONNX model loaded: " + mModel);
            return true;

        } catch (OrtException | IOException e) {
            Log.e(TAG, "loadModel failed", e);
            return false;
        }
    }

    /** Reads all bytes from an InputStream (compatible with API 24+). */
    private static byte[] readAllBytes(InputStream is) throws IOException {
        java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int n;
        while ((n = is.read(chunk)) != -1) {
            buf.write(chunk, 0, n);
        }
        return buf.toByteArray();
    }

    // -------------------------------------------------------------------------
    // CameraX setup
    // -------------------------------------------------------------------------

    private void startCameraX() {
        Context context = getContext();
        ListenableFuture<ProcessCameraProvider> future =
            ProcessCameraProvider.getInstance(context);

        future.addListener(() -> {
            try {
                mCameraProvider = future.get();

                CameraSelector cameraSelector = mCameraPosition.equals("front")
                    ? CameraSelector.DEFAULT_FRONT_CAMERA
                    : CameraSelector.DEFAULT_BACK_CAMERA;

                ImageAnalysis imageAnalysis = new ImageAnalysis.Builder()
                    .setTargetResolution(new android.util.Size(640, 480))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .build();

                imageAnalysis.setAnalyzer(mCameraExecutor, this::analyzeFrame);

                mCameraProvider.unbindAll();

                // Obtain the LifecycleOwner from the Activity (AppCompatActivity implements it)
                ReactContext reactContext = (ReactContext) getContext();
                Activity activity = reactContext.getCurrentActivity();

                if (activity instanceof LifecycleOwner) {
                    mCameraProvider.bindToLifecycle(
                        (LifecycleOwner) activity,
                        cameraSelector,
                        imageAnalysis
                    );
                } else {
                    emitError("Activity is not a LifecycleOwner — cannot bind CameraX");
                    return;
                }

                if (!mReadyFired) {
                    mReadyFired = true;
                    emitReady();
                }

            } catch (ExecutionException | InterruptedException e) {
                Log.e(TAG, "CameraX provider error", e);
                emitError("CameraX error: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(context));
    }

    // -------------------------------------------------------------------------
    // Frame analysis
    // -------------------------------------------------------------------------

    private void analyzeFrame(@NonNull ImageProxy imageProxy) {
        try {
            // Throttle to maxFPS
            long now = System.currentTimeMillis();
            long minIntervalMs = 1000L / (mMaxFPS > 0 ? mMaxFPS : DEFAULT_MAX_FPS);
            if ((now - mLastInferenceMs) < minIntervalMs) return;
            mLastInferenceMs = now;

            if (!mModelLoaded) return;

            List<WritableMap> detections = runInference(imageProxy);
            emitDetections(detections);

        } finally {
            imageProxy.close();
        }
    }

    // -------------------------------------------------------------------------
    // Preprocessing — RGBA_8888 ImageProxy → float[] NCHW [1,3,640,640]
    // -------------------------------------------------------------------------

    private float[] preprocessImageProxy(ImageProxy imageProxy) {
        try {
            ImageProxy.PlaneProxy plane = imageProxy.getPlanes()[0];
            java.nio.ByteBuffer buffer = plane.getBuffer();
            int width  = imageProxy.getWidth();
            int height = imageProxy.getHeight();

            Bitmap srcBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            srcBitmap.copyPixelsFromBuffer(buffer);

            Bitmap scaledBitmap = Bitmap.createScaledBitmap(
                srcBitmap, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, true);
            srcBitmap.recycle();

            int pixelCount = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
            int[] pixels = new int[pixelCount];
            scaledBitmap.getPixels(pixels, 0, MODEL_INPUT_SIZE, 0, 0,
                MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
            scaledBitmap.recycle();

            float[] nchw = new float[3 * pixelCount];
            for (int i = 0; i < pixelCount; i++) {
                int px = pixels[i];
                nchw[i]                  = ((px >> 16) & 0xFF) / 255.0f; // R
                nchw[pixelCount + i]     = ((px >>  8) & 0xFF) / 255.0f; // G
                nchw[2 * pixelCount + i] = ( px        & 0xFF) / 255.0f; // B
            }
            return nchw;
        } catch (Exception e) {
            Log.e(TAG, "Preprocessing failed", e);
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Inference — ONNX Runtime, YOLOE output [1, 300, 38]
    // -------------------------------------------------------------------------

    private List<WritableMap> runInference(ImageProxy imageProxy) {
        List<WritableMap> results = new ArrayList<>();

        // Preprocess frame → float[] NCHW
        float[] nchwData = preprocessImageProxy(imageProxy);
        if (nchwData == null) return results;

        // Priority 1: use externally registered provider (react-viro-onnx)
        if (sInferenceProvider != null) {
            String modelPath = mModel.startsWith("/") || mModel.startsWith("file://")
                ? mModel.replace("file://", "")
                : mModel;
            List<java.util.Map<String, Object>> dets =
                sInferenceProvider.infer(modelPath, nchwData, MODEL_INPUT_SIZE, mConfidenceThreshold);
            for (java.util.Map<String, Object> d : dets) {
                WritableMap det = Arguments.createMap();
                det.putString("label", (String) d.get("label"));
                det.putDouble("confidence", ((Number) d.get("confidence")).doubleValue());
                @SuppressWarnings("unchecked")
                java.util.Map<String, Object> bb = (java.util.Map<String, Object>) d.get("boundingBox");
                WritableMap bbox = Arguments.createMap();
                bbox.putDouble("x",      ((Number) bb.get("x")).doubleValue());
                bbox.putDouble("y",      ((Number) bb.get("y")).doubleValue());
                bbox.putDouble("width",  ((Number) bb.get("width")).doubleValue());
                bbox.putDouble("height", ((Number) bb.get("height")).doubleValue());
                det.putMap("boundingBox", bbox);
                results.add(det);
            }
            return results;
        }

        // Fallback: built-in ORT session (if model was loaded directly)
        if (mOrtSession == null || mOrtEnv == null) return results;

        try {
            float[] floatInput = nchwData;

            // 4. Create input tensor
            long[] shape = {1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE};
            OnnxTensor inputTensor = OnnxTensor.createTensor(
                mOrtEnv, FloatBuffer.wrap(floatInput), shape);

            // 5. Run inference
            java.util.Map<String, OnnxTensor> inputs = new java.util.HashMap<>();
            inputs.put("images", inputTensor);

            OrtSession.Result ortResult = mOrtSession.run(inputs);
            inputTensor.close();

            // 6. Decode output0: shape [1, 300, 38]
            float[][][] output = (float[][][]) ortResult.get("output0").getValue();
            ortResult.close();

            float scale = (float) MODEL_INPUT_SIZE; // coords are in [0, 640]

            for (int i = 0; i < OUTPUT_ROWS; i++) {
                float conf  = output[0][i][IDX_CONF];
                if (conf < mConfidenceThreshold) continue;

                float x1 = output[0][i][IDX_X1] / scale;
                float y1 = output[0][i][IDX_Y1] / scale;
                float x2 = output[0][i][IDX_X2] / scale;
                float y2 = output[0][i][IDX_Y2] / scale;

                // Clamp to [0, 1]
                x1 = Math.max(0f, Math.min(1f, x1));
                y1 = Math.max(0f, Math.min(1f, y1));
                x2 = Math.max(0f, Math.min(1f, x2));
                y2 = Math.max(0f, Math.min(1f, y2));

                float normW = x2 - x1;
                float normH = y2 - y1;
                if (normW <= 0 || normH <= 0) continue;

                int clsId = (int) output[0][i][IDX_CLS];

                WritableMap bbox = Arguments.createMap();
                bbox.putDouble("x",      x1);
                bbox.putDouble("y",      y1);
                bbox.putDouble("width",  normW);
                bbox.putDouble("height", normH);

                WritableMap detection = Arguments.createMap();
                detection.putString("label",       String.valueOf(clsId));
                detection.putDouble("confidence",  conf);
                detection.putMap("boundingBox",    bbox);

                results.add(detection);
            }

        } catch (OrtException e) {
            Log.e(TAG, "Inference error", e);
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
        mMainHandler.post(() -> {
            ReactContext reactContext = (ReactContext) getContext();
            reactContext
                .getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), eventName, eventData);
        });
    }
}
