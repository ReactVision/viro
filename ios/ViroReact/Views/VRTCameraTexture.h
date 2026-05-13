//
//  VRTCameraTexture.h
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

#import <Foundation/Foundation.h>
#import "VRTView.h"

/**
 * VRTCameraTexture binds a live device camera feed to a named ViroMaterial
 * as its diffuse texture. It creates a VROCameraTextureiOS internally and
 * sets it on the material — the material only needs a lightingModel defined.
 *
 * Unlike VRTMaterialVideo (which controls an existing VideoTexture on a material),
 * this component creates and owns the camera texture.
 */
@interface VRTCameraTexture : VRTView

// React Native properties
@property (nonatomic, copy) NSString *material;
@property (nonatomic, copy) NSString *cameraPosition;   // "front" | "back", default "front"
@property (nonatomic, assign) BOOL paused;

// Direct event callbacks (use Viro suffix — matches ViroMaterialVideo convention)
@property (nonatomic, copy, nullable) RCTDirectEventBlock onCameraReadyViro;
@property (nonatomic, copy)           RCTDirectEventBlock onErrorViro;

- (instancetype)initWithBridge:(RCTBridge *)bridge;

// ---------------------------------------------------------------------------
// Photo / video capture  (called from VRTCameraTextureModule)
// ---------------------------------------------------------------------------

- (void)capturePhoto:(nullable NSString *)outputPath
          completion:(void (^)(BOOL success, NSString * _Nullable path, NSString * _Nullable error))completion;

- (void)startRecording:(nullable NSString *)outputPath
            completion:(void (^)(BOOL success, NSString * _Nullable path, NSString * _Nullable error))completion;

- (void)stopRecording:(void (^)(BOOL success, NSString * _Nullable path, NSString * _Nullable error))completion;

@end
