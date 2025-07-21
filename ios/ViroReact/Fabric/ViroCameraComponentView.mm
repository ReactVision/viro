//
//  ViroCameraComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroCameraComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>

@interface ViroCameraComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROCamera> vroCamera;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Camera position and orientation
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *position;
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *rotation;
@property (nonatomic, assign) CGFloat fieldOfView;

// Camera projection
@property (nonatomic, assign) CGFloat nearClippingPlane;
@property (nonatomic, assign) CGFloat farClippingPlane;
@property (nonatomic, strong, nullable) NSString *projectionType;
@property (nonatomic, assign) CGFloat focalLength;

// Camera animation and controls
@property (nonatomic, assign) CGFloat animationDuration;
@property (nonatomic, strong, nullable) NSString *animationType;

// Camera settings
@property (nonatomic, assign) BOOL active;

// Event blocks
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onTransformUpdate;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onCameraDidMount;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onCameraWillUnmount;

@end

@implementation ViroCameraComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroCameraComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        [self commonInit];
    }
    return self;
}

- (void)commonInit
{
    RCTLogInfo(@"[ViroCameraComponentView] Initializing");
    
    // Set default camera values
    _position = @[@0, @0, @0];
    _rotation = @[@0, @0, @0];
    _fieldOfView = 90.0; // degrees
    _nearClippingPlane = 0.1;
    _farClippingPlane = 1000.0;
    _projectionType = @"perspective";
    _focalLength = 50.0; // mm
    _animationDuration = 1.0; // seconds
    _animationType = @"easeIn";
    _active = NO;
    
    // Initialize ViroReact camera
    [self initializeVROCamera];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Cameras don't have visual bounds
}

#pragma mark - Camera Position and Orientation

- (void)initializeVROCamera
{
    RCTLogInfo(@"[ViroCameraComponentView] Creating VROCamera");
    
    // Create ViroReact camera
    _vroCamera = VROCamera::create();
    
    // Set default camera properties
    _vroCamera->setFieldOfView(_fieldOfView * M_PI / 180.0); // Convert degrees to radians
    _vroCamera->setNearClippingPlane(_nearClippingPlane);
    _vroCamera->setFarClippingPlane(_farClippingPlane);
    
    // Set projection type
    if ([_projectionType isEqualToString:@"orthographic"]) {
        _vroCamera->setProjectionType(VROProjectionType::Orthographic);
    } else {
        _vroCamera->setProjectionType(VROProjectionType::Perspective);
    }
    
    // Create VRONode to hold the camera
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setCamera(_vroCamera);
    
    // Apply initial transform
    [self updateCameraTransform];
    
    RCTLogInfo(@"[ViroCameraComponentView] VROCamera created successfully");
}

#pragma mark - Camera Position and Orientation

- (void)setPosition:(nullable NSArray<NSNumber *> *)position
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting position: %@", position);
    _position = position ?: @[@0, @0, @0];
    
    [self updateCameraTransform];
}

- (void)setRotation:(nullable NSArray<NSNumber *> *)rotation
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting rotation: %@", rotation);
    _rotation = rotation ?: @[@0, @0, @0];
    
    [self updateCameraTransform];
}

- (void)setFieldOfView:(CGFloat)fieldOfView
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting field of view: %f", fieldOfView);
    _fieldOfView = fieldOfView;
    
    if (_vroCamera) {
        _vroCamera->setFieldOfView(fieldOfView * M_PI / 180.0); // Convert degrees to radians
    }
}

- (void)updateCameraTransform
{
    RCTLogInfo(@"[ViroCameraComponentView] Updating camera transform - Position: %@, Rotation: %@", _position, _rotation);
    
    if (_vroNode) {
        // Apply position
        if (_position && _position.count >= 3) {
            VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
            _vroNode->setPosition(pos);
        }
        
        // Apply rotation (convert degrees to radians)
        if (_rotation && _rotation.count >= 3) {
            VROVector3f rot([_rotation[0] floatValue] * M_PI / 180.0,
                            [_rotation[1] floatValue] * M_PI / 180.0,
                            [_rotation[2] floatValue] * M_PI / 180.0);
            _vroNode->setRotation(rot);
        }
    }
    
    // Emit transform update event
    if (_onTransformUpdate && _active) {
        _onTransformUpdate(@{
            @"position": _position,
            @"rotation": _rotation,
            @"source": @"ViroCamera"
        });
    }
}

#pragma mark - Camera Projection

- (void)setNearClippingPlane:(CGFloat)nearClippingPlane
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting near clipping plane: %f", nearClippingPlane);
    _nearClippingPlane = nearClippingPlane;
    
    [self updateCameraProjection];
}

- (void)setFarClippingPlane:(CGFloat)farClippingPlane
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting far clipping plane: %f", farClippingPlane);
    _farClippingPlane = farClippingPlane;
    
    [self updateCameraProjection];
}

- (void)setProjectionType:(nullable NSString *)projectionType
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting projection type: %@", projectionType);
    _projectionType = projectionType ?: @"perspective";
    
    [self updateCameraProjection];
}

- (void)setFocalLength:(CGFloat)focalLength
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting focal length: %f", focalLength);
    _focalLength = focalLength;
    
    // TODO: Update camera focal length in ViroReact renderer
    [self updateCameraProjection];
}

- (void)updateCameraProjection
{
    RCTLogInfo(@"[ViroCameraComponentView] Updating camera projection - FOV: %.1f, Near: %.2f, Far: %.2f, Type: %@", 
               _fieldOfView, _nearClippingPlane, _farClippingPlane, _projectionType);
    
    if (_vroCamera) {
        // Update clipping planes
        _vroCamera->setNearClippingPlane(_nearClippingPlane);
        _vroCamera->setFarClippingPlane(_farClippingPlane);
        
        // Update projection type
        if ([_projectionType isEqualToString:@"orthographic"]) {
            _vroCamera->setProjectionType(VROProjectionType::Orthographic);
        } else {
            _vroCamera->setProjectionType(VROProjectionType::Perspective);
        }
    }
}

#pragma mark - Camera Animation and Controls

- (void)setAnimationDuration:(CGFloat)animationDuration
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting animation duration: %f", animationDuration);
    _animationDuration = animationDuration;
    
    // TODO: Update camera animation settings in ViroReact renderer
}

- (void)setAnimationType:(nullable NSString *)animationType
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting animation type: %@", animationType);
    _animationType = animationType ?: @"easeIn";
    
    // TODO: Update camera animation type in ViroReact renderer
    // Types: "easeIn", "easeOut", "easeInOut", "linear", "bounce"
}

#pragma mark - Camera Settings

- (void)setActive:(BOOL)active
{
    RCTLogInfo(@"[ViroCameraComponentView] Setting active: %@", active ? @"YES" : @"NO");
    
    BOOL wasActive = _active;
    _active = active;
    
    if (active && !wasActive) {
        // Camera became active - enable in ViroReact renderer
        if (_vroCamera) {
            _vroCamera->setEnabled(true);
        }
        [self updateCameraTransform];
        [self updateCameraProjection];
        
        if (_onCameraDidMount) {
            _onCameraDidMount(@{
                @"source": @"ViroCamera"
            });
        }
    } else if (!active && wasActive) {
        // Camera became inactive - disable in ViroReact renderer
        if (_vroCamera) {
            _vroCamera->setEnabled(false);
        }
        
        if (_onCameraWillUnmount) {
            _onCameraWillUnmount(@{
                @"source": @"ViroCamera"
            });
        }
    }
}

#pragma mark - Event Callbacks

- (void)setOnTransformUpdate:(nullable RCTBubblingEventBlock)onTransformUpdate
{
    _onTransformUpdate = onTransformUpdate;
}

- (void)setOnCameraDidMount:(nullable RCTBubblingEventBlock)onCameraDidMount
{
    _onCameraDidMount = onCameraDidMount;
}

- (void)setOnCameraWillUnmount:(nullable RCTBubblingEventBlock)onCameraWillUnmount
{
    _onCameraWillUnmount = onCameraWillUnmount;
}

#pragma mark - Camera Control Methods

- (void)animateToPosition:(NSArray<NSNumber *> *)position 
                 rotation:(NSArray<NSNumber *> *)rotation
                 duration:(CGFloat)duration
{
    RCTLogInfo(@"[ViroCameraComponentView] Animating to position: %@, rotation: %@, duration: %f", 
               position, rotation, duration);
    
    // Create smooth animation to target position/rotation
    if (_vroNode) {
        // For now, directly set the target values
        // TODO: Implement smooth animation with VROTransaction
        _position = position;
        _rotation = rotation;
        [self updateCameraTransform];
    }
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // Cameras don't have visual layout, but we can log for debugging
    RCTLogInfo(@"[ViroCameraComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroCameraComponentView] Camera added to window");
        // ViroNodeComponentView parent will handle adding _vroNode to scene
        if (_active) {
            [self updateCameraTransform];
            [self updateCameraProjection];
        }
    } else {
        RCTLogInfo(@"[ViroCameraComponentView] Camera removed from window");
        // ViroNodeComponentView parent will handle removing _vroNode from scene
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroCameraComponentView] Deallocating");
    
    if (_active && _onCameraWillUnmount) {
        _onCameraWillUnmount(@{
            @"source": @"ViroCamera"
        });
    }
    
    // Clean up ViroReact camera resources
    _vroCamera = nullptr;
    _vroNode = nullptr;
}

@end

Class<RCTComponentViewProtocol> ViroCameraCls(void)
{
    return ViroCameraComponentView.class;
}