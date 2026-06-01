//
//  VRTCameraTextureModule.mm
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

#import <React/RCTUIManager.h>
#import <React/RCTUIManagerUtils.h>
#import "VRTCameraTextureModule.h"
#import "VRTCameraTexture.h"

// Response map keys — mirror the Android VRTCameraTextureModule conventions.
static NSString *const kKeySuccess = @"success";
static NSString *const kKeyUrl     = @"url";
static NSString *const kKeyError   = @"error";

@implementation VRTCameraTextureModule

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE()

// Run all UI-block additions on the RCTUIManager serial queue (same pattern as
// VRTARSceneNavigatorModule).
- (dispatch_queue_t)methodQueue {
    return RCTGetUIManagerQueue();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve the promise with a success payload: { success: true, url: path }
static inline void resolveSuccess(RCTPromiseResolveBlock resolve, NSString *path) {
    resolve(@{ kKeySuccess: @YES, kKeyUrl: path ?: @"" });
}

/// Resolve the promise with an error payload: { success: false, error: msg }
/// We resolve (not reject) to mirror the Android module behaviour.
static inline void resolveError(RCTPromiseResolveBlock resolve, NSString *msg) {
    resolve(@{ kKeySuccess: @NO, kKeyError: msg ?: @"Unknown error" });
}

/// Look up the VRTCameraTexture view from the uiManager's view registry.
/// Returns nil and resolves the error promise if the view is missing or wrong type.
- (nullable VRTCameraTexture *)cameraTextureForTag:(nonnull NSNumber *)reactTag
                                        uiManager:(RCTUIManager *)uiManager
                                          resolve:(RCTPromiseResolveBlock)resolve {
    UIView *view = [uiManager viewForReactTag:reactTag];
    if (![view isKindOfClass:[VRTCameraTexture class]]) {
        NSString *msg = [NSString stringWithFormat:
            @"Expected VRTCameraTexture for tag %@, got %@", reactTag, NSStringFromClass([view class])];
        RCTLogError(@"[VRTCameraTextureModule] %@", msg);
        resolveError(resolve, msg);
        return nil;
    }
    return (VRTCameraTexture *)view;
}

// ---------------------------------------------------------------------------
// Photo capture
// ---------------------------------------------------------------------------

/**
 * capturePhoto(reactTag, outputPath)  →  Promise<{ success, url?, error? }>
 *
 * @param reactTag   React view tag of the VRTCameraTexture component.
 * @param outputPath Absolute JPEG path, or null to use a default cache-dir path.
 */
RCT_EXPORT_METHOD(capturePhoto:(nonnull NSNumber *)reactTag
                    outputPath:(nullable NSString *)outputPath
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)__unused reject) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager,
                                        NSDictionary<NSNumber *, UIView *> *__unused viewRegistry) {
        VRTCameraTexture *component = [self cameraTextureForTag:reactTag
                                                      uiManager:uiManager
                                                        resolve:resolve];
        if (!component) return;

        [component capturePhoto:outputPath completion:^(BOOL success, NSString *path, NSString *error) {
            if (success) {
                resolveSuccess(resolve, path);
            } else {
                resolveError(resolve, error);
            }
        }];
    }];
}

// ---------------------------------------------------------------------------
// Video recording
// ---------------------------------------------------------------------------

/**
 * startRecording(reactTag, outputPath)  →  Promise<{ success, url?, error? }>
 *
 * Resolves when the recording session has successfully started (first frame
 * written). The url in the success payload is the output path that will be
 * written to when stopRecording is called.
 *
 * @param reactTag   React view tag of the VRTCameraTexture component.
 * @param outputPath Absolute MP4 path, or null to use a default cache-dir path.
 */
RCT_EXPORT_METHOD(startRecording:(nonnull NSNumber *)reactTag
                      outputPath:(nullable NSString *)outputPath
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)__unused reject) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager,
                                        NSDictionary<NSNumber *, UIView *> *__unused viewRegistry) {
        VRTCameraTexture *component = [self cameraTextureForTag:reactTag
                                                      uiManager:uiManager
                                                        resolve:resolve];
        if (!component) return;

        [component startRecording:outputPath completion:^(BOOL success, NSString *path, NSString *error) {
            if (success) {
                resolveSuccess(resolve, path);
            } else {
                resolveError(resolve, error);
            }
        }];
    }];
}

/**
 * stopRecording(reactTag)  →  Promise<{ success, url?, error? }>
 *
 * Finalises the recording and resolves with the path of the written file.
 */
RCT_EXPORT_METHOD(stopRecording:(nonnull NSNumber *)reactTag
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)__unused reject) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager,
                                        NSDictionary<NSNumber *, UIView *> *__unused viewRegistry) {
        VRTCameraTexture *component = [self cameraTextureForTag:reactTag
                                                      uiManager:uiManager
                                                        resolve:resolve];
        if (!component) return;

        [component stopRecording:^(BOOL success, NSString *path, NSString *error) {
            if (success) {
                resolveSuccess(resolve, path);
            } else {
                resolveError(resolve, error);
            }
        }];
    }];
}

@end
