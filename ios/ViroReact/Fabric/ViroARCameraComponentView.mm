//
//  ViroARCameraComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroARCameraComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <ARKit/ARKit.h>

@interface ViroARCameraComponentView ()

// ViroReact AR Camera Integration
@property (nonatomic, strong) std::shared_ptr<VROARCamera> vroARCamera;
@property (nonatomic, strong) std::shared_ptr<VROCamera> vroCamera;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroCameraNode;

// AR Camera Configuration
@property (nonatomic, assign) BOOL active;
@property (nonatomic, assign) CGFloat fieldOfView;
@property (nonatomic, assign) CGFloat nearClippingPlane;
@property (nonatomic, assign) CGFloat farClippingPlane;
@property (nonatomic, assign) BOOL autoFocusEnabled;
@property (nonatomic, assign) BOOL autoWhiteBalanceEnabled;

// Camera Transform Properties
@property (nonatomic, strong) NSArray<NSNumber *> *position;
@property (nonatomic, strong) NSArray<NSNumber *> *rotation;
@property (nonatomic, strong) NSArray<NSNumber *> *lookAt;

// Camera Tracking Configuration
@property (nonatomic, assign) BOOL trackingEnabled;
@property (nonatomic, assign) NSString *trackingType;
@property (nonatomic, assign) BOOL worldTrackingEnabled;

@end

@implementation ViroARCameraComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroARCameraComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        RCTLogInfo(@"[ViroARCameraComponentView] Initializing AR Camera");
        
        // Initialize default AR camera configuration
        _active = YES;
        _fieldOfView = 75.0f;
        _nearClippingPlane = 0.1f;
        _farClippingPlane = 1000.0f;
        _autoFocusEnabled = YES;
        _autoWhiteBalanceEnabled = YES;
        _trackingEnabled = YES;
        _trackingType = @"worldTracking";
        _worldTrackingEnabled = YES;
        
        [self setupARCamera];
        [self initializeViroReactARCamera];
    }
    return self;
}

- (void)setupARCamera
{
    RCTLogInfo(@"[ViroARCameraComponentView] Setting up AR camera configuration");
    
    // Initialize default transform properties
    if (!_position) {
        _position = @[@0.0f, @0.0f, @0.0f];
    }
    if (!_rotation) {
        _rotation = @[@0.0f, @0.0f, @0.0f];
    }
    
    RCTLogInfo(@"[ViroARCameraComponentView] AR camera configuration completed");
}

- (void)initializeViroReactARCamera
{
    RCTLogInfo(@"[ViroARCameraComponentView] Initializing ViroReact AR camera");
    
    // Create ViroReact AR camera
    _vroARCamera = VROARCamera::create();
    
    // Create ViroReact camera for AR
    _vroCamera = VROCamera::create();
    
    // Create camera node
    _vroCameraNode = std::make_shared<VRONode>();
    _vroCameraNode->setCamera(_vroCamera);
    
    // Configure AR camera properties
    _vroARCamera->setTrackingEnabled(_trackingEnabled);
    _vroARCamera->setWorldTrackingEnabled(_worldTrackingEnabled);
    
    // Configure camera projection
    _vroCamera->setFieldOfView(_fieldOfView * M_PI / 180.0);
    _vroCamera->setNearClippingPlane(_nearClippingPlane);
    _vroCamera->setFarClippingPlane(_farClippingPlane);
    
    // Set camera as active if specified
    if (_active) {
        _vroCamera->setActive(true);
    }
    
    // Apply initial transform
    [self updateCameraTransform];
    
    RCTLogInfo(@"[ViroARCameraComponentView] ViroReact AR camera initialized successfully");
}

#pragma mark - AR Camera Configuration Methods

- (void)setActive:(BOOL)active
{
    _active = active;
    if (_vroCamera) {
        _vroCamera->setActive(active);
    }
    if (_vroARCamera) {
        _vroARCamera->setActive(active);
    }
    RCTLogInfo(@"[ViroARCameraComponentView] Camera active state set to: %@", active ? @"YES" : @"NO");
}

- (void)setFieldOfView:(CGFloat)fieldOfView
{
    _fieldOfView = fieldOfView;
    if (_vroCamera) {
        _vroCamera->setFieldOfView(fieldOfView * M_PI / 180.0);
    }
    RCTLogInfo(@"[ViroARCameraComponentView] Field of view set to: %.2f", fieldOfView);
}

- (void)setNearClippingPlane:(CGFloat)nearClippingPlane
{
    _nearClippingPlane = nearClippingPlane;
    if (_vroCamera) {
        _vroCamera->setNearClippingPlane(nearClippingPlane);
    }
}

- (void)setFarClippingPlane:(CGFloat)farClippingPlane
{
    _farClippingPlane = farClippingPlane;
    if (_vroCamera) {
        _vroCamera->setFarClippingPlane(farClippingPlane);
    }
}

- (void)setTrackingEnabled:(BOOL)trackingEnabled
{
    _trackingEnabled = trackingEnabled;
    if (_vroARCamera) {
        _vroARCamera->setTrackingEnabled(trackingEnabled);
    }
}

- (void)setTrackingType:(NSString *)trackingType
{
    _trackingType = trackingType;
    if (_vroARCamera) {
        if ([trackingType isEqualToString:@"worldTracking"]) {
            _vroARCamera->setTrackingType(VROARTrackingType::WorldTracking);
        } else if ([trackingType isEqualToString:@"faceTracking"]) {
            _vroARCamera->setTrackingType(VROARTrackingType::FaceTracking);
        } else if ([trackingType isEqualToString:@"imageTracking"]) {
            _vroARCamera->setTrackingType(VROARTrackingType::ImageTracking);
        } else {
            _vroARCamera->setTrackingType(VROARTrackingType::WorldTracking);
        }
    }
}

- (void)setWorldTrackingEnabled:(BOOL)worldTrackingEnabled
{
    _worldTrackingEnabled = worldTrackingEnabled;
    if (_vroARCamera) {
        _vroARCamera->setWorldTrackingEnabled(worldTrackingEnabled);
    }
}

#pragma mark - Camera Transform Methods

- (void)setPosition:(NSArray<NSNumber *> *)position
{
    _position = position;
    [self updateCameraTransform];
}

- (void)setRotation:(NSArray<NSNumber *> *)rotation
{
    _rotation = rotation;
    [self updateCameraTransform];
}

- (void)setLookAt:(NSArray<NSNumber *> *)lookAt
{
    _lookAt = lookAt;
    [self updateCameraTransform];
}

- (void)updateCameraTransform
{
    if (!_vroCameraNode) {
        return;
    }
    
    // Apply position
    if (_position && _position.count >= 3) {
        VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
        _vroCameraNode->setPosition(pos);
    }
    
    // Apply rotation
    if (_rotation && _rotation.count >= 3) {
        VROVector3f rot([_rotation[0] floatValue] * M_PI / 180.0,
                        [_rotation[1] floatValue] * M_PI / 180.0,
                        [_rotation[2] floatValue] * M_PI / 180.0);
        _vroCameraNode->setRotation(rot);
    }
    
    // Apply look-at target
    if (_lookAt && _lookAt.count >= 3) {
        VROVector3f target([_lookAt[0] floatValue], [_lookAt[1] floatValue], [_lookAt[2] floatValue]);
        _vroCameraNode->lookAt(target);
    }
}

#pragma mark - AR Camera Control Methods

- (void)resetTracking
{
    RCTLogInfo(@"[ViroARCameraComponentView] Resetting AR tracking");
    if (_vroARCamera) {
        _vroARCamera->resetTracking();
    }
}

- (void)setFocus:(CGPoint)focusPoint
{
    RCTLogInfo(@"[ViroARCameraComponentView] Setting focus point: (%.2f, %.2f)", focusPoint.x, focusPoint.y);
    if (_vroARCamera) {
        _vroARCamera->setFocusPoint(VROVector2f(focusPoint.x, focusPoint.y));
    }
}

- (void)setExposure:(CGPoint)exposurePoint
{
    RCTLogInfo(@"[ViroARCameraComponentView] Setting exposure point: (%.2f, %.2f)", exposurePoint.x, exposurePoint.y);
    if (_vroARCamera) {
        _vroARCamera->setExposurePoint(VROVector2f(exposurePoint.x, exposurePoint.y));
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroARCameraComponentView] Deallocating");
    
    // Clean up ViroReact AR camera resources
    _vroARCamera = nullptr;
    _vroCamera = nullptr;
    _vroCameraNode = nullptr;
}

@end