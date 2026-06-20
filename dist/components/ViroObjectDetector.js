"use strict";
/**
 * Copyright (c) 2026-present, ReactVision, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroObjectDetector = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const VRTObjectDetectorView = (0, react_native_1.requireNativeComponent)("VRTObjectDetectorView");
/**
 * ViroObjectDetector — on-device open-vocabulary object detection powered by YOLOE.
 *
 * Runs **only in AR**: it shares the camera feed of the enclosing
 * `ViroARSceneNavigator` (no separate camera session, no preview of its own) and
 * fires `onDetection` with labels, normalized bounding boxes, and an on-screen
 * `screenBoundingBox` (dp) at up to `maxFPS`. Mount it as a child or sibling of a
 * `ViroARSceneNavigator`; it renders nothing itself, so give it `width: 0, height: 0`.
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
const ViroObjectDetector = ({ model = "yoloe-26s", mode = "prompt-free", categories = [], confidenceThreshold = 0.4, iouThreshold = 0.45, maxFPS = 15, maxDetections = 20, projectToWorld = true, onDetection, onReady, onError, style, ...rest }) => {
    const handleDetection = React.useCallback((event) => {
        onDetection?.(event.nativeEvent);
    }, [onDetection]);
    const handleReady = React.useCallback((event) => {
        onReady?.(event.nativeEvent);
    }, [onReady]);
    const handleError = React.useCallback((event) => {
        onError?.(event.nativeEvent);
    }, [onError]);
    return (<VRTObjectDetectorView {...rest} style={style} model={model} mode={mode} categories={categories} confidenceThreshold={confidenceThreshold} iouThreshold={iouThreshold} maxFPS={maxFPS} maxDetections={maxDetections} projectToWorld={projectToWorld} onDetectionViro={onDetection ? handleDetection : undefined} onReadyViro={onReady ? handleReady : undefined} onErrorViro={onError ? handleError : undefined}/>);
};
exports.ViroObjectDetector = ViroObjectDetector;
