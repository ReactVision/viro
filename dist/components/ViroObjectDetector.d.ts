/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as React from "react";
import { ViewProps } from "react-native";
export type ViroDetectorMode = "prompt-free" | "text" | "visual";
export type ViroDetectionBoundingBox = {
    /** Left edge, normalized [0, 1] */
    x: number;
    /** Top edge, normalized [0, 1] */
    y: number;
    width: number;
    height: number;
};
export type ViroDetectedObject = {
    label: string;
    confidence: number;
    boundingBox: ViroDetectionBoundingBox;
    /** 3D world position (metres) — only present when useARSession + projectToWorld are true. */
    worldPosition?: {
        x: number;
        y: number;
        z: number;
    };
    /**
     * Bounding box in screen pixels (portrait), pre-computed via ARFrame.displayTransform.
     * Only present when useARSession + projectToWorld are true.
     * Use directly as { left, top, width, height } in an absolute-positioned View.
     */
    screenBoundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};
export type ViroDetectionEvent = {
    detections: ViroDetectedObject[];
};
export type ViroDetectorReadyEvent = Record<string, never>;
export type ViroDetectorErrorEvent = {
    error: string;
};
type Props = ViewProps & {
    /**
     * Path to the YOLOE model file.
     * - iOS:     name of the .mlpackage bundle (CoreML) inside the app bundle,
     *            e.g. "yoloe-26s" (no extension needed for CoreML),
     *            or an absolute path to a .onnx file.
     * - Android: relative path inside assets/, e.g. "models/yoloe-26s.onnx".
     * Defaults to "yoloe-26s" (expects the bundled CoreML model on iOS,
     * and assets/models/yoloe-26s.onnx on Android).
     */
    model?: string;
    /**
     * Inference mode:
     * - "prompt-free": YOLOE LRPC — detects 4,585 categories with no extra prompt.
     * - "text":        YOLOE RepRTA — detect only the classes listed in `categories`.
     * - "visual":      YOLOE SAVPE — detect objects similar to a reference crop
     *                  (reference image API to be added in a future release).
     * Defaults to "prompt-free".
     */
    mode?: ViroDetectorMode;
    /**
     * Text categories for "text" mode, e.g. ["chair", "person", "laptop"].
     * Ignored in other modes.
     */
    categories?: string[];
    /**
     * Minimum confidence score [0, 1] for a detection to be reported.
     * Defaults to 0.4.
     */
    confidenceThreshold?: number;
    /**
     * IoU threshold used by NMS post-processing.
     * Defaults to 0.45.
     */
    iouThreshold?: number;
    /**
     * Maximum number of inference calls per second. The camera runs at the
     * device's native frame rate; this throttle prevents the inference thread
     * from saturating the CPU/NPU while the AR renderer runs in parallel.
     * Defaults to 15.
     */
    maxFPS?: number;
    /**
     * Which camera to sample frames from.
     * Defaults to "back".
     */
    cameraPosition?: "front" | "back";
    /**
     * When true, the component does NOT open its own AVCaptureSession.
     * Instead it taps into the AR session managed by the enclosing
     * ViroARSceneNavigator, receiving ARFrame.capturedImage on every tick.
     * The component renders nothing (no camera preview layer).
     * Use this when embedding ViroObjectDetector inside a ViroARScene.
     * Defaults to false.
     */
    useARSession?: boolean;
    /**
     * When true (and useARSession=true), each detection includes a `worldPosition`
     * {x, y, z} obtained by raycasting the bbox centre against the AR scene.
     * Defaults to true.
     */
    projectToWorld?: boolean;
    /**
     * Called every time the detector produces a new set of detections.
     * May be called with an empty array if nothing is detected in a frame.
     */
    onDetection?: (event: ViroDetectionEvent) => void;
    /**
     * Called once the model has been loaded and the camera pipeline is running.
     */
    onReady?: (event: ViroDetectorReadyEvent) => void;
    /**
     * Called if the model fails to load or the camera cannot be opened.
     */
    onError?: (event: ViroDetectorErrorEvent) => void;
};
/**
 * ViroObjectDetector — on-device open-vocabulary object detection powered by YOLOE.
 *
 * Opens an AVCaptureSession, renders its own camera preview via
 * AVCaptureVideoPreviewLayer (iOS) / SurfaceView (Android), and fires
 * `onDetection` with normalized bounding boxes and labels at `maxFPS`.
 *
 * Size the view explicitly — it renders a live camera feed. Pass
 * `style={StyleSheet.absoluteFill}` for a full-screen detector.
 *
 * @example
 * ```tsx
 * <ViroObjectDetector
 *   style={StyleSheet.absoluteFill}
 *   mode="prompt-free"
 *   confidenceThreshold={0.4}
 *   maxFPS={15}
 *   onDetection={({ detections }) => {
 *     detections.forEach(d => console.log(d.label, d.confidence));
 *   }}
 * />
 * ```
 */
export declare const ViroObjectDetector: React.FC<Props>;
export {};
