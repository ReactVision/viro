//
//  VRTObjectDetectorView.h
//  ViroReact
//
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
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

#import <UIKit/UIKit.h>
#import <React/RCTView.h>
#import <React/RCTBridgeModule.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Block type for the pluggable inference provider.
 *
 * modelPath      — absolute path to the .onnx model file
 * nchwData       — Float32 NCHW buffer [1, 3, inputSize, inputSize], normalized [0,1]
 * inputSize      — width == height of the square input (e.g. 640)
 * confThreshold  — minimum confidence to emit a detection
 *
 * Returns an array of detection dicts:
 *   { label: NSString, confidence: NSNumber, boundingBox: { x, y, width, height } }
 * All coordinates are normalized [0, 1].
 */
typedef NSArray<NSDictionary *> * _Nonnull (^VRTInferenceBlock)(
    NSString * _Nonnull modelPath,
    const float * _Nonnull nchwData,
    int inputSize,
    float confThreshold
);

/**
 * VRTObjectDetectorView — zero-size UIView that taps the enclosing AR session's
 * camera frames (published by VRTARSceneNavigator), samples them at `maxFPS`, runs
 * YOLOE inference on each frame, and emits detection results to JS via RCT direct
 * event callbacks. It renders nothing of its own.
 *
 * Works only in AR: mount it inside (or alongside) a ViroARSceneNavigator. Inference
 * is delegated to a registered provider (@reactvision/react-viro-onnx); without one,
 * detection returns empty results.
 */
@interface VRTObjectDetectorView : RCTView

/**
 * Register a pluggable inference provider (e.g. ONNX Runtime from react-viro-onnx).
 * Idempotent — subsequent calls replace the previous provider.
 */
+ (void)registerInferenceProvider:(VRTInferenceBlock)provider;

// --- Props set by VRTObjectDetectorViewManager ---

/** Model name (CoreML bundle) or absolute path to .onnx. Default: "yoloe-26s". */
@property (nonatomic, copy) NSString *model;

/** "prompt-free" | "text" | "visual". Default: "prompt-free". */
@property (nonatomic, copy) NSString *mode;

/** Text labels for "text" mode. Ignored otherwise. */
@property (nonatomic, copy) NSArray<NSString *> *categories;

/** Minimum confidence [0,1] for a detection to be emitted. Default: 0.4. */
@property (nonatomic, assign) float confidenceThreshold;

/** NMS IoU threshold. Default: 0.45. */
@property (nonatomic, assign) float iouThreshold;

/** Maximum inference calls per second. Default: 15. */
@property (nonatomic, assign) NSInteger maxFPS;

/** Maximum detections emitted per frame (top-N by confidence). Default: 20. */
@property (nonatomic, assign) NSInteger maxDetections;

/**
 * When YES each detection includes a `worldPosition` dict {x, y, z} obtained by
 * raycasting the bounding-box centre against the AR scene. Adds ~1ms per detection.
 * Default: YES.
 */
@property (nonatomic, assign) BOOL projectToWorld;

// --- RCT event callbacks ---
@property (nonatomic, copy, nullable) RCTDirectEventBlock onDetectionViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onReadyViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onErrorViro;

@end

NS_ASSUME_NONNULL_END
