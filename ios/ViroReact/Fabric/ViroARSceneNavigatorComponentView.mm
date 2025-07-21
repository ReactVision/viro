//
//  ViroARSceneNavigatorComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroARSceneNavigatorComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <ARKit/ARKit.h>

@interface ViroARSceneNavigatorComponentView () <ARSessionDelegate>

// ViroReact AR Integration
@property (nonatomic, strong) std::shared_ptr<VROARSession> vroARSession;
@property (nonatomic, strong) std::shared_ptr<VROSceneNavigator> vroSceneNavigator;
@property (nonatomic, strong) std::shared_ptr<VRORenderer> vroRenderer;
@property (nonatomic, strong) std::shared_ptr<VROScene> vroCurrentScene;

// ARKit Integration
@property (nonatomic, strong) ARSession *arSession;
@property (nonatomic, strong) ARConfiguration *arConfiguration;
@property (nonatomic, strong) ARWorldTrackingConfiguration *worldTrackingConfig;

// AR Configuration Properties
@property (nonatomic, assign) BOOL planeDetectionEnabled;
@property (nonatomic, assign) BOOL lightEstimationEnabled;
@property (nonatomic, assign) BOOL occlusionEnabled;
@property (nonatomic, assign) NSString *worldAlignment;

@end

@implementation ViroARSceneNavigatorComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroARSceneNavigatorComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Initializing AR Scene Navigator");
        
        // Initialize default AR configuration
        _planeDetectionEnabled = YES;
        _lightEstimationEnabled = YES;
        _occlusionEnabled = NO;
        _worldAlignment = @"gravity";
        
        [self initializeARSession];
        [self initializeViroReactAR];
    }
    return self;
}

- (void)initializeARSession
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Initializing ARKit session");
    
    // Create ARSession
    _arSession = [[ARSession alloc] init];
    _arSession.delegate = self;
    
    // Create AR configuration
    if ([ARWorldTrackingConfiguration isSupported]) {
        _worldTrackingConfig = [[ARWorldTrackingConfiguration alloc] init];
        
        // Configure plane detection
        if (_planeDetectionEnabled) {
            _worldTrackingConfig.planeDetection = ARPlaneDetectionHorizontal | ARPlaneDetectionVertical;
        }
        
        // Configure light estimation
        if (_lightEstimationEnabled) {
            _worldTrackingConfig.lightEstimationMode = ARLightEstimationModeAmbientIntensity;
        }
        
        // Configure world alignment
        if ([_worldAlignment isEqualToString:@"gravity"]) {
            _worldTrackingConfig.worldAlignment = ARWorldAlignmentGravity;
        } else if ([_worldAlignment isEqualToString:@"gravityAndHeading"]) {
            _worldTrackingConfig.worldAlignment = ARWorldAlignmentGravityAndHeading;
        } else {
            _worldTrackingConfig.worldAlignment = ARWorldAlignmentCamera;
        }
        
        _arConfiguration = _worldTrackingConfig;
    }
    
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] ARKit session initialized");
}

- (void)initializeViroReactAR
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Initializing ViroReact AR integration");
    
    // Create ViroReact AR session
    _vroARSession = VROARSession::create();
    
    // Create ViroReact scene navigator
    _vroSceneNavigator = VROSceneNavigator::create();
    
    // Create ViroReact renderer for AR
    _vroRenderer = VRORenderer::createForAR();
    
    // Configure AR session with ARKit
    if (_arSession) {
        _vroARSession->setARKitSession(_arSession);
    }
    
    // Set up AR-specific rendering properties
    _vroRenderer->setAREnabled(true);
    _vroRenderer->setCameraEnabled(true);
    
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] ViroReact AR integration initialized");
}

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Starting AR session");
        [self startARSession];
    } else {
        RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Stopping AR session");
        [self stopARSession];
    }
}

- (void)startARSession
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Starting AR session");
    
    if (_arSession && _arConfiguration) {
        // Start ARKit session
        [_arSession runWithConfiguration:_arConfiguration];
        
        // Start ViroReact AR session
        if (_vroARSession) {
            _vroARSession->run();
        }
        
        // Start ViroReact renderer
        if (_vroRenderer) {
            _vroRenderer->startRendering();
        }
        
        RCTLogInfo(@"[ViroARSceneNavigatorComponentView] AR session started successfully");
    } else {
        RCTLogError(@"[ViroARSceneNavigatorComponentView] Cannot start AR session - missing configuration");
    }
}

- (void)stopARSession
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Stopping AR session");
    
    // Stop ViroReact renderer
    if (_vroRenderer) {
        _vroRenderer->stopRendering();
    }
    
    // Stop ViroReact AR session
    if (_vroARSession) {
        _vroARSession->pause();
    }
    
    // Stop ARKit session
    if (_arSession) {
        [_arSession pause];
    }
    
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] AR session stopped");
}

- (void)resetARSession
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Resetting AR session");
    
    if (_arSession && _arConfiguration) {
        ARSessionRunOptions options = ARSessionRunOptionResetTracking | ARSessionRunOptionRemoveExistingAnchors;
        [_arSession runWithConfiguration:_arConfiguration options:options];
        
        // Reset ViroReact AR session
        if (_vroARSession) {
            _vroARSession->reset();
        }
        
        RCTLogInfo(@"[ViroARSceneNavigatorComponentView] AR session reset completed");
    }
}

#pragma mark - ARSessionDelegate

- (void)session:(ARSession *)session didUpdateFrame:(ARFrame *)frame
{
    // Update ViroReact with new AR frame
    if (_vroARSession && _vroRenderer) {
        _vroARSession->updateWithFrame(frame);
        _vroRenderer->onFrameUpdate();
    }
}

- (void)session:(ARSession *)session didAddAnchors:(NSArray<ARAnchor *> *)anchors
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] AR anchors added: %lu", (unsigned long)anchors.count);
    
    // Process new anchors with ViroReact
    for (ARAnchor *anchor in anchors) {
        if (_vroARSession) {
            _vroARSession->addAnchor(anchor);
        }
    }
}

- (void)session:(ARSession *)session didUpdateAnchors:(NSArray<ARAnchor *> *)anchors
{
    // Update existing anchors with ViroReact
    for (ARAnchor *anchor in anchors) {
        if (_vroARSession) {
            _vroARSession->updateAnchor(anchor);
        }
    }
}

- (void)session:(ARSession *)session didRemoveAnchors:(NSArray<ARAnchor *> *)anchors
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] AR anchors removed: %lu", (unsigned long)anchors.count);
    
    // Remove anchors from ViroReact
    for (ARAnchor *anchor in anchors) {
        if (_vroARSession) {
            _vroARSession->removeAnchor(anchor);
        }
    }
}

- (void)session:(ARSession *)session didFailWithError:(NSError *)error
{
    RCTLogError(@"[ViroARSceneNavigatorComponentView] AR session failed with error: %@", error.localizedDescription);
    
    // Handle AR session failure
    [self stopARSession];
}

- (void)sessionWasInterrupted:(ARSession *)session
{
    RCTLogWarn(@"[ViroARSceneNavigatorComponentView] AR session was interrupted");
    
    // Pause ViroReact rendering during interruption
    if (_vroRenderer) {
        _vroRenderer->pause();
    }
}

- (void)sessionInterruptionEnded:(ARSession *)session
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] AR session interruption ended");
    
    // Resume ViroReact rendering
    if (_vroRenderer) {
        _vroRenderer->resume();
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroARSceneNavigatorComponentView] Deallocating");
    
    [self stopARSession];
    
    // Clean up ViroReact resources
    _vroARSession = nullptr;
    _vroSceneNavigator = nullptr;
    _vroRenderer = nullptr;
    _vroCurrentScene = nullptr;
    
    // Clean up ARKit resources
    _arSession.delegate = nil;
    _arSession = nil;
    _arConfiguration = nil;
    _worldTrackingConfig = nil;
}

@end