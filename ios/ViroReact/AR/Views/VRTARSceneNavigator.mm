//
//  VRTARSceneNavigator.mm
//  ViroReact
//
//  Created by Andy Chu on 6/12/17.
//  Copyright © 2017 Viro Media. All rights reserved.
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
//

#import <ViroKit/ViroKit.h>
#import "VRTARSceneNavigator.h"
#import <React/RCTAssert.h>
#import <React/RCTLog.h>
#import "VRTARScene.h"
#import "VRTNotifications.h"
#import <React/RCTRootView.h>
#import <React/RCTUtils.h>
#import "VRTPerfMonitor.h"
#import "VRTMaterialManager.h"
#import <ViroKit/VROGeospatialAnchor.h>
#import <ViroKit/VROSemantics.h>
#import <ViroKit/VROARScene.h>
#import <ViroKit/VROARWorldMesh.h>

@implementation VRTARSceneNavigator {
    id <VROView> _vroView;
    NSInteger _currentStackPosition;
    RCTBridge *_bridge;
    VROVideoQuality _vroVideoQuality;
    BOOL _hasCleanedUp;
    EAGLContext *_eaglContext;

    // Pending configuration for features that may be set before session is ready
    BOOL _pendingSemanticModeEnabled;
    BOOL _needsSemanticModeApply;
    BOOL _pendingGeospatialModeEnabled;
    BOOL _needsGeospatialModeApply;

    // World mesh configuration
    BOOL _pendingWorldMeshEnabled;
    BOOL _needsWorldMeshApply;
    VROWorldMeshConfig _worldMeshConfigCpp;

    // depthEnabled: activate depth sensing without occlusion rendering
    BOOL _depthEnabled;
}

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super initWithBridge:bridge];
    if (self) {
        // Load materials; must be done each time we have a new context (e.g. after
        // the EGL context is created by the VROViewAR
        VRTMaterialManager *materialManager = [bridge materialManager];
        [materialManager reloadMaterials];
        
        [self setFrame:CGRectMake(0, 0,
                                  [[UIScreen mainScreen] bounds].size.width,
                                  [[UIScreen mainScreen] bounds].size.height)];
        self.currentViews = [[NSMutableArray alloc] init];
        _currentStackPosition = -1;

        _bridge = bridge;
        _autofocus = YES;
        _vroVideoQuality = VROVideoQuality::High;
        _numberOfTrackedImages = 0; // disable this
        _hdrEnabled = YES;
        _pbrEnabled = YES;
        _bloomEnabled = YES;
        _shadowsEnabled = YES;
        _multisamplingEnabled = NO;
        _depthEnabled = NO;
    }
    return self;
}

- (void)setAutofocus:(BOOL)autofocus {
    _autofocus = autofocus;
    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        arSession->setAutofocus(_autofocus);
    }
}

- (void)setVideoQuality:(NSString *)videoQuality {
    _videoQuality = videoQuality;
    if ([videoQuality caseInsensitiveCompare:@"Low"] == NSOrderedSame) {
        _vroVideoQuality = VROVideoQuality::Low;
    } else {
        _vroVideoQuality = VROVideoQuality::High;
    }
    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        arSession->setVideoQuality(_vroVideoQuality);
    }
}

- (void)didSetProps:(NSArray<NSString *> *)changedProps {
    // if we haven't created the VROView, then create it now that
    // all the props have been set.
    if (!_vroView) {
        VROWorldAlignment worldAlignment = VROWorldAlignment::Gravity;
        if (_worldAlignment) {
            if ([_worldAlignment caseInsensitiveCompare:@"Gravity"] == NSOrderedSame) {
                worldAlignment = VROWorldAlignment::Gravity;
            } else if ([_worldAlignment caseInsensitiveCompare:@"GravityAndHeading"] == NSOrderedSame) {
                worldAlignment = VROWorldAlignment::GravityAndHeading;
            } else if ([_worldAlignment caseInsensitiveCompare:@"Camera"] == NSOrderedSame) {
                worldAlignment = VROWorldAlignment::Camera;
            }
        }
        
        _eaglContext = [[EAGLContext alloc] initWithAPI:kEAGLRenderingAPIOpenGLES3];

        VRORendererConfiguration config;
        config.enableHDR = _hdrEnabled;
        config.enablePBR = _pbrEnabled;
        config.enableBloom = _bloomEnabled;
        config.enableShadows = _shadowsEnabled;
        config.enableMultisampling = _multisamplingEnabled;
        
        _vroView = [[VROViewAR alloc] initWithFrame:CGRectMake(0, 0,
                                                               [[UIScreen mainScreen] bounds].size.width,
                                                               [[UIScreen mainScreen] bounds].size.height)
                                             config:config
                                            context:_eaglContext
                                     worldAlignment:worldAlignment];

        if (_currentScene != nil) {
            [_currentScene setView:_vroView];
        }

        VROViewAR *viewAR = (VROViewAR *) _vroView;
        [viewAR setAutoresizingMask:UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight];
        _vroView.renderDelegate = self;
        
        [self addSubview:(UIView *)_vroView];

        [_bridge.perfMonitor setView:_vroView];

        // set the scene if it was set before this view was created (not likely)
        if (_currentScene) {
            [_vroView setSceneController:[_currentScene sceneController]];
        }

        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        arSession->setAutofocus(_autofocus);
        arSession->setVideoQuality(_vroVideoQuality);
        arSession->setNumberOfTrackedImages(_numberOfTrackedImages);

        // Apply initial occlusion mode (considers both occlusionMode and depthEnabled)
        {
            VROOcclusionMode mode = [self computeEffectiveOcclusionMode];
            if (mode != VROOcclusionMode::Disabled || _occlusionMode != nil || _depthEnabled) {
                arSession->setOcclusionMode(mode);
            }
        }

        // Apply initial depth debug setting if set
        if (_depthDebugEnabled) {
            [viewAR setDepthDebugEnabled:_depthDebugEnabled opacity:0.7f];
        }

        // Apply cloud anchor provider if it was set before view was ready
        if (_cloudAnchorProvider) {
            [self setCloudAnchorProvider:_cloudAnchorProvider];
        }

        // Apply geospatial anchor provider if it was set before view was ready
        if (_geospatialAnchorProvider) {
            [self setGeospatialAnchorProvider:_geospatialAnchorProvider];
        }

        // Apply pending semantic mode if set before view was ready
        if (_needsSemanticModeApply) {
            [self applySemanticModeEnabled];
            _needsSemanticModeApply = NO;
        }

        // Apply pending geospatial mode if set before view was ready
        if (_needsGeospatialModeApply) {
            [self applyGeospatialModeEnabled];
            _needsGeospatialModeApply = NO;
        }
    }
}

- (UIView *)rootVROView {
    return (UIView *)_vroView;
}

//VROComponent overrides...
- (void)insertReactSubview:(UIView *)subview atIndex:(NSInteger)atIndex {
    RCTAssert([subview isKindOfClass:[VRTARScene class]], @"VRTARNavigator only accepts VRTARScene subviews");
    [super insertReactSubview:subview atIndex:atIndex];
    
    VRTARScene *sceneView = (VRTARScene *)subview;
    
    [sceneView setView:_vroView];
    [self.currentViews insertObject:sceneView atIndex:atIndex];
    
    if (self.currentSceneIndex == atIndex){
        [self setSceneView:sceneView];
    }
}

-(void)setCurrentSceneIndex:(NSInteger)index {
    int currentViewsLength = (int)[_currentViews count];
    _currentSceneIndex = index;
    
    if (_currentSceneIndex < 0 || _currentSceneIndex > (currentViewsLength - 1)){
        // setCurrentSceneTag may be set before insertReactSubView class.
        // In this case, just return.
        return;
    }

    VRTScene *sceneView = [_currentViews objectAtIndex:index];
    [self setSceneView:sceneView];
}

- (void)removeReactSubview:(UIView *)subview {
    VRTARScene *sceneView = (VRTARScene *)subview;
    [self.currentViews removeObject:sceneView];
    [super removeReactSubview:subview];
}

- (NSArray *)reactSubviews {
    return self.currentViews;
}

- (UIView *)reactSuperview {
    return nil;
}

#pragma mark - VRORenderDelegate methods

- (void)setupRendererWithDriver:(std::shared_ptr<VRODriver>)driver {
    
}

- (void)startVideoRecording:(NSString *)fileName
           saveToCameraRoll:(BOOL)saveToCameraRoll
                    onError:(RCTResponseSenderBlock)onError {
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    [viewAR startVideoRecording:fileName saveToCameraRoll:saveToCameraRoll errorBlock:^(NSInteger errorCode) {
        onError(@[@(errorCode)]);
    }];
}

- (void)stopVideoRecordingWithHandler:(VROViewWriteMediaFinishBlock)completionHandler {
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    [viewAR stopVideoRecordingWithHandler:completionHandler];
}

- (void)takeScreenshot:(NSString *)fileName
      saveToCameraRoll:(BOOL)saveToCameraRoll
     completionHandler:(VROViewWriteMediaFinishBlock)completionHandler {
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    [viewAR takeScreenshot:fileName saveToCameraRoll:saveToCameraRoll withCompletionHandler:completionHandler];
    
}

- (void)setSceneView:(VRTScene *)sceneView {
    if (_currentScene == sceneView) {
        return;
    }

    if (_vroView) {
        if (_currentScene == nil) {
            [_vroView setSceneController:[sceneView sceneController]];
        } else {
            [_vroView setSceneController:[sceneView sceneController] duration:1 timingFunction:VROTimingFunctionType::EaseIn];
        }
    }

    _currentScene = sceneView;

    // Apply pending world mesh configuration if set before scene was ready
    if (_needsWorldMeshApply) {
        [self applyWorldMeshEnabled];
    }
}

- (void)willMoveToSuperview:(UIView *)newSuperview {
    if (newSuperview == nil) {
        // View is being removed
        [self cleanupViroResources];

        // Critical: Clear pointer interactions to prevent crashes
        @try {
            self.interactions = @[];
        } @catch (NSException *exception) {
            NSLog(@"Error clearing interactions: %@", exception.reason);
        }
    } else {
        // View is being added - reset cleanup flag for potential reuse (Paper architecture)
        _hasCleanedUp = NO;
    }
    [super willMoveToSuperview:newSuperview];
}

- (void)cleanupViroResources {
    // Only cleanup once per instance
    if (_hasCleanedUp) {
        return;
    }
    _hasCleanedUp = YES;

    // CRITICAL: Clear currentViews to break retain cycle
    if (_currentViews) {
        [_currentViews removeAllObjects];
        _currentViews = nil;
    }

    // Clear event blocks
    _onExitViro = nil;
    _onWorldMeshUpdated = nil;

    // Clear current scene
    _currentScene = nil;

    // Clear bridge reference (was strong, creating cycle)
    if (_bridge) {
        VRTMaterialManager *materialManager = [_bridge materialManager];
        [materialManager clearAllMaterials];
        _bridge = nil;
    }

    [self parentDidDisappear];

    // Clear render delegate to break potential cycles
    if (_vroView) {
        _vroView.renderDelegate = nil;
    }

    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *)_vroView;

        // First pause the AR session
        [viewAR setPaused:YES];

        // Terminate AR session explicitly - synchronous cleanup for Fabric
        @try {
            std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
            if (arSession) {
                arSession->pause();

                // Synchronous cleanup to prevent race conditions in Fabric
                @try {
                    [viewAR deleteGL];
                } @catch (NSException *exception) {
                    NSLog(@"Error during AR view cleanup: %@", exception.reason);
                }
            } else {
                [viewAR deleteGL];
            }
        } @catch (NSException *exception) {
            NSLog(@"Error terminating AR session: %@", exception.reason);
            // Still try to delete GL resources
            @try {
                [viewAR deleteGL];
            } @catch (NSException *innerException) {
                NSLog(@"Error during AR view cleanup: %@", innerException.reason);
            }
        }

        // Remove the view from hierarchy before clearing reference
        [(UIView *)_vroView removeFromSuperview];

        // Clear the view reference to prevent dangling pointer
        _vroView = nil;
    }

    // Destroy the EAGLContext to release GPU resources
    // This must happen after deleteGL since GL operations require a valid context
    if (_eaglContext) {
        // Clear the current context if it's ours
        if ([EAGLContext currentContext] == _eaglContext) {
            [EAGLContext setCurrentContext:nil];
        }
        _eaglContext = nil;
    }
}

- (void)removeFromSuperview{
    // Fabric may call removeFromSuperview after willMoveToSuperview
    // So we need to handle cleanup in both places
    [self cleanupViroResources];
    
    // Clear any remaining pointer interactions before calling super
    @try {
        self.interactions = @[];
        
        // Also clear any gesture recognizers that might cause issues
        for (UIGestureRecognizer *gesture in self.gestureRecognizers) {
            [self removeGestureRecognizer:gesture];
        }
    } @catch (NSException *exception) {
        NSLog(@"Error clearing interactions/gestures: %@", exception.reason);
    }
    
    [super removeFromSuperview];
}

- (void)dealloc {
    // Final safety net for cleanup
    [self cleanupViroResources];
}

#pragma mark - Fabric Compatibility

- (void)prepareForRecycle {
    // Called by Fabric architecture before reusing the view
    // We must clean up all resources here to prevent memory leaks
    [self cleanupViroResources];

    // Reset state flags for potential reuse
    _hasCleanedUp = NO;

    [super prepareForRecycle];
}

- (void)setNumberOfTrackedImages:(NSInteger)numberOfTrackedImages {
    _numberOfTrackedImages = numberOfTrackedImages;
    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        arSession->setNumberOfTrackedImages(numberOfTrackedImages);
    }
}

- (void)setHdrEnabled:(BOOL)hdrEnabled {
    _hdrEnabled = hdrEnabled;
    if (_vroView) {
        [_vroView setHDREnabled:hdrEnabled];
    }
}

- (void)setPbrEnabled:(BOOL)pbrEnabled {
    _pbrEnabled = pbrEnabled;
    if (_vroView) {
        [_vroView setPBREnabled:pbrEnabled];
    }
}

- (void)setBloomEnabled:(BOOL)bloomEnabled {
    _bloomEnabled = bloomEnabled;
    if (_vroView) {
        [_vroView setBloomEnabled:bloomEnabled];
    }
}

- (void)setShadowsEnabled:(BOOL)shadowsEnabled {
    _shadowsEnabled = shadowsEnabled;
    if (_vroView) {
        [_vroView setShadowsEnabled:shadowsEnabled];
    }
}

- (void)setMultisamplingEnabled:(BOOL)multisamplingEnabled {
    _multisamplingEnabled = multisamplingEnabled;
}

- (VROOcclusionMode)computeEffectiveOcclusionMode {
    // Explicit occlusionMode prop always takes precedence.
    // Guard against nil: in ObjC [nil caseInsensitiveCompare:] returns 0 == NSOrderedSame,
    // which would incorrectly match "depthBased" when the prop is not set.
    if (_occlusionMode != nil && [_occlusionMode caseInsensitiveCompare:@"depthBased"] == NSOrderedSame)
        return VROOcclusionMode::DepthBased;
    if (_occlusionMode != nil && [_occlusionMode caseInsensitiveCompare:@"peopleOnly"] == NSOrderedSame)
        return VROOcclusionMode::PeopleOnly;
    // depthEnabled activates depth sensing without occlusion rendering
    if (_depthEnabled)
        return VROOcclusionMode::DepthOnly;
    return VROOcclusionMode::Disabled;
}

- (void)setOcclusionMode:(NSString *)occlusionMode {
    _occlusionMode = occlusionMode;
    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        if (arSession) {
            arSession->setOcclusionMode([self computeEffectiveOcclusionMode]);
        }
    }
}

- (void)setDepthEnabled:(BOOL)depthEnabled {
    _depthEnabled = depthEnabled;
    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        if (arSession) {
            arSession->setOcclusionMode([self computeEffectiveOcclusionMode]);
        }
    }
}

- (void)setDepthDebugEnabled:(BOOL)depthDebugEnabled {
    _depthDebugEnabled = depthDebugEnabled;
    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        [viewAR setDepthDebugEnabled:depthDebugEnabled opacity:0.7f];
    }
}

/*
 Unproject the given screen coordinates into world coordinates. The given screen coordinate vector must
 contain a Z element in the range [0,1], where 0 is the near clipping plane and 1 the far clipping plane.
 */
-(VROVector3f) unprojectPoint:(VROVector3f)point {
    if(_vroView == nil || _vroView.renderer == nil) {
        RCTLogError(@"Unable to unproject. Renderer not intialized");
    }
    
    VROVector3f unprojectedPoint = [_vroView unprojectPoint:point];
    return unprojectedPoint;
}

// Project the given world coordinates into screen coordinates.
-(VROVector3f) projectPoint:(VROVector3f)point {
    if(_vroView == nil || _vroView.renderer == nil) {
        RCTLogError(@"Unable to unproject. Renderer not intialized");
    }
    
    VROVector3f projectedPoint = [_vroView projectPoint:point];
    return projectedPoint;
}

#pragma mark - Cloud Anchor Helpers

/**
 * Improvement 2: split "message|StateString" encoded by the C++ layer
 * (encodeError in VROCloudAnchorProviderReactVision.mm) into separate components.
 * Falls back to [raw, "ErrorInternal"] when the separator is absent (ARCore path).
 */
static void splitErrorState(NSString *raw, NSString * __autoreleasing *outMsg, NSString * __autoreleasing *outState) {
    NSRange sep = [raw rangeOfString:@"|" options:NSBackwardsSearch];
    if (sep.location != NSNotFound) {
        *outMsg   = [raw substringToIndex:sep.location];
        *outState = [raw substringFromIndex:sep.location + 1];
    } else {
        *outMsg   = raw;
        *outState = @"ErrorInternal";
    }
}

#pragma mark - Cloud Anchor Methods

- (void)setCloudAnchorProvider:(NSString *)cloudAnchorProvider {
    _cloudAnchorProvider = cloudAnchorProvider;

    RCTLogInfo(@"[ViroAR] Setting cloud anchor provider: %@", cloudAnchorProvider ?: @"none");

    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        if (arSession) {
            if ([cloudAnchorProvider caseInsensitiveCompare:@"arcore"] == NSOrderedSame) {
                arSession->setCloudAnchorProvider(VROCloudAnchorProvider::ARCore);
                RCTLogInfo(@"[ViroAR] ARCore Cloud Anchors provider enabled");

                // Check if API key is configured
                NSString *apiKey = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"GARAPIKey"];
                if (apiKey && apiKey.length > 0) {
                    RCTLogInfo(@"[ViroAR] GARAPIKey found in Info.plist (length: %lu)", (unsigned long)apiKey.length);
                } else {
                    RCTLogWarn(@"[ViroAR] WARNING: GARAPIKey not found in Info.plist. Cloud anchors will not work!");
                }
            } else if ([cloudAnchorProvider caseInsensitiveCompare:@"reactvision"] == NSOrderedSame) {
                arSession->setCloudAnchorProvider(VROCloudAnchorProvider::ReactVision);
                RCTLogInfo(@"[ViroAR] ReactVision Cloud Anchors provider enabled");

                // Check if ReactVision credentials are configured
                NSString *rvApiKey = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RVApiKey"];
                NSString *rvProjectId = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RVProjectId"];
                if (!rvApiKey || rvApiKey.length == 0) {
                    RCTLogWarn(@"[ViroAR] WARNING: RVApiKey not found in Info.plist. ReactVision cloud anchors will not work!");
                }
                if (!rvProjectId || rvProjectId.length == 0) {
                    RCTLogWarn(@"[ViroAR] WARNING: RVProjectId not found in Info.plist. ReactVision cloud anchors will not work!");
                }
            } else {
                arSession->setCloudAnchorProvider(VROCloudAnchorProvider::None);
                RCTLogInfo(@"[ViroAR] Cloud Anchors disabled");
            }
        } else {
            RCTLogWarn(@"[ViroAR] AR session not available, cannot set cloud anchor provider");
        }
    } else {
        RCTLogInfo(@"[ViroAR] VROView not ready yet, cloud anchor provider will be set later");
    }
}

- (void)hostCloudAnchor:(NSString *)anchorId
                ttlDays:(NSInteger)ttlDays
      completionHandler:(CloudAnchorHostCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR view not initialized", @"ErrorInternal");
        }
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR session not available", @"ErrorInternal");
        }
        return;
    }

    // Find the anchor by ID
    std::string anchorIdStr = std::string([anchorId UTF8String]);
    std::shared_ptr<VROARAnchor> anchor = nullptr;

    // Search through frame anchors
    std::unique_ptr<VROARFrame> &frame = arSession->getLastFrame();
    if (frame) {
        const std::vector<std::shared_ptr<VROARAnchor>> &anchors = frame->getAnchors();
        for (const auto &a : anchors) {
            if (a->getId() == anchorIdStr) {
                anchor = a;
                break;
            }
        }
    }

    if (!anchor) {
        if (completionHandler) {
            completionHandler(NO, nil, @"Anchor not found in session", @"ErrorCloudIdNotFound");
        }
        return;
    }

    // Host the anchor with TTL
    arSession->hostCloudAnchor(anchor,
        (int)ttlDays,
        [completionHandler](std::shared_ptr<VROARAnchor> hostedAnchor) {
            // Success callback
            if (completionHandler) {
                NSString *cloudId = [NSString stringWithUTF8String:hostedAnchor->getCloudAnchorId().c_str()];
                completionHandler(YES, cloudId, nil, @"Success");
            }
        },
        [completionHandler](std::string error) {
            // Failure callback — Improvement 2: parse encoded "|StateString"
            if (completionHandler) {
                NSString *raw = [NSString stringWithUTF8String:error.c_str()];
                NSString *msg, *state;
                splitErrorState(raw, &msg, &state);
                completionHandler(NO, nil, msg, state);
            }
        }
    );
}

- (void)resolveCloudAnchor:(NSString *)cloudAnchorId
         completionHandler:(CloudAnchorResolveCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR view not initialized", @"ErrorInternal");
        }
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR session not available", @"ErrorInternal");
        }
        return;
    }

    std::string cloudIdStr = std::string([cloudAnchorId UTF8String]);

    // Resolve the anchor
    arSession->resolveCloudAnchor(cloudIdStr,
        [completionHandler](std::shared_ptr<VROARAnchor> resolvedAnchor) {
            // Success callback - convert anchor to dictionary
            if (completionHandler) {
                VROMatrix4f transform = resolvedAnchor->getTransform();
                VROVector3f position = transform.extractTranslation();
                VROVector3f scale = transform.extractScale();
                VROVector3f rotation = transform.extractRotation(scale).toEuler();

                NSDictionary *anchorData = @{
                    @"anchorId": [NSString stringWithUTF8String:resolvedAnchor->getId().c_str()],
                    @"cloudAnchorId": [NSString stringWithUTF8String:resolvedAnchor->getCloudAnchorId().c_str()],
                    @"state": @"Success",
                    @"position": @[@(position.x), @(position.y), @(position.z)],
                    @"rotation": @[@(toDegrees(rotation.x)), @(toDegrees(rotation.y)), @(toDegrees(rotation.z))],
                    @"scale": @[@(scale.x), @(scale.y), @(scale.z)]
                };
                completionHandler(YES, anchorData, nil, @"Success");
            }
        },
        [completionHandler](std::string error) {
            // Failure callback — Improvement 2: parse encoded "|StateString"
            if (completionHandler) {
                NSString *raw = [NSString stringWithUTF8String:error.c_str()];
                NSString *msg, *state;
                splitErrorState(raw, &msg, &state);
                completionHandler(NO, nil, msg, state);
            }
        }
    );
}

- (void)cancelCloudAnchorOperations {
    // Currently a no-op - cloud operations are fire-and-forget
    // Future implementation could track and cancel pending operations
}

#pragma mark - Geospatial API Methods

- (void)setGeospatialAnchorProvider:(NSString *)geospatialAnchorProvider {
    _geospatialAnchorProvider = geospatialAnchorProvider;

    RCTLogInfo(@"[ViroAR] Setting geospatial anchor provider: %@", geospatialAnchorProvider ?: @"none");

    if (_vroView) {
        VROViewAR *viewAR = (VROViewAR *) _vroView;
        std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
        if (arSession) {
            if ([geospatialAnchorProvider caseInsensitiveCompare:@"arcore"] == NSOrderedSame) {
                arSession->setGeospatialAnchorProvider(VROGeospatialAnchorProvider::ARCoreGeospatial);
                RCTLogInfo(@"[ViroAR] ARCore Geospatial provider enabled");

                // Check if API key is configured
                NSString *apiKey = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"GARAPIKey"];
                if (apiKey && apiKey.length > 0) {
                    RCTLogInfo(@"[ViroAR] GARAPIKey found in Info.plist (length: %lu)", (unsigned long)apiKey.length);
                } else {
                    RCTLogWarn(@"[ViroAR] WARNING: GARAPIKey not found in Info.plist. Geospatial features will not work!");
                }
            } else if ([geospatialAnchorProvider caseInsensitiveCompare:@"reactvision"] == NSOrderedSame) {
                arSession->setGeospatialAnchorProvider(VROGeospatialAnchorProvider::ReactVision);
                RCTLogInfo(@"[ViroAR] ReactVision Geospatial provider enabled");

                // Check that credentials are present in Info.plist
                NSString *rvApiKey = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RVApiKey"];
                if (rvApiKey && rvApiKey.length > 0) {
                    RCTLogInfo(@"[ViroAR] RVApiKey found in Info.plist");
                } else {
                    RCTLogWarn(@"[ViroAR] WARNING: RVApiKey not found in Info.plist. ReactVision Geospatial will not work!");
                }
            } else {
                arSession->setGeospatialAnchorProvider(VROGeospatialAnchorProvider::None);
                RCTLogInfo(@"[ViroAR] Geospatial provider disabled");
            }
        } else {
            RCTLogWarn(@"[ViroAR] AR session not available, cannot set geospatial provider");
        }
    } else {
        RCTLogInfo(@"[ViroAR] VROView not ready yet, geospatial provider will be set later");
    }
}

- (BOOL)isGeospatialModeSupported {
    if (!_vroView) {
        return NO;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return NO;
    }

    return arSession->isGeospatialModeSupported();
}

- (void)setGeospatialModeEnabled:(BOOL)enabled {
    _pendingGeospatialModeEnabled = enabled;

    if (!_vroView) {
        _needsGeospatialModeApply = YES;
        RCTLogInfo(@"[ViroAR] Geospatial mode queued for later: %@", enabled ? @"enabled" : @"disabled");
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        _needsGeospatialModeApply = YES;
        RCTLogInfo(@"[ViroAR] Geospatial mode queued for later: %@", enabled ? @"enabled" : @"disabled");
        return;
    }

    [self applyGeospatialModeEnabled];
}

- (void)applyGeospatialModeEnabled {
    if (!_vroView) {
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return;
    }

    arSession->setGeospatialModeEnabled(_pendingGeospatialModeEnabled);
    _needsGeospatialModeApply = NO;
    RCTLogInfo(@"[ViroAR] Geospatial mode applied: %@", _pendingGeospatialModeEnabled ? @"enabled" : @"disabled");
}

- (NSString *)getEarthTrackingState {
    if (!_vroView) {
        return @"Stopped";
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return @"Stopped";
    }

    VROEarthTrackingState state = arSession->getEarthTrackingState();
    switch (state) {
        case VROEarthTrackingState::Enabled:
            return @"Enabled";
        case VROEarthTrackingState::Paused:
            return @"Paused";
        case VROEarthTrackingState::Stopped:
        default:
            return @"Stopped";
    }
}

- (void)getCameraGeospatialPose:(GeospatialPoseCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR view not initialized");
        }
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR session not available");
        }
        return;
    }

    VROGeospatialPose pose = arSession->getCameraGeospatialPose();

    // Check if pose is valid (latitude and longitude are non-zero)
    if (pose.latitude == 0 && pose.longitude == 0) {
        if (completionHandler) {
            completionHandler(NO, nil, @"Geospatial pose not available");
        }
        return;
    }

    NSDictionary *poseData = @{
        @"latitude": @(pose.latitude),
        @"longitude": @(pose.longitude),
        @"altitude": @(pose.altitude),
        @"heading": @(pose.heading),
        @"quaternion": @[@(pose.quaternion.X), @(pose.quaternion.Y),
                         @(pose.quaternion.Z), @(pose.quaternion.W)],
        @"horizontalAccuracy": @(pose.horizontalAccuracy),
        @"verticalAccuracy": @(pose.verticalAccuracy),
        @"headingAccuracy": @(pose.headingAccuracy),
        @"orientationYawAccuracy": @(pose.orientationYawAccuracy)
    };

    if (completionHandler) {
        completionHandler(YES, poseData, nil);
    }
}

- (void)checkVPSAvailability:(double)latitude
                   longitude:(double)longitude
           completionHandler:(VPSAvailabilityCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) {
            completionHandler(@"Unknown");
        }
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) {
            completionHandler(@"Unknown");
        }
        return;
    }

    arSession->checkVPSAvailability(latitude, longitude, [completionHandler](VROVPSAvailability availability) {
        NSString *availabilityString;
        switch (availability) {
            case VROVPSAvailability::Available:
                availabilityString = @"Available";
                break;
            case VROVPSAvailability::Unavailable:
                availabilityString = @"Unavailable";
                break;
            case VROVPSAvailability::Unknown:
            default:
                availabilityString = @"Unknown";
                break;
        }
        if (completionHandler) {
            completionHandler(availabilityString);
        }
    });
}

// Helper method to parse quaternion from either array [x, y, z, w] or dictionary {x, y, z, w}
- (VROQuaternion)parseQuaternion:(id)quaternion {
    VROQuaternion quat(0, 0, 0, 1); // Default identity quaternion

    if (!quaternion) {
        return quat;
    }

    @try {
        if ([quaternion isKindOfClass:[NSArray class]]) {
            NSArray *arr = (NSArray *)quaternion;
            if (arr.count >= 4) {
                quat = VROQuaternion([[arr objectAtIndex:0] floatValue],
                                     [[arr objectAtIndex:1] floatValue],
                                     [[arr objectAtIndex:2] floatValue],
                                     [[arr objectAtIndex:3] floatValue]);
            }
        } else if ([quaternion isKindOfClass:[NSDictionary class]]) {
            NSDictionary *dict = (NSDictionary *)quaternion;
            float x = dict[@"x"] ? [dict[@"x"] floatValue] : 0;
            float y = dict[@"y"] ? [dict[@"y"] floatValue] : 0;
            float z = dict[@"z"] ? [dict[@"z"] floatValue] : 0;
            float w = dict[@"w"] ? [dict[@"w"] floatValue] : 1;
            quat = VROQuaternion(x, y, z, w);
        }
    } @catch (NSException *exception) {
        NSLog(@"[VRTARSceneNavigator] Failed to parse quaternion, using identity: %@", exception.reason);
    }

    return quat;
}

- (void)createGeospatialAnchor:(double)latitude
                     longitude:(double)longitude
                      altitude:(double)altitude
                    quaternion:(id)quaternion
             completionHandler:(GeospatialAnchorCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR view not initialized");
        }
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR session not available");
        }
        return;
    }

    // Parse quaternion (accepts both array [x, y, z, w] and dictionary {x, y, z, w})
    VROQuaternion quat = [self parseQuaternion:quaternion];

    arSession->createGeospatialAnchor(latitude, longitude, altitude, quat,
        [completionHandler](std::shared_ptr<VROGeospatialAnchor> anchor) {
            // Success callback
            if (completionHandler) {
                VROMatrix4f transform = anchor->getTransform();
                VROVector3f position = transform.extractTranslation();

                NSDictionary *anchorData = @{
                    @"anchorId": [NSString stringWithUTF8String:anchor->getId().c_str()],
                    @"type": @"WGS84",
                    @"latitude": @(anchor->getLatitude()),
                    @"longitude": @(anchor->getLongitude()),
                    @"altitude": @(anchor->getAltitude()),
                    @"heading": @(anchor->getHeading()),
                    @"position": @[@(position.x), @(position.y), @(position.z)]
                };
                completionHandler(YES, anchorData, nil);
            }
        },
        [completionHandler](std::string error) {
            // Failure callback
            if (completionHandler) {
                NSString *errorStr = [NSString stringWithUTF8String:error.c_str()];
                completionHandler(NO, nil, errorStr);
            }
        }
    );
}

- (void)hostGeospatialAnchor:(double)latitude
                   longitude:(double)longitude
                    altitude:(double)altitude
               altitudeMode:(NSString *)altitudeMode
           completionHandler:(void (^)(BOOL success, NSString *platformUuid, NSString *error))completionHandler {
    if (!_vroView) {
        if (completionHandler) completionHandler(NO, nil, @"AR view not initialized");
        return;
    }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) completionHandler(NO, nil, @"AR session not available");
        return;
    }
    std::string modeStr = altitudeMode ? std::string([altitudeMode UTF8String]) : "street_level";
    arSession->hostGeospatialAnchor(latitude, longitude, altitude, modeStr,
        [completionHandler](std::string platformUuid) {
            if (completionHandler) {
                completionHandler(YES, [NSString stringWithUTF8String:platformUuid.c_str()], nil);
            }
        },
        [completionHandler](std::string error) {
            if (completionHandler) {
                completionHandler(NO, nil, [NSString stringWithUTF8String:error.c_str()]);
            }
        }
    );
}

- (void)resolveGeospatialAnchor:(NSString *)platformUuid
                      quaternion:(id)quaternion
              completionHandler:(GeospatialAnchorCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) completionHandler(NO, nil, @"AR view not initialized");
        return;
    }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) completionHandler(NO, nil, @"AR session not available");
        return;
    }
    VROQuaternion quat = [self parseQuaternion:quaternion];
    std::string uuidStr = std::string([platformUuid UTF8String]);
    arSession->resolveGeospatialAnchor(uuidStr, quat,
        [completionHandler](std::shared_ptr<VROGeospatialAnchor> anchor) {
            if (completionHandler) {
                VROMatrix4f transform = anchor->getTransform();
                VROVector3f position = transform.extractTranslation();
                NSDictionary *anchorData = @{
                    @"anchorId": [NSString stringWithUTF8String:anchor->getId().c_str()],
                    @"type": @"WGS84",
                    @"latitude": @(anchor->getLatitude()),
                    @"longitude": @(anchor->getLongitude()),
                    @"altitude": @(anchor->getAltitude()),
                    @"heading": @(anchor->getHeading()),
                    @"position": @[@(position.x), @(position.y), @(position.z)]
                };
                completionHandler(YES, anchorData, nil);
            }
        },
        [completionHandler](std::string error) {
            if (completionHandler) {
                completionHandler(NO, nil, [NSString stringWithUTF8String:error.c_str()]);
            }
        }
    );
}

- (void)createTerrainAnchor:(double)latitude
                  longitude:(double)longitude
        altitudeAboveTerrain:(double)altitudeAboveTerrain
                  quaternion:(id)quaternion
           completionHandler:(GeospatialAnchorCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR view not initialized");
        }
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR session not available");
        }
        return;
    }

    // Parse quaternion (accepts both array [x, y, z, w] and dictionary {x, y, z, w})
    VROQuaternion quat = [self parseQuaternion:quaternion];

    arSession->createTerrainAnchor(latitude, longitude, altitudeAboveTerrain, quat,
        [completionHandler](std::shared_ptr<VROGeospatialAnchor> anchor) {
            if (completionHandler) {
                VROMatrix4f transform = anchor->getTransform();
                VROVector3f position = transform.extractTranslation();

                NSDictionary *anchorData = @{
                    @"anchorId": [NSString stringWithUTF8String:anchor->getId().c_str()],
                    @"type": @"Terrain",
                    @"latitude": @(anchor->getLatitude()),
                    @"longitude": @(anchor->getLongitude()),
                    @"altitude": @(anchor->getAltitude()),
                    @"heading": @(anchor->getHeading()),
                    @"position": @[@(position.x), @(position.y), @(position.z)]
                };
                completionHandler(YES, anchorData, nil);
            }
        },
        [completionHandler](std::string error) {
            if (completionHandler) {
                NSString *errorStr = [NSString stringWithUTF8String:error.c_str()];
                completionHandler(NO, nil, errorStr);
            }
        }
    );
}

- (void)createRooftopAnchor:(double)latitude
                  longitude:(double)longitude
       altitudeAboveRooftop:(double)altitudeAboveRooftop
                  quaternion:(id)quaternion
           completionHandler:(GeospatialAnchorCompletionHandler)completionHandler {
    if (!_vroView) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR view not initialized");
        }
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) {
            completionHandler(NO, nil, @"AR session not available");
        }
        return;
    }

    // Parse quaternion (accepts both array [x, y, z, w] and dictionary {x, y, z, w})
    VROQuaternion quat = [self parseQuaternion:quaternion];

    arSession->createRooftopAnchor(latitude, longitude, altitudeAboveRooftop, quat,
        [completionHandler](std::shared_ptr<VROGeospatialAnchor> anchor) {
            if (completionHandler) {
                VROMatrix4f transform = anchor->getTransform();
                VROVector3f position = transform.extractTranslation();

                NSDictionary *anchorData = @{
                    @"anchorId": [NSString stringWithUTF8String:anchor->getId().c_str()],
                    @"type": @"Rooftop",
                    @"latitude": @(anchor->getLatitude()),
                    @"longitude": @(anchor->getLongitude()),
                    @"altitude": @(anchor->getAltitude()),
                    @"heading": @(anchor->getHeading()),
                    @"position": @[@(position.x), @(position.y), @(position.z)]
                };
                completionHandler(YES, anchorData, nil);
            }
        },
        [completionHandler](std::string error) {
            if (completionHandler) {
                NSString *errorStr = [NSString stringWithUTF8String:error.c_str()];
                completionHandler(NO, nil, errorStr);
            }
        }
    );
}

- (void)removeGeospatialAnchor:(NSString *)anchorId {
    if (!_vroView) {
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return;
    }

    // Geospatial anchors are not in the ARKit frame anchor list (they are GPS-computed,
    // not ARKit-tracked). Construct a minimal anchor with just the ID and delegate
    // removal to the session, which uses getId() for the backend API call.
    std::string anchorIdStr = std::string([anchorId UTF8String]);
    auto geoAnchor = std::make_shared<VROGeospatialAnchor>(
        VROGeospatialAnchorType::WGS84, 0, 0, 0, VROQuaternion());
    geoAnchor->setId(anchorIdStr);
    arSession->removeGeospatialAnchor(geoAnchor);
}

static NSDictionary *rvParseAnchorJson(NSString *json) {
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) return nil;
    return [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
}

static NSArray *rvParseAnchorArrayJson(NSString *json) {
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) return @[];
    id obj = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    return [obj isKindOfClass:[NSArray class]] ? obj : @[];
}

- (void)rvGetGeospatialAnchor:(NSString *)anchorId
            completionHandler:(void (^)(BOOL success, NSDictionary *anchorData, NSString *error))completionHandler {
    if (!_vroView) {
        if (completionHandler) completionHandler(NO, nil, @"AR view not initialized");
        return;
    }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) completionHandler(NO, nil, @"AR session not available");
        return;
    }
    arSession->rvGetGeospatialAnchor(
        std::string([anchorId UTF8String]),
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                if (success) {
                    NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                    completionHandler(YES, rvParseAnchorJson(jsonStr), nil);
                } else {
                    completionHandler(NO, nil, [NSString stringWithUTF8String:error.c_str()]);
                }
            }
        });
}

- (void)rvFindNearbyGeospatialAnchors:(double)latitude
                            longitude:(double)longitude
                               radius:(double)radius
                                limit:(int)limit
                    completionHandler:(void (^)(BOOL success, NSArray *anchors, NSString *error))completionHandler {
    if (!_vroView) {
        if (completionHandler) completionHandler(NO, @[], @"AR view not initialized");
        return;
    }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) completionHandler(NO, @[], @"AR session not available");
        return;
    }
    arSession->rvFindNearbyGeospatialAnchors(latitude, longitude, radius, limit,
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                if (success) {
                    NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                    completionHandler(YES, rvParseAnchorArrayJson(jsonStr), nil);
                } else {
                    completionHandler(NO, @[], [NSString stringWithUTF8String:error.c_str()]);
                }
            }
        });
}

- (void)rvUpdateGeospatialAnchor:(NSString *)anchorId
                    sceneAssetId:(NSString *)sceneAssetId
                         sceneId:(NSString *)sceneId
                            name:(NSString *)name
                     userAssetId:(NSString *)userAssetId
               completionHandler:(void (^)(BOOL success, NSDictionary *anchorData, NSString *error))completionHandler {
    if (!_vroView) {
        if (completionHandler) completionHandler(NO, nil, @"AR view not initialized");
        return;
    }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) completionHandler(NO, nil, @"AR session not available");
        return;
    }
    arSession->rvUpdateGeospatialAnchor(
        std::string([anchorId UTF8String]),
        sceneAssetId ? std::string([sceneAssetId UTF8String]) : "",
        sceneId      ? std::string([sceneId UTF8String])      : "",
        name         ? std::string([name UTF8String])         : "",
        userAssetId  ? std::string([userAssetId UTF8String])  : "",
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                if (success) {
                    NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                    completionHandler(YES, rvParseAnchorJson(jsonStr), nil);
                } else {
                    completionHandler(NO, nil, [NSString stringWithUTF8String:error.c_str()]);
                }
            }
        });
}

- (void)rvUploadAsset:(NSString *)filePath
            assetType:(NSString *)assetType
             fileName:(NSString *)fileName
           appUserId:(NSString *)appUserId
    completionHandler:(void (^)(BOOL success, NSString *userAssetId, NSString *fileUrl, NSString *error))completionHandler {
    if (!_vroView) {
        if (completionHandler) completionHandler(NO, nil, nil, @"AR view not initialized");
        return;
    }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) completionHandler(NO, nil, nil, @"AR session not available");
        return;
    }
    arSession->rvUploadAsset(
        std::string([filePath UTF8String]),
        assetType  ? std::string([assetType UTF8String])  : "",
        fileName   ? std::string([fileName UTF8String])   : "",
        appUserId  ? std::string([appUserId UTF8String])  : "",
        [completionHandler](bool success, std::string assetId, std::string fileUrl, std::string error) {
            if (completionHandler) {
                if (success) {
                    completionHandler(YES,
                        [NSString stringWithUTF8String:assetId.c_str()],
                        [NSString stringWithUTF8String:fileUrl.c_str()],
                        nil);
                } else {
                    completionHandler(NO, nil, nil, [NSString stringWithUTF8String:error.c_str()]);
                }
            }
        });
}

- (void)rvDeleteGeospatialAnchor:(NSString *)anchorId
               completionHandler:(void (^)(BOOL success, NSString *error))completionHandler {
    if (!_vroView) {
        if (completionHandler) completionHandler(NO, @"AR view not initialized");
        return;
    }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        if (completionHandler) completionHandler(NO, @"AR session not available");
        return;
    }
    arSession->rvDeleteGeospatialAnchor(
        std::string([anchorId UTF8String]),
        [completionHandler](bool success, std::string error) {
            if (completionHandler) {
                completionHandler(success, success ? nil : [NSString stringWithUTF8String:error.c_str()]);
            }
        });
}

- (void)rvListGeospatialAnchors:(int)limit
                         offset:(int)offset
              completionHandler:(void (^)(BOOL, NSArray *, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, @[], @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, @[], @"AR session not available"); return; }
    arSession->rvListGeospatialAnchors(limit, offset,
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                completionHandler(success, success ? rvParseAnchorArrayJson(jsonStr) : @[],
                    success ? nil : [NSString stringWithUTF8String:error.c_str()]);
            }
        });
}

// ── Cloud anchor management ───────────────────────────────────────────────────

- (void)rvGetCloudAnchor:(NSString *)anchorId
       completionHandler:(void (^)(BOOL, NSDictionary *, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, nil, @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, nil, @"AR session not available"); return; }
    arSession->rvGetCloudAnchor(std::string([anchorId UTF8String]),
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                completionHandler(success, success ? rvParseAnchorJson(jsonStr) : nil,
                    success ? nil : [NSString stringWithUTF8String:error.c_str()]);
            }
        });
}

- (void)rvListCloudAnchors:(int)limit
                    offset:(int)offset
         completionHandler:(void (^)(BOOL, NSArray *, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, @[], @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, @[], @"AR session not available"); return; }
    arSession->rvListCloudAnchors(limit, offset,
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                completionHandler(success, success ? rvParseAnchorArrayJson(jsonStr) : @[],
                    success ? nil : [NSString stringWithUTF8String:error.c_str()]);
            }
        });
}

- (void)rvUpdateCloudAnchor:(NSString *)anchorId
                       name:(NSString *)name
                description:(NSString *)description
                   isPublic:(BOOL)isPublic
          completionHandler:(void (^)(BOOL, NSDictionary *, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, nil, @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, nil, @"AR session not available"); return; }
    arSession->rvUpdateCloudAnchor(
        std::string([anchorId UTF8String]),
        name        ? std::string([name UTF8String])        : "",
        description ? std::string([description UTF8String]) : "",
        (bool)isPublic,
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                completionHandler(success, success ? rvParseAnchorJson(jsonStr) : nil,
                    success ? nil : [NSString stringWithUTF8String:error.c_str()]);
            }
        });
}

- (void)rvDeleteCloudAnchor:(NSString *)anchorId
          completionHandler:(void (^)(BOOL, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, @"AR session not available"); return; }
    arSession->rvDeleteCloudAnchor(std::string([anchorId UTF8String]),
        [completionHandler](bool success, std::string error) {
            if (completionHandler)
                completionHandler(success, success ? nil : [NSString stringWithUTF8String:error.c_str()]);
        });
}

- (void)rvFindNearbyCloudAnchors:(double)latitude
                       longitude:(double)longitude
                          radius:(double)radius
                           limit:(int)limit
               completionHandler:(void (^)(BOOL, NSArray *, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, @[], @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, @[], @"AR session not available"); return; }
    arSession->rvFindNearbyCloudAnchors(latitude, longitude, radius, limit,
        [completionHandler](bool success, std::string jsonData, std::string error) {
            if (completionHandler) {
                NSString *jsonStr = [NSString stringWithUTF8String:jsonData.c_str()];
                completionHandler(success, success ? rvParseAnchorArrayJson(jsonStr) : @[],
                    success ? nil : [NSString stringWithUTF8String:error.c_str()]);
            }
        });
}

- (void)rvAttachAssetToCloudAnchor:(NSString *)anchorId
                           fileUrl:(NSString *)fileUrl
                          fileSize:(int64_t)fileSize
                              name:(NSString *)name
                         assetType:(NSString *)assetType
                    externalUserId:(NSString *)externalUserId
                 completionHandler:(void (^)(BOOL, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, @"AR session not available"); return; }
    arSession->rvAttachAssetToCloudAnchor(
        std::string([anchorId UTF8String]),
        std::string([fileUrl UTF8String]),
        fileSize,
        name           ? std::string([name UTF8String])           : "",
        assetType      ? std::string([assetType UTF8String])      : "",
        externalUserId ? std::string([externalUserId UTF8String]) : "",
        [completionHandler](bool success, std::string error) {
            if (completionHandler)
                completionHandler(success, success ? nil : [NSString stringWithUTF8String:error.c_str()]);
        });
}

- (void)rvRemoveAssetFromCloudAnchor:(NSString *)anchorId
                             assetId:(NSString *)assetId
                   completionHandler:(void (^)(BOOL, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, @"AR session not available"); return; }
    arSession->rvRemoveAssetFromCloudAnchor(
        std::string([anchorId UTF8String]),
        std::string([assetId UTF8String]),
        [completionHandler](bool success, std::string error) {
            if (completionHandler)
                completionHandler(success, success ? nil : [NSString stringWithUTF8String:error.c_str()]);
        });
}

- (void)rvTrackCloudAnchorResolution:(NSString *)anchorId
                             success:(BOOL)success
                          confidence:(double)confidence
                          matchCount:(int)matchCount
                         inlierCount:(int)inlierCount
                    processingTimeMs:(int)processingTimeMs
                            platform:(NSString *)platform
                      externalUserId:(NSString *)externalUserId
                   completionHandler:(void (^)(BOOL, NSString *))completionHandler {
    if (!_vroView) { if (completionHandler) completionHandler(NO, @"AR view not initialized"); return; }
    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) { if (completionHandler) completionHandler(NO, @"AR session not available"); return; }
    arSession->rvTrackCloudAnchorResolution(
        std::string([anchorId UTF8String]),
        (bool)success, confidence, matchCount, inlierCount, processingTimeMs,
        platform       ? std::string([platform UTF8String])       : "",
        externalUserId ? std::string([externalUserId UTF8String]) : "",
        [completionHandler](bool ok, std::string error) {
            if (completionHandler)
                completionHandler(ok, ok ? nil : [NSString stringWithUTF8String:error.c_str()]);
        });
}

#pragma mark - Scene Semantics API Methods

- (BOOL)isSemanticModeSupported {
    if (!_vroView) {
        return NO;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return NO;
    }

    return arSession->isSemanticModeSupported();
}

- (void)setSemanticModeEnabled:(BOOL)enabled {
    _pendingSemanticModeEnabled = enabled;

    if (!_vroView) {
        _needsSemanticModeApply = YES;
        RCTLogInfo(@"[ViroAR] Scene Semantics mode queued for later: %@", enabled ? @"enabled" : @"disabled");
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        _needsSemanticModeApply = YES;
        RCTLogInfo(@"[ViroAR] Scene Semantics mode queued for later: %@", enabled ? @"enabled" : @"disabled");
        return;
    }

    [self applySemanticModeEnabled];
}

- (void)applySemanticModeEnabled {
    if (!_vroView) {
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return;
    }

    arSession->setSemanticModeEnabled(_pendingSemanticModeEnabled);
    _needsSemanticModeApply = NO;
    RCTLogInfo(@"[ViroAR] Scene Semantics mode applied: %@", _pendingSemanticModeEnabled ? @"enabled" : @"disabled");
}

- (NSDictionary *)getSemanticLabelFractions {
    NSMutableDictionary *fractions = [NSMutableDictionary new];

    if (!_vroView) {
        return fractions;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return fractions;
    }

    // Get the current frame and extract semantic fractions
    std::unique_ptr<VROARFrame> &frame = arSession->getLastFrame();
    if (!frame) {
        return fractions;
    }

    // Get fractions for all semantic labels
    NSArray *labels = @[@"unlabeled", @"sky", @"building", @"tree", @"road",
                        @"sidewalk", @"terrain", @"structure", @"object",
                        @"vehicle", @"person", @"water"];

    for (int i = 0; i < labels.count; i++) {
        VROSemanticLabel label = static_cast<VROSemanticLabel>(i);
        float fraction = frame->getSemanticLabelFraction(label);
        [fractions setObject:@(fraction) forKey:labels[i]];
    }

    return fractions;
}

- (float)getSemanticLabelFraction:(NSString *)label {
    if (!_vroView) {
        return 0.0f;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
    if (!arSession) {
        return 0.0f;
    }

    std::unique_ptr<VROARFrame> &frame = arSession->getLastFrame();
    if (!frame) {
        return 0.0f;
    }

    // Convert label string to VROSemanticLabel enum
    VROSemanticLabel semanticLabel = VROSemanticLabel::Unlabeled;
    if ([label caseInsensitiveCompare:@"unlabeled"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Unlabeled;
    } else if ([label caseInsensitiveCompare:@"sky"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Sky;
    } else if ([label caseInsensitiveCompare:@"building"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Building;
    } else if ([label caseInsensitiveCompare:@"tree"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Tree;
    } else if ([label caseInsensitiveCompare:@"road"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Road;
    } else if ([label caseInsensitiveCompare:@"sidewalk"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Sidewalk;
    } else if ([label caseInsensitiveCompare:@"terrain"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Terrain;
    } else if ([label caseInsensitiveCompare:@"structure"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Structure;
    } else if ([label caseInsensitiveCompare:@"object"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Object;
    } else if ([label caseInsensitiveCompare:@"vehicle"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Vehicle;
    } else if ([label caseInsensitiveCompare:@"person"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Person;
    } else if ([label caseInsensitiveCompare:@"water"] == NSOrderedSame) {
        semanticLabel = VROSemanticLabel::Water;
    } else {
        RCTLogWarn(@"[ViroAR] Unknown semantic label: %@", label);
        return 0.0f;
    }

    return frame->getSemanticLabelFraction(semanticLabel);
}

#pragma mark - World Mesh API Methods

- (void)setWorldMeshEnabled:(BOOL)worldMeshEnabled {
    _worldMeshEnabled = worldMeshEnabled;
    _pendingWorldMeshEnabled = worldMeshEnabled;

    if (!_vroView || !_currentScene) {
        _needsWorldMeshApply = YES;
        RCTLogInfo(@"[ViroAR] World mesh mode queued for later: %@", worldMeshEnabled ? @"enabled" : @"disabled");
        return;
    }

    [self applyWorldMeshEnabled];
}

- (void)setWorldMeshConfig:(NSDictionary *)worldMeshConfig {
    _worldMeshConfig = worldMeshConfig;

    if (worldMeshConfig) {
        // Parse config from dictionary
        if (worldMeshConfig[@"stride"]) {
            _worldMeshConfigCpp.stride = [worldMeshConfig[@"stride"] intValue];
        }
        if (worldMeshConfig[@"minConfidence"]) {
            _worldMeshConfigCpp.minConfidence = [worldMeshConfig[@"minConfidence"] floatValue];
        }
        if (worldMeshConfig[@"maxDepth"]) {
            _worldMeshConfigCpp.maxDepth = [worldMeshConfig[@"maxDepth"] floatValue];
        }
        if (worldMeshConfig[@"updateIntervalMs"]) {
            _worldMeshConfigCpp.updateIntervalMs = [worldMeshConfig[@"updateIntervalMs"] doubleValue];
        }
        if (worldMeshConfig[@"meshPersistenceMs"]) {
            _worldMeshConfigCpp.meshPersistenceMs = [worldMeshConfig[@"meshPersistenceMs"] doubleValue];
        }
        if (worldMeshConfig[@"friction"]) {
            _worldMeshConfigCpp.friction = [worldMeshConfig[@"friction"] floatValue];
        }
        if (worldMeshConfig[@"restitution"]) {
            _worldMeshConfigCpp.restitution = [worldMeshConfig[@"restitution"] floatValue];
        }
        if (worldMeshConfig[@"collisionTag"]) {
            _worldMeshConfigCpp.collisionTag = std::string([worldMeshConfig[@"collisionTag"] UTF8String]);
        }
        if (worldMeshConfig[@"debugDrawEnabled"]) {
            _worldMeshConfigCpp.debugDrawEnabled = [worldMeshConfig[@"debugDrawEnabled"] boolValue];
        }
    }

    // Apply to AR scene if ready
    if (_vroView && _currentScene) {
        std::shared_ptr<VROSceneController> sceneController = [_currentScene sceneController];
        if (sceneController) {
            std::shared_ptr<VROARScene> arScene = std::dynamic_pointer_cast<VROARScene>(sceneController->getScene());
            if (arScene) {
                arScene->setWorldMeshConfig(_worldMeshConfigCpp);
            }
        }
    }
}

- (void)applyWorldMeshEnabled {
    if (!_vroView || !_currentScene) {
        return;
    }

    std::shared_ptr<VROSceneController> sceneController = [_currentScene sceneController];
    if (!sceneController) {
        return;
    }

    std::shared_ptr<VROARScene> arScene = std::dynamic_pointer_cast<VROARScene>(sceneController->getScene());
    if (!arScene) {
        return;
    }

    // Apply config first, then enable
    arScene->setWorldMeshConfig(_worldMeshConfigCpp);
    arScene->setWorldMeshEnabled(_pendingWorldMeshEnabled);
    _needsWorldMeshApply = NO;

    RCTLogInfo(@"[ViroAR] World mesh applied: %@", _pendingWorldMeshEnabled ? @"enabled" : @"disabled");
}

#pragma mark - Monocular Depth Estimation API Methods

- (void)setPreferMonocularDepth:(BOOL)prefer {
    if (!_vroView) {
        RCTLogWarn(@"[ViroAR] Cannot set prefer monocular depth: AR view not initialized");
        return;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    [viewAR setPreferMonocularDepth:prefer];
    RCTLogInfo(@"[ViroAR] Prefer monocular depth %@", prefer ? @"enabled" : @"disabled");
}

- (BOOL)isPreferMonocularDepth {
    if (!_vroView) {
        return NO;
    }

    VROViewAR *viewAR = (VROViewAR *) _vroView;
    return [viewAR isPreferMonocularDepth];
}

#pragma mark RCTInvalidating methods

- (void)invalidate {
    if (_vroView) {
        // pause the view before removing it.
        VROViewAR *viewAR = (VROViewAR *)_vroView;
        [viewAR setPaused:YES];

        // Properly terminate the AR session and clean up GL resources
        @try {
            std::shared_ptr<VROARSession> arSession = [viewAR getARSession];
            if (arSession) {
                arSession->pause();
            }
            // Always call deleteGL to ensure proper resource cleanup
            [viewAR deleteGL];
        } @catch (NSException *exception) {
            NSLog(@"Error terminating AR session during invalidate: %@", exception.reason);
        }
    }

    // Destroy the EAGLContext to release GPU resources
    if (_eaglContext) {
        if ([EAGLContext currentContext] == _eaglContext) {
            [EAGLContext setCurrentContext:nil];
        }
        _eaglContext = nil;
    }

    //NOTE: DO NOT NULL OUT _currentViews here, that will cause a memory leak and prevent child views from being released.
    _currentScene = nil;
    _vroView = nil;
    _childViews = nil;
}
@end
