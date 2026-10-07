/**
 * ViroObjectDetector.web.tsx
 *
 * Not implemented on web — on-device ONNX object detection has no
 * counterpart in the WASM/WebGL2 renderer yet. Exists so the
 * platform-extension resolver picks this over ViroObjectDetector.tsx on web,
 * whose top-level requireNativeComponent() call otherwise crashes the whole
 * @reactvision/react-viro barrel import on web.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";

// Type-only re-exports (erased at compile time) so other code importing these
// from "@reactvision/react-viro" still type-checks on web.
export type {
  ViroDetectorMode,
  ViroDetectionBoundingBox,
  ViroDetectedObject,
  ViroDetectionEvent,
  ViroDetectorReadyEvent,
  ViroDetectorErrorEvent,
} from "./ViroObjectDetector";

// The root barrel re-exports this from "./ViroObjectDetector", which resolves to this file on web.
// It is the value the native component's `onError` reports when its view is not in the build;
// kept in step with ViroObjectDetector.tsx by hand, since importing it from there would pull in
// the top-level requireNativeComponent() this stub exists to avoid.
export const VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR =
  "VRTObjectDetectorView is not registered with React Native. @reactvision/react-viro up to " +
  "3.0.2 shipped iOS builds without it; update the package, run pod install and rebuild the app.";

export const ViroObjectDetector: React.FC<any> = () => {
  if (__DEV__) {
    console.warn("[Viro web] ViroObjectDetector is not supported on web; rendering nothing.");
  }
  return null;
};
