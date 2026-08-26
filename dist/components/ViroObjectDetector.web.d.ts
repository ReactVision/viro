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
export type { ViroDetectorMode, ViroDetectionBoundingBox, ViroDetectedObject, ViroDetectionEvent, ViroDetectorReadyEvent, ViroDetectorErrorEvent, } from "./ViroObjectDetector";
export declare const ViroObjectDetector: React.FC<any>;
