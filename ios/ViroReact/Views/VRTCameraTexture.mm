//
//  VRTCameraTexture.mm
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

#import "VRTCameraTexture.h"
#import "VRTMaterialManager.h"
#import <ViroKit/VROCameraTextureiOS.h>
#import <ViroKit/VROCameraTexture.h>
#import <ViroKit/VROMaterial.h>

@implementation VRTCameraTexture {
    // The C++ camera texture (created once, recreated on camera-switch)
    std::shared_ptr<VROCameraTextureiOS> _cameraTexture;

    // The material currently bound to the camera texture
    std::shared_ptr<VROMaterial> _boundMaterial;

    // Whether initCamera() has been called successfully for the current texture
    BOOL _cameraInitialized;

    // Guards the one-shot onCameraReadyViro event
    BOOL _cameraReadyFired;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super initWithBridge:bridge];
    if (self) {
        _cameraPosition  = @"front";
        _paused          = NO;
        _cameraInitialized = NO;
        _cameraTexture = std::make_shared<VROCameraTextureiOS>(VROTextureType::Texture2D);
    }
    return self;
}

// ---------------------------------------------------------------------------
// React Native prop setters
// ---------------------------------------------------------------------------

- (void)setMaterial:(NSString *)materialName {
    _material = materialName;
    [self _tryInitAndBind];
}

- (void)setCameraPosition:(NSString *)position {
    if ([_cameraPosition isEqualToString:position]) return;
    _cameraPosition = position;

    if (!_cameraInitialized) return;    // will be applied when driver is ready

    // Pause current session, recreate texture, re-init with new position
    BOOL wasPlaying = !_cameraTexture->isPaused();
    _cameraTexture->pause();

    _cameraTexture = std::make_shared<VROCameraTextureiOS>(VROTextureType::Texture2D);
    _cameraInitialized = NO;

    [self _tryInitAndBind];

    // Restore paused state if it was playing before the switch
    if (!wasPlaying) {
        _cameraTexture->pause();
    }
}

- (void)setPaused:(BOOL)paused {
    _paused = paused;
    if (!_cameraInitialized) return;

    if (paused) {
        _cameraTexture->pause();
    } else {
        _cameraTexture->play();
    }
}

// ---------------------------------------------------------------------------
// VRTView lifecycle
// Called once all props have been set AND self.driver is available
// ---------------------------------------------------------------------------

- (void)didSetProps:(NSArray<NSString *> *)changedProps {
    [self _tryInitAndBind];
}

// ---------------------------------------------------------------------------
// Core init / bind logic
// ---------------------------------------------------------------------------

- (void)_tryInitAndBind {
    // Guard: driver is nil until the parent ViroARSceneNavigator/ViroSceneNavigator
    // has fully initialised (VRTView.driver is set by the parent scene before
    // parentHasAppeared fires). Without this guard initCamera() will crash.
    if (!self.driver || !_material) return;

    if (!_cameraInitialized) {
        [self _initCamera];
    }

    [self _bindToMaterial];

    if (!_paused) {
        _cameraTexture->play();
    }
}

- (void)_initCamera {
    VROCameraPosition pos = [_cameraPosition isEqualToString:@"back"]
        ? VROCameraPosition::Back
        : VROCameraPosition::Front;

    // Set up the "first frame" callback — fires onCameraReadyViro once
    __weak VRTCameraTexture *weakSelf = self;
    std::weak_ptr<VROCameraTextureiOS> weakTex = _cameraTexture;

    _cameraTexture->setUpdateListener(
        [weakSelf, weakTex](CMSampleBufferRef sampleBuffer, std::vector<float> intrinsics) {
            (void)intrinsics;
            std::shared_ptr<VROCameraTextureiOS> tex = weakTex.lock();
            if (!tex) return;

            // Fire onCameraReady once on the first frame received from AVFoundation
            VRTCameraTexture *strongSelf = weakSelf;
            if (strongSelf && strongSelf->_cameraReadyFired == NO) {
                strongSelf->_cameraReadyFired = YES;
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (strongSelf.onCameraReadyViro) {
                        strongSelf.onCameraReadyViro(@{});
                    }
                });
            }
        });

    bool ok = _cameraTexture->initCamera(pos, VROCameraOrientation::Portrait, self.driver);
    if (!ok) {
        if (_onErrorViro) {
            _onErrorViro(@{ @"error": @"Failed to initialize camera" });
        }
        return;
    }
    _cameraInitialized = YES;
}

- (void)_bindToMaterial {
    if (!_material) return;

    VRTMaterialManager *mgr = [self.bridge moduleForClass:[VRTMaterialManager class]];
    std::shared_ptr<VROMaterial> mat = [mgr getMaterialByName:_material];

    if (mat) {
        _boundMaterial = mat;
        // SET the camera texture — inverse of ViroMaterialVideo which GETs it
        mat->getDiffuse().setTexture(_cameraTexture);
    } else {
        NSString *msg = [NSString stringWithFormat:@"Material '%@' not found", _material];
        NSLog(@"[VRTCameraTexture] %@", msg);
        if (_onErrorViro) {
            _onErrorViro(@{ @"error": msg });
        }
    }
}

// ---------------------------------------------------------------------------
// Photo / video capture  (called from VRTCameraTextureModule)
// ---------------------------------------------------------------------------

- (void)capturePhoto:(NSString *)outputPath
          completion:(void (^)(BOOL success, NSString *path, NSString *error))completion {
    if (!_cameraTexture) {
        completion(NO, nil, @"Camera not initialised");
        return;
    }
    _cameraTexture->capturePhoto(outputPath,
        [completion](bool ok, NSString *path, NSString *err) {
            dispatch_async(dispatch_get_main_queue(), ^{ completion(ok, path, err); });
        });
}

- (void)startRecording:(NSString *)outputPath
            completion:(void (^)(BOOL success, NSString *path, NSString *error))completion {
    if (!_cameraTexture) {
        completion(NO, nil, @"Camera not initialised");
        return;
    }
    _cameraTexture->startRecording(outputPath,
        [completion](bool ok, NSString *path, NSString *err) {
            dispatch_async(dispatch_get_main_queue(), ^{ completion(ok, path, err); });
        });
}

- (void)stopRecording:(void (^)(BOOL success, NSString *path, NSString *error))completion {
    if (!_cameraTexture) {
        completion(NO, nil, @"Camera not initialised");
        return;
    }
    _cameraTexture->stopRecording(
        [completion](bool ok, NSString *path, NSString *err) {
            dispatch_async(dispatch_get_main_queue(), ^{ completion(ok, path, err); });
        });
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

- (void)dealloc {
    if (_cameraTexture) {
        _cameraTexture->pause();
    }
    // Remove our texture from the material so it doesn't hold a dangling ref
    if (_boundMaterial) {
        _boundMaterial->getDiffuse().setTexture(nullptr);
    }
}

@end
