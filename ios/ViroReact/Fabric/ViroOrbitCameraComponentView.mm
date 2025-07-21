//
//  ViroOrbitCameraComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroOrbitCameraComponentView.h"

#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/UIView+React.h>

#import <react/renderer/components/ViroReactSpec/ComponentDescriptors.h>
#import <react/renderer/components/ViroReactSpec/EventEmitters.h>
#import <react/renderer/components/ViroReactSpec/Props.h>
#import <react/renderer/components/ViroReactSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface ViroOrbitCameraComponentView () <RCTViroOrbitCameraViewProtocol>
@end

@implementation ViroOrbitCameraComponentView {
    CADisplayLink *_orbitAnimationTimer;
    NSTimeInterval _lastAnimationTime;
    BOOL _isAnimating;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<ViroOrbitCameraComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ViroOrbitCameraProps>();
        _props = defaultProps;
        
        [self initializeViroOrbitCamera];
    }
    
    return self;
}

- (void)initializeViroOrbitCamera
{
    NSLog(@"Initializing ViroOrbitCameraComponentView");
    
    // Initialize default values
    _position = SCNVector3Make(0, 0, 5);
    _focalPoint = SCNVector3Make(0, 0, 0);
    _active = NO;
    _fieldOfView = 60.0f;
    _orbitRadius = 5.0f;
    _orbitAngleHorizontal = 0.0f;
    _orbitAngleVertical = 0.0f;
    _orbitSpeed = 1.0f;
    
    _isAnimating = NO;
    _lastAnimationTime = 0.0;
    
    // Create SCNCamera
    _scnCamera = [SCNCamera camera];
    _scnCamera.xFov = _fieldOfView;
    _scnCamera.yFov = _fieldOfView;
    _scnCamera.automaticallyAdjustsZRange = YES;
    
    // Create camera node
    _cameraNode = [SCNNode node];
    _cameraNode.camera = _scnCamera;
    _cameraNode.position = _position;
    
    // Create target node for look-at behavior
    _targetNode = [SCNNode node];
    _targetNode.position = _focalPoint;
    
    // Calculate initial orbit radius
    _orbitRadius = SCNVector3Distance(_position, _focalPoint);
    
    // TODO: Add camera node to ViroReact scene
    // This will need to integrate with the existing ViroReact camera system
    
    [self updateCameraPosition];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<ViroOrbitCameraProps const>(oldProps);
    const auto &newViewProps = *std::static_pointer_cast<ViroOrbitCameraProps const>(props);
    
    // Handle position changes
    if (oldViewProps.position != newViewProps.position) {
        auto positionArray = newViewProps.position;
        if (positionArray.size() >= 3) {
            _position = SCNVector3Make(positionArray[0], positionArray[1], positionArray[2]);
            NSLog(@"ViroOrbitCamera position: (%.2f, %.2f, %.2f)", _position.x, _position.y, _position.z);
            [self updateCameraPosition];
        }
    }
    
    // Handle focal point changes
    if (oldViewProps.focalPoint != newViewProps.focalPoint) {
        auto focalArray = newViewProps.focalPoint;
        if (focalArray.size() >= 3) {
            _focalPoint = SCNVector3Make(focalArray[0], focalArray[1], focalArray[2]);
            NSLog(@"ViroOrbitCamera focal point: (%.2f, %.2f, %.2f)", _focalPoint.x, _focalPoint.y, _focalPoint.z);
            _targetNode.position = _focalPoint;
            [self updateCameraPosition];
        }
    }
    
    // Handle active state changes
    if (oldViewProps.active != newViewProps.active) {
        _active = newViewProps.active;
        NSLog(@"ViroOrbitCamera active: %@", _active ? @"YES" : @"NO");
        
        if (_active) {
            [self activateCamera];
        } else {
            [self deactivateCamera];
        }
    }
    
    // Handle field of view changes
    if (oldViewProps.fieldOfView != newViewProps.fieldOfView) {
        _fieldOfView = newViewProps.fieldOfView;
        NSLog(@"ViroOrbitCamera field of view: %.2f", _fieldOfView);
        _scnCamera.xFov = _fieldOfView;
        _scnCamera.yFov = _fieldOfView;
    }
    
    // Handle animation changes
    if (oldViewProps.animation != newViewProps.animation) {
        // TODO: Handle animation configuration
        NSLog(@"ViroOrbitCamera animation changed");
    }
    
    [super updateProps:props oldProps:oldProps];
}

- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter
{
    [super updateEventEmitter:eventEmitter];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
    // Handle orbit camera specific commands
    if ([commandName isEqualToString:@"startOrbit"]) {
        [self startOrbitAnimation];
    } else if ([commandName isEqualToString:@"stopOrbit"]) {
        [self stopOrbitAnimation];
    } else if ([commandName isEqualToString:@"setOrbitRadius"]) {
        if (args.count > 0) {
            float radius = [args[0] floatValue];
            [self updateOrbitRadius:radius];
        }
    } else if ([commandName isEqualToString:@"setOrbitAngles"]) {
        if (args.count >= 2) {
            float horizontal = [args[0] floatValue];
            float vertical = [args[1] floatValue];
            [self updateOrbitAngles:horizontal vertical:vertical];
        }
    }
}

#pragma mark - Camera Management

- (void)activateCamera
{
    NSLog(@"Activating ViroOrbitCamera");
    
    // TODO: Set this camera as active in ViroReact scene
    // This will need to integrate with the existing ViroReact camera system
    
    [self updateCameraPosition];
    [self lookAtTarget];
}

- (void)deactivateCamera
{
    NSLog(@"Deactivating ViroOrbitCamera");
    
    // Stop any ongoing animations
    [self stopOrbitAnimation];
    
    // TODO: Remove this camera as active in ViroReact scene
}

- (void)updateCameraPosition
{
    // Calculate orbit position based on angles and radius
    float x = _focalPoint.x + _orbitRadius * sinf(_orbitAngleHorizontal * M_PI / 180.0f) * cosf(_orbitAngleVertical * M_PI / 180.0f);
    float y = _focalPoint.y + _orbitRadius * sinf(_orbitAngleVertical * M_PI / 180.0f);
    float z = _focalPoint.z + _orbitRadius * cosf(_orbitAngleHorizontal * M_PI / 180.0f) * cosf(_orbitAngleVertical * M_PI / 180.0f);
    
    _position = SCNVector3Make(x, y, z);
    _cameraNode.position = _position;
    
    NSLog(@"Updated camera position: (%.2f, %.2f, %.2f)", _position.x, _position.y, _position.z);
    
    // Always look at the focal point
    [self lookAtTarget];
}

- (void)updateOrbitRadius:(float)radius
{
    if (radius > 0) {
        _orbitRadius = radius;
        NSLog(@"Updated orbit radius: %.2f", _orbitRadius);
        [self updateCameraPosition];
    }
}

- (void)updateOrbitAngles:(float)horizontal vertical:(float)vertical
{
    _orbitAngleHorizontal = horizontal;
    _orbitAngleVertical = vertical;
    NSLog(@"Updated orbit angles: horizontal=%.2f, vertical=%.2f", horizontal, vertical);
    [self updateCameraPosition];
}

- (void)lookAtTarget
{
    // Calculate look-at direction
    SCNVector3 direction = SCNVector3Make(
        _focalPoint.x - _position.x,
        _focalPoint.y - _position.y,
        _focalPoint.z - _position.z
    );
    
    // Normalize direction vector
    float length = sqrtf(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    if (length > 0) {
        direction.x /= length;
        direction.y /= length;
        direction.z /= length;
    }
    
    // Set camera node to look at target
    [_cameraNode lookAt:_focalPoint];
}

#pragma mark - Animation Methods

- (void)startOrbitAnimation
{
    if (_isAnimating) {
        return;
    }
    
    NSLog(@"Starting orbit animation");
    _isAnimating = YES;
    _lastAnimationTime = CACurrentMediaTime();
    
    _orbitAnimationTimer = [CADisplayLink displayLinkWithTarget:self selector:@selector(updateOrbitAnimation:)];
    [_orbitAnimationTimer addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
}

- (void)stopOrbitAnimation
{
    if (!_isAnimating) {
        return;
    }
    
    NSLog(@"Stopping orbit animation");
    _isAnimating = NO;
    
    if (_orbitAnimationTimer) {
        [_orbitAnimationTimer invalidate];
        _orbitAnimationTimer = nil;
    }
}

- (void)pauseOrbitAnimation
{
    if (_orbitAnimationTimer) {
        _orbitAnimationTimer.paused = YES;
    }
}

- (void)resumeOrbitAnimation
{
    if (_orbitAnimationTimer) {
        _orbitAnimationTimer.paused = NO;
        _lastAnimationTime = CACurrentMediaTime();
    }
}

- (void)updateOrbitAnimation:(CADisplayLink *)displayLink
{
    NSTimeInterval currentTime = CACurrentMediaTime();
    NSTimeInterval deltaTime = currentTime - _lastAnimationTime;
    _lastAnimationTime = currentTime;
    
    // Update horizontal angle based on orbit speed
    _orbitAngleHorizontal += _orbitSpeed * deltaTime * 60.0f; // 60 degrees per second base speed
    
    // Keep angle in 0-360 range
    while (_orbitAngleHorizontal >= 360.0f) {
        _orbitAngleHorizontal -= 360.0f;
    }
    while (_orbitAngleHorizontal < 0.0f) {
        _orbitAngleHorizontal += 360.0f;
    }
    
    [self updateCameraPosition];
}

#pragma mark - Property Setters

- (void)setPosition:(SCNVector3)position
{
    if (SCNVector3EqualToVector3(_position, position)) {
        return;
    }
    
    _position = position;
    _cameraNode.position = position;
    
    // Recalculate orbit radius
    _orbitRadius = SCNVector3Distance(_position, _focalPoint);
    
    [self updateCameraPosition];
}

- (void)setFocalPoint:(SCNVector3)focalPoint
{
    if (SCNVector3EqualToVector3(_focalPoint, focalPoint)) {
        return;
    }
    
    _focalPoint = focalPoint;
    _targetNode.position = focalPoint;
    
    // Recalculate orbit radius
    _orbitRadius = SCNVector3Distance(_position, _focalPoint);
    
    [self updateCameraPosition];
}

- (void)setFieldOfView:(float)fieldOfView
{
    if (_fieldOfView == fieldOfView) {
        return;
    }
    
    _fieldOfView = fieldOfView;
    _scnCamera.xFov = fieldOfView;
    _scnCamera.yFov = fieldOfView;
}

- (void)setActive:(BOOL)active
{
    if (_active == active) {
        return;
    }
    
    _active = active;
    
    if (active) {
        [self activateCamera];
    } else {
        [self deactivateCamera];
    }
}

#pragma mark - Lifecycle

- (void)prepareForRecycle
{
    [super prepareForRecycle];
    
    // Stop any animations
    [self stopOrbitAnimation];
    
    // Deactivate camera
    [self deactivateCamera];
    
    // Reset properties
    _position = SCNVector3Make(0, 0, 5);
    _focalPoint = SCNVector3Make(0, 0, 0);
    _active = NO;
    _fieldOfView = 60.0f;
    _orbitRadius = 5.0f;
    _orbitAngleHorizontal = 0.0f;
    _orbitAngleVertical = 0.0f;
    _orbitSpeed = 1.0f;
}

@end

Class<RCTComponentViewProtocol> ViroOrbitCameraCls(void)
{
    return ViroOrbitCameraComponentView.class;
}