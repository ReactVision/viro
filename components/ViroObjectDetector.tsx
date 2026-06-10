/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import {
  NativeSyntheticEvent,
  requireNativeComponent,
  StyleSheet,
  ViewProps,
} from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal native event types
// ---------------------------------------------------------------------------

type NativeDetectionEvent = NativeSyntheticEvent<ViroDetectionEvent>;
type NativeReadyEvent = NativeSyntheticEvent<ViroDetectorReadyEvent>;
type NativeErrorEvent = NativeSyntheticEvent<ViroDetectorErrorEvent>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VRTObjectDetectorView = requireNativeComponent<any>("VRTObjectDetectorView");

/**
 * ViroObjectDetector — on-device open-vocabulary object detection powered by YOLOE.
 *
 * Opens an independent camera capture session, runs YOLOE inference at `maxFPS`,
 * and fires `onDetection` with normalized bounding boxes and labels.
 *
 * The view itself has zero visible surface (width/height 0); mount it anywhere
 * inside a ViroARScene or at the root of your component tree.
 *
 * @example
 * ```tsx
 * <ViroObjectDetector
 *   mode="prompt-free"
 *   confidenceThreshold={0.4}
 *   maxFPS={15}
 *   onDetection={({ detections }) => {
 *     detections.forEach(d => console.log(d.label, d.confidence));
 *   }}
 * />
 * ```
 */
export const ViroObjectDetector: React.FC<Props> = ({
  model = "yoloe-26s",
  mode = "prompt-free",
  categories = [],
  confidenceThreshold = 0.4,
  iouThreshold = 0.45,
  maxFPS = 15,
  cameraPosition = "back",
  onDetection,
  onReady,
  onError,
  style,
  ...rest
}) => {
  const handleDetection = React.useCallback(
    (event: NativeDetectionEvent) => {
      onDetection?.(event.nativeEvent);
    },
    [onDetection]
  );

  const handleReady = React.useCallback(
    (event: NativeReadyEvent) => {
      onReady?.(event.nativeEvent);
    },
    [onReady]
  );

  const handleError = React.useCallback(
    (event: NativeErrorEvent) => {
      onError?.(event.nativeEvent);
    },
    [onError]
  );

  return (
    <VRTObjectDetectorView
      {...rest}
      style={[styles.hidden, style]}
      model={model}
      mode={mode}
      categories={categories}
      confidenceThreshold={confidenceThreshold}
      iouThreshold={iouThreshold}
      maxFPS={maxFPS}
      cameraPosition={cameraPosition}
      onDetectionViro={onDetection ? handleDetection : undefined}
      onReadyViro={onReady ? handleReady : undefined}
      onErrorViro={onError ? handleError : undefined}
    />
  );
};

const styles = StyleSheet.create({
  hidden: {
    width: 0,
    height: 0,
  },
});
