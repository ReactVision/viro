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
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.media.Image;
import android.os.Handler;
import android.os.HandlerThread;
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

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Zero-size View that opens a CameraX ImageAnalysis use case, throttles frame
 * delivery to maxFPS, runs YOLOE inference on a background thread, and emits
 * detection results to JS via RCTEventEmitter.
 *
 * Inference is stubbed pending ONNX Runtime integration (Phase 0 model export).
 * The camera pipeline is fully functional and ready to receive the model.
 *
 * Props (set by VRTObjectDetectorViewManager):
 *   model               — ONNX model filename in assets/, e.g. "yoloe-26s.onnx"
 *   mode                — "prompt-free" | "text" | "visual"
 *   categories          — String[] for text mode
 *   confidenceThreshold — float [0,1], default 0.4
 *   iouThreshold        — float [0,1], default 0.45
 *   maxFPS              — int, default 15
 *   cameraPosition      — "back" | "front"
 */
public class VRTObjectDetectorView extends View {

    private static final String TAG = "VRTObjectDetector";

    private static final int   DEFAULT_MAX_FPS    = 15;
    private static final float DEFAULT_CONFIDENCE = 0.4f;
    private static final float DEFAULT_IOU        = 0.45f;
    // YOLOE input resolution
    private static final int   MODEL_INPUT_SIZE   = 640;

    // --- Props ---
    private String       mModel               = "yoloe-26s.onnx";
    private String       mMode                = "prompt-free";
    private List<String> mCategories          = new ArrayList<>();
    private float        mConfidenceThreshold = DEFAULT_CONFIDENCE;
    private float        mIouThreshold        = DEFAULT_IOU;
    private int          mMaxFPS              = DEFAULT_MAX_FPS;
    private String       mCameraPosition      = "back";

    // --- State ---
    private boolean mModelLoaded  = false;
    private boolean mReadyFired   = false;
    private boolean mSessionStarted = false;

    // --- Camera ---
    private ProcessCameraProvider mCameraProvider;
    private ExecutorService       mCameraExecutor;
    private long                  mLastInferenceMs = 0;

    public VRTObjectDetectorView(Context context) {
        super(context);
        mCameraExecutor = Executors.newSingleThreadExecutor();
    }

    // -------------------------------------------------------------------------
    // Prop setters (called by VRTObjectDetectorViewManager via @ReactProp)
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
    }

    private void restartIfRunning() {
        if (!mSessionStarted) return;
        stopSession();
        startSession();
    }

    // -------------------------------------------------------------------------
    // Model loading (stub — wire ONNX Runtime here in Phase 0)
    // -------------------------------------------------------------------------

    private boolean loadModel() {
        // TODO (Phase 0): load ONNX Runtime session from assets.
        //
        // try {
        //     OrtEnvironment env = OrtEnvironment.getEnvironment();
        //     AssetManager assets = getContext().getAssets();
        //     InputStream is = assets.open("models/" + mModel);
        //     byte[] modelBytes = IOUtils.toByteArray(is);
        //     mOrtSession = env.createSession(modelBytes, new OrtSession.SessionOptions());
        //     return true;
        // } catch (Exception e) {
        //     Log.e(TAG, "loadModel failed", e);
        //     return false;
        // }

        // Stub: always succeeds so the camera pipeline can be validated.
        return true;
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
                    .build();

                imageAnalysis.setAnalyzer(mCameraExecutor, this::analyzeFrame);

                mCameraProvider.unbindAll();

                if (context instanceof LifecycleOwner) {
                    mCameraProvider.bindToLifecycle(
                        (LifecycleOwner) context,
                        cameraSelector,
                        imageAnalysis
                    );
                } else {
                    emitError("Context is not a LifecycleOwner — cannot bind CameraX");
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
            // Throttle to maxFPS.
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
    // Inference (stub)
    // -------------------------------------------------------------------------

    private List<WritableMap> runInference(ImageProxy imageProxy) {
        // TODO (Phase 0): run ONNX Runtime inference.
        //
        // Pipeline:
        //   1. Convert YUV_420_888 → RGB Bitmap.
        //   2. Resize to MODEL_INPUT_SIZE × MODEL_INPUT_SIZE (letterbox).
        //   3. Normalize to float32 [0,1], shape [1, 3, 640, 640] NCHW.
        //   4. Run mOrtSession.run(inputs).
        //   5. Decode output tensor: [1, num_classes+4, 8400] → boxes + scores.
        //   6. Apply confidence filter (mConfidenceThreshold).
        //   7. Run NMS (mIouThreshold).
        //   8. Map boxes to normalized [0,1] image coords.
        //   9. Build WritableMap list with label, confidence, boundingBox.

        // Stub: return empty list until model is wired in.
        return new ArrayList<>();
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

    private void emitEvent(String eventName, WritableMap eventData) {
        ReactContext reactContext = (ReactContext) getContext();
        reactContext
            .getJSModule(RCTEventEmitter.class)
            .receiveEvent(getId(), eventName, eventData);
    }
}
