//
//  ViroControllerComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroControllerComponentView.h"

#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/UIView+React.h>

#import <react/renderer/components/ViroReactSpec/ComponentDescriptors.h>
#import <react/renderer/components/ViroReactSpec/EventEmitters.h>
#import <react/renderer/components/ViroReactSpec/Props.h>
#import <react/renderer/components/ViroReactSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface ViroControllerComponentView () <RCTViroControllerViewProtocol>
@end

@implementation ViroControllerComponentView {
    NSTimer *_fuseTimer;
    BOOL _isFusing;
    CGPoint _lastTouchPoint;
    CGPoint _lastScrollPoint;
    NSDate *_lastInputTime;
    BOOL _isControllerActive;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<ViroControllerComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ViroControllerProps>();
        _props = defaultProps;
        
        [self initializeViroController];
    }
    
    return self;
}

- (void)initializeViroController
{
    NSLog(@"Initializing ViroControllerComponentView");
    
    // Initialize default values
    _reticleVisibility = YES;
    _controllerVisibility = YES;
    _timeToFuse = 2.0f;
    _controllerStatus = ViroControllerStatusDisconnected;
    _controllerType = ViroControllerTypeGeneric;
    _controllerPosition = SCNVector3Make(0, 0, 0);
    _controllerRotation = SCNVector4Make(0, 0, 0, 0);
    _controllerForward = SCNVector3Make(0, 0, -1);
    
    _isFusing = NO;
    _isControllerActive = NO;
    _lastInputTime = [NSDate date];
    
    // Set up gesture recognizers for input handling
    [self setupGestureRecognizers];
    
    // TODO: Initialize ViroReact controller integration
    // This will need to integrate with the existing ViroReact controller system
}

- (void)setupGestureRecognizers
{
    // Tap gesture for click events
    if (_canClick) {
        UITapGestureRecognizer *tapRecognizer = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTapGesture:)];
        [self addGestureRecognizer:tapRecognizer];
    }
    
    // Pan gesture for touch and drag events
    if (_canTouch || _canDrag) {
        UIPanGestureRecognizer *panRecognizer = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePanGesture:)];
        [self addGestureRecognizer:panRecognizer];
    }
    
    // Pinch gesture for pinch events
    if (_canPinch) {
        UIPinchGestureRecognizer *pinchRecognizer = [[UIPinchGestureRecognizer alloc] initWithTarget:self action:@selector(handlePinchGesture:)];
        [self addGestureRecognizer:pinchRecognizer];
    }
    
    // Rotation gesture for rotate events
    if (_canRotate) {
        UIRotationGestureRecognizer *rotationRecognizer = [[UIRotationGestureRecognizer alloc] initWithTarget:self action:@selector(handleRotationGesture:)];
        [self addGestureRecognizer:rotationRecognizer];
    }
    
    // Swipe gesture for swipe events
    if (_canSwipe) {
        UISwipeGestureRecognizer *swipeRecognizer = [[UISwipeGestureRecognizer alloc] initWithTarget:self action:@selector(handleSwipeGesture:)];
        swipeRecognizer.direction = UISwipeGestureRecognizerDirectionUp | UISwipeGestureRecognizerDirectionDown | UISwipeGestureRecognizerDirectionLeft | UISwipeGestureRecognizerDirectionRight;
        [self addGestureRecognizer:swipeRecognizer];
    }
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<ViroControllerProps const>(oldProps);
    const auto &newViewProps = *std::static_pointer_cast<ViroControllerProps const>(props);
    
    // Handle reticle visibility changes
    if (oldViewProps.reticleVisibility != newViewProps.reticleVisibility) {
        _reticleVisibility = newViewProps.reticleVisibility;
        NSLog(@"ViroController reticle visibility: %@", _reticleVisibility ? @"YES" : @"NO");
        [self updateReticleVisibility];
    }
    
    // Handle controller visibility changes
    if (oldViewProps.controllerVisibility != newViewProps.controllerVisibility) {
        _controllerVisibility = newViewProps.controllerVisibility;
        NSLog(@"ViroController controller visibility: %@", _controllerVisibility ? @"YES" : @"NO");
        [self updateControllerVisibility];
    }
    
    // Handle time to fuse changes
    if (oldViewProps.timeToFuse != newViewProps.timeToFuse) {
        _timeToFuse = newViewProps.timeToFuse;
        NSLog(@"ViroController time to fuse: %.2f", _timeToFuse);
    }
    
    // Handle input capability changes
    if (oldViewProps.canClick != newViewProps.canClick) {
        _canClick = newViewProps.canClick;
        NSLog(@"ViroController can click: %@", _canClick ? @"YES" : @"NO");
    }
    
    if (oldViewProps.canTouch != newViewProps.canTouch) {
        _canTouch = newViewProps.canTouch;
        NSLog(@"ViroController can touch: %@", _canTouch ? @"YES" : @"NO");
    }
    
    if (oldViewProps.canFuse != newViewProps.canFuse) {
        _canFuse = newViewProps.canFuse;
        NSLog(@"ViroController can fuse: %@", _canFuse ? @"YES" : @"NO");
    }
    
    [super updateProps:props oldProps:oldProps];
}

- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter
{
    [super updateEventEmitter:eventEmitter];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
    // Handle controller specific commands
    if ([commandName isEqualToString:@"startController"]) {
        [self startController];
    } else if ([commandName isEqualToString:@"stopController"]) {
        [self stopController];
    } else if ([commandName isEqualToString:@"getControllerForward"]) {
        SCNVector3 forward = [self getControllerForward];
        NSLog(@"Controller forward vector: (%.2f, %.2f, %.2f)", forward.x, forward.y, forward.z);
    }
}

#pragma mark - Controller Management

- (void)startController
{
    NSLog(@"Starting ViroController");
    
    _isControllerActive = YES;
    
    // TODO: Start ViroReact controller system
    // This will need to integrate with the existing ViroReact controller implementation
    
    [self updateControllerStatus:ViroControllerStatusConnected];
}

- (void)stopController
{
    NSLog(@"Stopping ViroController");
    
    _isControllerActive = NO;
    
    // Stop fuse timer if active
    [self stopFuseTimer];
    
    // TODO: Stop ViroReact controller system
    
    [self updateControllerStatus:ViroControllerStatusDisconnected];
}

- (void)updateControllerVisibility
{
    NSLog(@"Updating controller visibility: %@", _controllerVisibility ? @"visible" : @"hidden");
    
    // TODO: Apply controller visibility to ViroReact controller system
    self.alpha = _controllerVisibility ? 1.0f : 0.0f;
}

- (void)updateReticleVisibility
{
    NSLog(@"Updating reticle visibility: %@", _reticleVisibility ? @"visible" : @"hidden");
    
    // TODO: Apply reticle visibility to ViroReact controller system
}

#pragma mark - Gesture Handling

- (void)handleTapGesture:(UITapGestureRecognizer *)recognizer
{
    if (!_canClick || !_isControllerActive) return;
    
    CGPoint location = [recognizer locationInView:self];
    SCNVector3 position = SCNVector3Make(location.x, location.y, 0);
    
    [self handleControllerInput:@{
        @"type": @"click",
        @"position": @[@(position.x), @(position.y), @(position.z)],
        @"source": @"controller"
    }];
    
    // Start fuse timer if fuse is enabled
    if (_canFuse) {
        [self startFuseTimer];
    }
}

- (void)handlePanGesture:(UIPanGestureRecognizer *)recognizer
{
    if ((!_canTouch && !_canDrag) || !_isControllerActive) return;
    
    CGPoint location = [recognizer locationInView:self];
    CGPoint velocity = [recognizer velocityInView:self];
    
    NSString *state;
    switch (recognizer.state) {
        case UIGestureRecognizerStateBegan:
            state = @"began";
            break;
        case UIGestureRecognizerStateChanged:
            state = @"changed";
            break;
        case UIGestureRecognizerStateEnded:
            state = @"ended";
            break;
        default:
            return;
    }
    
    if (_canTouch) {
        [self handleTouchInput:location state:state];
    }
    
    if (_canDrag) {
        SCNVector3 dragPosition = SCNVector3Make(location.x, location.y, 0);
        [self handleDragInput:dragPosition];
    }
    
    // Handle scroll if velocity is significant
    if (_canScroll && (fabs(velocity.x) > 100 || fabs(velocity.y) > 100)) {
        [self handleScrollInput:velocity];
    }
}

- (void)handlePinchGesture:(UIPinchGestureRecognizer *)recognizer
{
    if (!_canPinch || !_isControllerActive) return;
    
    NSString *state;
    switch (recognizer.state) {
        case UIGestureRecognizerStateBegan:
            state = @"began";
            break;
        case UIGestureRecognizerStateChanged:
            state = @"changed";
            break;
        case UIGestureRecognizerStateEnded:
            state = @"ended";
            break;
        default:
            return;
    }
    
    [self handlePinchInput:recognizer.scale state:state];
}

- (void)handleRotationGesture:(UIRotationGestureRecognizer *)recognizer
{
    if (!_canRotate || !_isControllerActive) return;
    
    NSString *state;
    switch (recognizer.state) {
        case UIGestureRecognizerStateBegan:
            state = @"began";
            break;
        case UIGestureRecognizerStateChanged:
            state = @"changed";
            break;
        case UIGestureRecognizerStateEnded:
            state = @"ended";
            break;
        default:
            return;
    }
    
    [self handleRotateInput:recognizer.rotation state:state];
}

- (void)handleSwipeGesture:(UISwipeGestureRecognizer *)recognizer
{
    if (!_canSwipe || !_isControllerActive) return;
    
    NSString *direction;
    switch (recognizer.direction) {
        case UISwipeGestureRecognizerDirectionUp:
            direction = @"up";
            break;
        case UISwipeGestureRecognizerDirectionDown:
            direction = @"down";
            break;
        case UISwipeGestureRecognizerDirectionLeft:
            direction = @"left";
            break;
        case UISwipeGestureRecognizerDirectionRight:
            direction = @"right";
            break;
        default:
            return;
    }
    
    [self handleSwipeInput:direction];
}

#pragma mark - Input Handling

- (void)handleControllerInput:(NSDictionary *)inputData
{
    _lastInputTime = [NSDate date];
    
    NSString *inputType = inputData[@"type"];
    
    if ([inputType isEqualToString:@"click"] && _onClickViro) {
        _onClickViro(@{
            @"position": inputData[@"position"],
            @"source": inputData[@"source"] ?: @"controller",
            @"clickState": @"clicked"
        });
    }
}

- (void)handleTouchInput:(CGPoint)touchPoint state:(NSString *)state
{
    if (!_onTouchViro) return;
    
    _lastTouchPoint = touchPoint;
    
    _onTouchViro(@{
        @"touchState": state,
        @"touchPos": @[@(touchPoint.x), @(touchPoint.y)],
        @"source": @"controller"
    });
}

- (void)handleScrollInput:(CGPoint)scrollDelta
{
    if (!_onScrollViro) return;
    
    _lastScrollPoint = scrollDelta;
    
    _onScrollViro(@{
        @"scrollPos": @[@(scrollDelta.x), @(scrollDelta.y)],
        @"source": @"controller"
    });
}

- (void)handleSwipeInput:(NSString *)direction
{
    if (!_onSwipeViro) return;
    
    _onSwipeViro(@{
        @"swipeState": direction,
        @"source": @"controller"
    });
}

- (void)handleDragInput:(SCNVector3)dragPosition
{
    if (!_onDragViro) return;
    
    _onDragViro(@{
        @"dragToPos": @[@(dragPosition.x), @(dragPosition.y), @(dragPosition.z)],
        @"source": @"controller"
    });
}

- (void)handlePinchInput:(float)scaleFactor state:(NSString *)state
{
    if (!_onPinchViro) return;
    
    _onPinchViro(@{
        @"pinchState": state,
        @"scaleFactor": @(scaleFactor),
        @"source": @"controller"
    });
}

- (void)handleRotateInput:(float)rotationFactor state:(NSString *)state
{
    if (!_onRotateViro) return;
    
    _onRotateViro(@{
        @"rotateState": state,
        @"rotationFactor": @(rotationFactor),
        @"source": @"controller"
    });
}

- (void)handleFuseInput
{
    if (!_onFuseViro) return;
    
    _onFuseViro(@{
        @"source": @"controller"
    });
}

#pragma mark - Fuse Timer

- (void)startFuseTimer
{
    if (_isFusing || _timeToFuse <= 0) return;
    
    _isFusing = YES;
    _fuseTimer = [NSTimer scheduledTimerWithTimeInterval:_timeToFuse
                                                  target:self
                                                selector:@selector(fuseTimerFired)
                                                userInfo:nil
                                                 repeats:NO];
}

- (void)stopFuseTimer
{
    if (_fuseTimer) {
        [_fuseTimer invalidate];
        _fuseTimer = nil;
    }
    _isFusing = NO;
}

- (void)fuseTimerFired
{
    _isFusing = NO;
    [self handleFuseInput];
}

#pragma mark - Status Management

- (void)updateControllerStatus:(ViroControllerStatus)status
{
    if (_controllerStatus == status) return;
    
    _controllerStatus = status;
    
    NSString *statusString = [self getControllerStatusString:status];
    NSLog(@"Controller status updated: %@", statusString);
    
    if (_onControllerStatusViro) {
        _onControllerStatusViro(@{
            @"controllerStatus": statusString,
            @"source": @"controller"
        });
    }
}

- (NSString *)getControllerStatusString:(ViroControllerStatus)status
{
    switch (status) {
        case ViroControllerStatusConnected:
            return @"Connected";
        case ViroControllerStatusDisconnected:
            return @"Disconnected";
        case ViroControllerStatusError:
            return @"Error";
        default:
            return @"Unknown";
    }
}

- (SCNVector3)getControllerForward
{
    // TODO: Calculate actual controller forward vector based on controller orientation
    // For now, return default forward vector
    return _controllerForward;
}

#pragma mark - Lifecycle

- (void)prepareForRecycle
{
    [super prepareForRecycle];
    
    // Stop controller
    [self stopController];
    
    // Reset properties
    _reticleVisibility = YES;
    _controllerVisibility = YES;
    _timeToFuse = 2.0f;
    _controllerStatus = ViroControllerStatusDisconnected;
    _controllerType = ViroControllerTypeGeneric;
    _isControllerActive = NO;
}

@end

Class<RCTComponentViewProtocol> ViroControllerCls(void)
{
    return ViroControllerComponentView.class;
}