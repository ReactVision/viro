//
//  VROFrontCameraProvider.h
//  ViroKit
//
//  Copyright © 2026 ReactVision. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <ARKit/ARKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * VROFrontCameraProvider — Objective-C registration host for front-camera AR.
 *
 * ViroKit itself does NOT reference the ARKit face-tracking / TrueDepth API. An
 * optional external module (@reactvision/react-viro-face-tracking) supplies a
 * front-camera ARConfiguration by calling +registerConfigProvider:. That module
 * discovers this class at runtime via NSClassFromString, so ViroKit carries no
 * build- or link-time dependency on it (mirrors how react-viro-onnx registers
 * against VRTObjectDetectorView).
 *
 * The registered block returns a ready-to-run front-camera ARConfiguration, or
 * nil if the device does not support it. It is stored process-wide and consulted
 * by VROARSessioniOS whenever front-camera AR is requested.
 */
@interface VROFrontCameraProvider : NSObject

/** Register the front-camera config provider used by VROARSessioniOS (idempotent). */
+ (void)registerConfigProvider:(ARConfiguration * _Nullable (^)(void))provider;

@end

NS_ASSUME_NONNULL_END
