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
  /** 3D world position (metres), from raycasting the bbox centre. Present when `projectToWorld` is true (iOS only). */
  worldPosition?: { x: number; y: number; z: number };
  /**
   * Bounding box in density-independent points (dp), aligned to the on-screen AR
   * camera preview. Use directly as { left, top, width, height } in an
   * absolute-positioned View. Present on iOS and Android.
   */
  screenBoundingBox?: { x: number; y: number; width: number; height: number };
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
   * The YOLOE model to run. Either a bundled model **name** (resolved natively as
   * `<name>.onnx` in the app bundle / Android assets), or an absolute `/`-path or
   * `file://` URL to an `.onnx` file. Defaults to "yoloe-26s".
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
   * Maximum number of detections reported per frame, kept as the top-N by
   * confidence (after NMS). Lower this to reduce clutter, raise it to surface
   * more objects.
   * Defaults to 20.
   */
  maxDetections?: number;

  /**
   * When true, each detection includes a `worldPosition` {x, y, z} obtained by
   * raycasting the bbox centre against the AR scene. iOS only (Android emits
   * `screenBoundingBox` but not yet `worldPosition`).
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
 * Runs in AR and on Meta Quest:
 * - **Phone AR**: shares the camera feed of the enclosing `ViroARSceneNavigator`
 *   (no separate camera session) and fires `onDetection` with labels, normalized
 *   bounding boxes, and an on-screen `screenBoundingBox` (dp) at up to `maxFPS`.
 * - **Meta Quest 3 / 3S** (Horizon OS v74+): when mounted in a Quest MR scene
 *   (under `ViroXRSceneNavigator`), it captures the headset camera via the Meta
 *   Passthrough Camera API and runs the same YOLOE pipeline. Requires the
 *   `horizonos.permission.HEADSET_CAMERA` runtime permission. v1 emits `label` +
 *   normalized `boundingBox` only — `screenBoundingBox` and `worldPosition` are
 *   not provided on Quest yet (they need camera extrinsics).
 *
 * Mount it as a child or sibling of the scene navigator; it renders nothing itself,
 * so give it `width: 0, height: 0`.
 *
 * @example
 * ```tsx
 * <ViroARSceneNavigator initialScene={{ scene: MyScene }} />
 * <ViroObjectDetector
 *   style={{ position: "absolute", width: 0, height: 0 }}
 *   mode="prompt-free"
 *   confidenceThreshold={0.4}
 *   maxFPS={15}
 *   onDetection={({ detections }) => {
 *     detections.forEach(d => console.log(d.label, d.confidence, d.screenBoundingBox));
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
  maxDetections = 20,
  projectToWorld = true,
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
      style={style}
      model={model}
      mode={mode}
      categories={categories}
      confidenceThreshold={confidenceThreshold}
      iouThreshold={iouThreshold}
      maxFPS={maxFPS}
      maxDetections={maxDetections}
      projectToWorld={projectToWorld}
      onDetectionViro={onDetection ? handleDetection : undefined}
      onReadyViro={onReady ? handleReady : undefined}
      onErrorViro={onError ? handleError : undefined}
    />
  );
};
