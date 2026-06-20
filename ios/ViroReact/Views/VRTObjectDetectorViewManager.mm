//
//  VRTObjectDetectorViewManager.mm
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

#import "VRTObjectDetectorViewManager.h"
#import "VRTObjectDetectorView.h"

@implementation VRTObjectDetectorViewManager

RCT_EXPORT_MODULE()

- (UIView *)view {
    return [[VRTObjectDetectorView alloc] init];
}

// Model name (CoreML bundle) or absolute path to .onnx.
RCT_EXPORT_VIEW_PROPERTY(model, NSString *)

// "prompt-free" | "text" | "visual"
RCT_EXPORT_VIEW_PROPERTY(mode, NSString *)

// Text labels for "text" mode.
RCT_EXPORT_VIEW_PROPERTY(categories, NSArray)

// Minimum confidence threshold [0, 1].
RCT_EXPORT_VIEW_PROPERTY(confidenceThreshold, float)

// NMS IoU threshold.
RCT_EXPORT_VIEW_PROPERTY(iouThreshold, float)

// Maximum inference calls per second.
RCT_EXPORT_VIEW_PROPERTY(maxFPS, NSInteger)

// Maximum detections emitted per frame (top-N by confidence).
RCT_EXPORT_VIEW_PROPERTY(maxDetections, NSInteger)

// AR raycast → worldPosition (iOS).
RCT_EXPORT_VIEW_PROPERTY(projectToWorld, BOOL)

// JS callbacks
RCT_EXPORT_VIEW_PROPERTY(onDetectionViro, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onReadyViro, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onErrorViro, RCTDirectEventBlock)

@end
