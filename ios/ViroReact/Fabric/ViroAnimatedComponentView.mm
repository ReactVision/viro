//
//  ViroAnimatedComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroAnimatedComponentView.h"
#import "ViroReactUtils.h"
#import "ViroLog.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <QuartzCore/QuartzCore.h>

@implementation ViroAnimatedComponentView {
    // ViroReact Integration
    std::shared_ptr<VROAnimationGroup> _vroAnimationGroup;
    std::shared_ptr<VRONode> _vroNode;
    std::shared_ptr<VROTransaction> _vroTransaction;
    
    // Animation properties
    NSDictionary *_animation;
    NSString *_animationName;
    BOOL _loop;
    NSTimeInterval _delay;
    NSTimeInterval _duration;
    NSString *_easing;
    NSString *_interpolatorType;
    
    // Animation control
    BOOL _run;
    BOOL _paused;
    BOOL _reverse;
    NSString *_direction;
    NSInteger _iterationCount;
    
    // Animation values
    id _fromValue;
    id _toValue;
    NSArray *_values;
    NSArray<NSNumber *> *_keyTimes;
    
    // Transform animations
    NSArray<NSNumber *> *_positionFrom;
    NSArray<NSNumber *> *_positionTo;
    NSArray<NSNumber *> *_scaleFrom;
    NSArray<NSNumber *> *_scaleTo;
    NSArray<NSNumber *> *_rotationFrom;
    NSArray<NSNumber *> *_rotationTo;
    
    // Opacity animations
    NSNumber *_opacityFrom;
    NSNumber *_opacityTo;
    
    // Color animations
    NSArray<NSNumber *> *_colorFrom;
    NSArray<NSNumber *> *_colorTo;
    
    // Material animations
    NSDictionary *_materialFrom;
    NSDictionary *_materialTo;
    
    // Physics animations
    BOOL _physicsEnabled;
    NSArray<NSNumber *> *_velocity;
    NSArray<NSNumber *> *_acceleration;
    
    // Animation state
    BOOL _isAnimating;
    BOOL _isPaused;
    NSTimeInterval _startTime;
    NSTimeInterval _pauseTime;
    NSTimeInterval _currentTime;
    
    // Core Animation objects
    CAAnimationGroup *_animationGroup;
    NSMutableArray<CAAnimation *> *_animations;
    
    // Event blocks
    RCTBubblingEventBlock _onStart;
    RCTBubblingEventBlock _onFinish;
    RCTBubblingEventBlock _onUpdate;
    RCTBubblingEventBlock _onCancel;
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const facebook::react::ViroAnimatedComponentProps>();
        _props = defaultProps;
        
        // Initialize default values
        _loop = NO;
        _delay = 0.0;
        _duration = 1.0;
        _easing = @"linear";
        _interpolatorType = @"linear";
        _run = NO;
        _paused = NO;
        _reverse = NO;
        _direction = @"normal";
        _iterationCount = 1;
        _physicsEnabled = NO;
        
        // Initialize animation state
        _isAnimating = NO;
        _isPaused = NO;
        _startTime = 0.0;
        _pauseTime = 0.0;
        _currentTime = 0.0;
        
        // Initialize animation arrays
        _animations = [NSMutableArray array];
        
        // Initialize ViroReact animation system
        [self initializeVROAnimation];
        
        VRTLogDebug(@"ViroAnimatedComponent initialized");
    }
    return self;
}

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroAnimatedComponentComponentDescriptor>();
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &viroProps = *std::static_pointer_cast<facebook::react::ViroAnimatedComponentProps const>(props);
    const auto &oldViroProps = *std::static_pointer_cast<facebook::react::ViroAnimatedComponentProps const>(oldProps);
    
    [super updateProps:props oldProps:oldProps];
    
    // TODO: Update properties from viroProps
    // This will be implemented when Fabric code generation is complete
    VRTLogDebug(@"ViroAnimatedComponent props updated");
}

#pragma mark - ViroReact Integration

- (void)initializeVROAnimation
{
    VRTLogDebug(@"Initializing VROAnimation");
    
    // Create VROAnimationGroup
    _vroAnimationGroup = VROAnimationGroup::create();
    
    // Set default properties
    _vroAnimationGroup->setDuration(_duration);
    _vroAnimationGroup->setDelay(_delay);
    _vroAnimationGroup->setLoop(_loop);
    _vroAnimationGroup->setSpeed(1.0f);
    
    // Create VRONode to hold the animated component
    _vroNode = std::make_shared<VRONode>();
    
    VRTLogDebug(@"VROAnimation initialized successfully");
}

- (void)updateVROAnimation
{
    if (!_vroAnimationGroup) {
        return;
    }
    
    // Update animation group properties
    _vroAnimationGroup->setDuration(_duration);
    _vroAnimationGroup->setDelay(_delay);
    _vroAnimationGroup->setLoop(_loop);
    
    // Set iteration count
    if (_iterationCount > 0) {
        _vroAnimationGroup->setRepeatCount(_iterationCount);
    }
    
    // Apply easing function
    VROTimingFunction timingFunction = [self vroTimingFunctionForEasing:_easing];
    _vroAnimationGroup->setTimingFunction(timingFunction);
}

- (VROTimingFunction)vroTimingFunctionForEasing:(NSString *)easing
{
    if ([easing isEqualToString:@"linear"]) {
        return VROTimingFunction::Linear;
    } else if ([easing isEqualToString:@"ease-in"]) {
        return VROTimingFunction::EaseIn;
    } else if ([easing isEqualToString:@"ease-out"]) {
        return VROTimingFunction::EaseOut;
    } else if ([easing isEqualToString:@"ease-in-out"]) {
        return VROTimingFunction::EaseInOut;
    } else {
        return VROTimingFunction::Linear;
    }
}

#pragma mark - Animation Properties

- (void)setAnimation:(nullable NSDictionary *)animation {
    VRTLogDebug(@"Setting animation: %@", animation);
    _animation = animation;
    
    if (animation) {
        // Parse animation dictionary and set individual properties
        NSString *name = animation[@"name"];
        if (name) {
            [self setAnimationName:name];
        }
        
        NSNumber *loop = animation[@"loop"];
        if (loop) {
            [self setLoop:[loop boolValue]];
        }
        
        NSNumber *delay = animation[@"delay"];
        if (delay) {
            [self setDelay:[delay doubleValue]];
        }
        
        NSNumber *duration = animation[@"duration"];
        if (duration) {
            [self setDuration:[duration doubleValue]];
        }
        
        NSString *easing = animation[@"easing"];
        if (easing) {
            [self setEasing:easing];
        }
        
        NSNumber *run = animation[@"run"];
        if (run) {
            [self setRun:[run boolValue]];
        }
        
        // Parse transform animations
        NSArray *positionFrom = animation[@"positionFrom"];
        if (positionFrom) {
            [self setPositionFrom:positionFrom];
        }
        
        NSArray *positionTo = animation[@"positionTo"];
        if (positionTo) {
            [self setPositionTo:positionTo];
        }
        
        NSArray *scaleFrom = animation[@"scaleFrom"];
        if (scaleFrom) {
            [self setScaleFrom:scaleFrom];
        }
        
        NSArray *scaleTo = animation[@"scaleTo"];
        if (scaleTo) {
            [self setScaleTo:scaleTo];
        }
        
        NSArray *rotationFrom = animation[@"rotationFrom"];
        if (rotationFrom) {
            [self setRotationFrom:rotationFrom];
        }
        
        NSArray *rotationTo = animation[@"rotationTo"];
        if (rotationTo) {
            [self setRotationTo:rotationTo];
        }
        
        // Parse opacity animations
        NSNumber *opacityFrom = animation[@"opacityFrom"];
        if (opacityFrom) {
            [self setOpacityFrom:opacityFrom];
        }
        
        NSNumber *opacityTo = animation[@"opacityTo"];
        if (opacityTo) {
            [self setOpacityTo:opacityTo];
        }
    }
    
    [self updateAnimation];
}

- (void)setAnimationName:(nullable NSString *)animationName {
    VRTLogDebug(@"Setting animation name: %@", animationName);
    _animationName = animationName;
    [self updateAnimation];
}

- (void)setLoop:(BOOL)loop {
    VRTLogDebug(@"Setting loop: %d", loop);
    _loop = loop;
    
    if (_vroAnimationGroup) {
        _vroAnimationGroup->setLoop(loop);
    }
    
    [self updateAnimation];
}

- (void)setDelay:(NSTimeInterval)delay {
    VRTLogDebug(@"Setting delay: %.2f", delay);
    _delay = delay;
    
    if (_vroAnimationGroup) {
        _vroAnimationGroup->setDelay(delay);
    }
    
    [self updateAnimation];
}

- (void)setDuration:(NSTimeInterval)duration {
    VRTLogDebug(@"Setting duration: %.2f", duration);
    _duration = duration;
    
    if (_vroAnimationGroup) {
        _vroAnimationGroup->setDuration(duration);
    }
    
    [self updateAnimation];
}

- (void)setEasing:(nullable NSString *)easing {
    VRTLogDebug(@"Setting easing: %@", easing);
    _easing = easing;
    
    if (_vroAnimationGroup) {
        VROTimingFunction timingFunction = [self vroTimingFunctionForEasing:easing];
        _vroAnimationGroup->setTimingFunction(timingFunction);
    }
    
    [self updateAnimation];
}

- (void)setInterpolatorType:(nullable NSString *)interpolatorType {
    VRTLogDebug(@"Setting interpolator type: %@", interpolatorType);
    _interpolatorType = interpolatorType;
    [self updateAnimation];
}

#pragma mark - Animation Control

- (void)setRun:(BOOL)run {
    VRTLogDebug(@"Setting run: %d", run);
    _run = run;
    
    if (run) {
        [self startAnimation];
    } else {
        [self stopAnimation];
    }
}

- (void)setPaused:(BOOL)paused {
    VRTLogDebug(@"Setting paused: %d", paused);
    _paused = paused;
    
    if (paused) {
        [self pauseAnimation];
    } else {
        [self resumeAnimation];
    }
}

- (void)setReverse:(BOOL)reverse {
    VRTLogDebug(@"Setting reverse: %d", reverse);
    _reverse = reverse;
    [self updateAnimation];
}

- (void)setDirection:(nullable NSString *)direction {
    VRTLogDebug(@"Setting direction: %@", direction);
    _direction = direction;
    [self updateAnimation];
}

- (void)setIterationCount:(NSInteger)iterationCount {
    VRTLogDebug(@"Setting iteration count: %ld", (long)iterationCount);
    _iterationCount = iterationCount;
    [self updateAnimation];
}

#pragma mark - Animation Values

- (void)setFromValue:(nullable id)fromValue {
    VRTLogDebug(@"Setting from value: %@", fromValue);
    _fromValue = fromValue;
    [self updateAnimation];
}

- (void)setToValue:(nullable id)toValue {
    VRTLogDebug(@"Setting to value: %@", toValue);
    _toValue = toValue;
    [self updateAnimation];
}

- (void)setValues:(nullable NSArray *)values {
    VRTLogDebug(@"Setting values: %@", values);
    _values = values;
    [self updateAnimation];
}

- (void)setKeyTimes:(nullable NSArray<NSNumber *> *)keyTimes {
    VRTLogDebug(@"Setting key times: %@", keyTimes);
    _keyTimes = keyTimes;
    [self updateAnimation];
}

#pragma mark - Transform Animations

- (void)setPositionFrom:(nullable NSArray<NSNumber *> *)positionFrom {
    VRTLogDebug(@"Setting position from: %@", positionFrom);
    _positionFrom = positionFrom;
    [self updateAnimation];
}

- (void)setPositionTo:(nullable NSArray<NSNumber *> *)positionTo {
    VRTLogDebug(@"Setting position to: %@", positionTo);
    _positionTo = positionTo;
    [self updateAnimation];
}

- (void)setScaleFrom:(nullable NSArray<NSNumber *> *)scaleFrom {
    VRTLogDebug(@"Setting scale from: %@", scaleFrom);
    _scaleFrom = scaleFrom;
    [self updateAnimation];
}

- (void)setScaleTo:(nullable NSArray<NSNumber *> *)scaleTo {
    VRTLogDebug(@"Setting scale to: %@", scaleTo);
    _scaleTo = scaleTo;
    [self updateAnimation];
}

- (void)setRotationFrom:(nullable NSArray<NSNumber *> *)rotationFrom {
    VRTLogDebug(@"Setting rotation from: %@", rotationFrom);
    _rotationFrom = rotationFrom;
    [self updateAnimation];
}

- (void)setRotationTo:(nullable NSArray<NSNumber *> *)rotationTo {
    VRTLogDebug(@"Setting rotation to: %@", rotationTo);
    _rotationTo = rotationTo;
    [self updateAnimation];
}

#pragma mark - Opacity Animations

- (void)setOpacityFrom:(nullable NSNumber *)opacityFrom {
    VRTLogDebug(@"Setting opacity from: %@", opacityFrom);
    _opacityFrom = opacityFrom;
    [self updateAnimation];
}

- (void)setOpacityTo:(nullable NSNumber *)opacityTo {
    VRTLogDebug(@"Setting opacity to: %@", opacityTo);
    _opacityTo = opacityTo;
    [self updateAnimation];
}

#pragma mark - Color Animations

- (void)setColorFrom:(nullable NSArray<NSNumber *> *)colorFrom {
    VRTLogDebug(@"Setting color from: %@", colorFrom);
    _colorFrom = colorFrom;
    [self updateAnimation];
}

- (void)setColorTo:(nullable NSArray<NSNumber *> *)colorTo {
    VRTLogDebug(@"Setting color to: %@", colorTo);
    _colorTo = colorTo;
    [self updateAnimation];
}

#pragma mark - Material Animations

- (void)setMaterialFrom:(nullable NSDictionary *)materialFrom {
    VRTLogDebug(@"Setting material from: %@", materialFrom);
    _materialFrom = materialFrom;
    [self updateAnimation];
}

- (void)setMaterialTo:(nullable NSDictionary *)materialTo {
    VRTLogDebug(@"Setting material to: %@", materialTo);
    _materialTo = materialTo;
    [self updateAnimation];
}

#pragma mark - Physics Animations

- (void)setPhysicsEnabled:(BOOL)physicsEnabled {
    VRTLogDebug(@"Setting physics enabled: %d", physicsEnabled);
    _physicsEnabled = physicsEnabled;
    [self updateAnimation];
}

- (void)setVelocity:(nullable NSArray<NSNumber *> *)velocity {
    VRTLogDebug(@"Setting velocity: %@", velocity);
    _velocity = velocity;
    [self updateAnimation];
}

- (void)setAcceleration:(nullable NSArray<NSNumber *> *)acceleration {
    VRTLogDebug(@"Setting acceleration: %@", acceleration);
    _acceleration = acceleration;
    [self updateAnimation];
}

#pragma mark - Events

- (void)setOnStart:(nullable RCTBubblingEventBlock)onStart {
    _onStart = onStart;
}

- (void)setOnFinish:(nullable RCTBubblingEventBlock)onFinish {
    _onFinish = onFinish;
}

- (void)setOnUpdate:(nullable RCTBubblingEventBlock)onUpdate {
    _onUpdate = onUpdate;
}

- (void)setOnCancel:(nullable RCTBubblingEventBlock)onCancel {
    _onCancel = onCancel;
}

#pragma mark - Animation Control Methods

- (void)startAnimation {
    VRTLogDebug(@"Starting animation");
    
    if (_isAnimating && !_isPaused) {
        VRTLogDebug(@"Animation already running");
        return;
    }
    
    [self buildAnimationGroup];
    
    if (_animationGroup) {
        _isAnimating = YES;
        _isPaused = NO;
        _startTime = CACurrentMediaTime();
        
        // Fire onStart event
        if (_onStart) {
            _onStart(@{});
        }
        
        // Add animation to layer
        [self.layer addAnimation:_animationGroup forKey:@"ViroAnimatedComponent"];
        
        // Start ViroReact animation
        if (_vroAnimationGroup && _vroNode) {
            [self buildVROAnimations];
            _vroAnimationGroup->execute(_vroNode, [self]() {
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (self->_onFinish) {
                        self->_onFinish(@{});
                    }
                });
            });
        }
    }
}

- (void)pauseAnimation {
    VRTLogDebug(@"Pausing animation");
    
    if (!_isAnimating || _isPaused) {
        VRTLogDebug(@"Animation not running or already paused");
        return;
    }
    
    _isPaused = YES;
    _pauseTime = CACurrentMediaTime();
    
    // Pause Core Animation
    CFTimeInterval pausedTime = [self.layer convertTime:CACurrentMediaTime() fromLayer:nil];
    self.layer.speed = 0.0;
    self.layer.timeOffset = pausedTime;
    
    // Pause ViroReact animation
    if (_vroAnimationGroup) {
        _vroAnimationGroup->pause();
    }
}

- (void)resumeAnimation {
    VRTLogDebug(@"Resuming animation");
    
    if (!_isAnimating || !_isPaused) {
        VRTLogDebug(@"Animation not running or not paused");
        return;
    }
    
    _isPaused = NO;
    
    // Resume Core Animation
    CFTimeInterval pausedTime = [self.layer timeOffset];
    self.layer.speed = 1.0;
    self.layer.timeOffset = 0.0;
    self.layer.beginTime = 0.0;
    CFTimeInterval timeSincePause = [self.layer convertTime:CACurrentMediaTime() fromLayer:nil] - pausedTime;
    self.layer.beginTime = timeSincePause;
    
    // Resume ViroReact animation
    if (_vroAnimationGroup) {
        _vroAnimationGroup->resume();
    }
}

- (void)stopAnimation {
    VRTLogDebug(@"Stopping animation");
    
    if (!_isAnimating) {
        VRTLogDebug(@"Animation not running");
        return;
    }
    
    _isAnimating = NO;
    _isPaused = NO;
    
    // Remove Core Animation
    [self.layer removeAnimationForKey:@"ViroAnimatedComponent"];
    
    // Reset layer properties
    self.layer.speed = 1.0;
    self.layer.timeOffset = 0.0;
    self.layer.beginTime = 0.0;
    
    // Stop ViroReact animation
    if (_vroAnimationGroup) {
        _vroAnimationGroup->terminate();
    }
    
    // Fire onCancel event
    if (_onCancel) {
        _onCancel(@{});
    }
}

- (void)resetAnimation {
    VRTLogDebug(@"Resetting animation");
    
    [self stopAnimation];
    _currentTime = 0.0;
    
    // Reset ViroReact animation to initial state
    if (_vroAnimationGroup) {
        _vroAnimationGroup->reset();
    }
}

#pragma mark - Animation State

- (BOOL)isAnimating {
    return _isAnimating;
}

- (BOOL)isPaused {
    return _isPaused;
}

- (NSTimeInterval)currentTime {
    if (_isAnimating && !_isPaused) {
        return CACurrentMediaTime() - _startTime;
    } else if (_isPaused) {
        return _pauseTime - _startTime;
    } else {
        return _currentTime;
    }
}

- (float)progress {
    if (_duration > 0.0) {
        return MIN(1.0f, (float)([self currentTime] / _duration));
    }
    return 0.0f;
}

#pragma mark - Helper Methods

- (void)updateAnimation {
    if (_run && !_isAnimating) {
        [self startAnimation];
    } else if (_isAnimating) {
        // Update running animation
        [self stopAnimation];
        if (_run) {
            [self startAnimation];
        }
    }
}

- (void)buildAnimationGroup {
    [_animations removeAllObjects];
    
    // Build position animation
    if (_positionFrom && _positionTo) {
        CABasicAnimation *positionAnimation = [self createBasicAnimationForKeyPath:@"position"
                                                                        fromValue:_positionFrom
                                                                          toValue:_positionTo];
        if (positionAnimation) {
            [_animations addObject:positionAnimation];
        }
    }
    
    // Build scale animation
    if (_scaleFrom && _scaleTo) {
        CABasicAnimation *scaleAnimation = [self createBasicAnimationForKeyPath:@"transform.scale"
                                                                      fromValue:_scaleFrom
                                                                        toValue:_scaleTo];
        if (scaleAnimation) {
            [_animations addObject:scaleAnimation];
        }
    }
    
    // Build rotation animation
    if (_rotationFrom && _rotationTo) {
        CABasicAnimation *rotationAnimation = [self createBasicAnimationForKeyPath:@"transform.rotation"
                                                                         fromValue:_rotationFrom
                                                                           toValue:_rotationTo];
        if (rotationAnimation) {
            [_animations addObject:rotationAnimation];
        }
    }
    
    // Build opacity animation
    if (_opacityFrom && _opacityTo) {
        CABasicAnimation *opacityAnimation = [self createBasicAnimationForKeyPath:@"opacity"
                                                                        fromValue:_opacityFrom
                                                                          toValue:_opacityTo];
        if (opacityAnimation) {
            [_animations addObject:opacityAnimation];
        }
    }
    
    // Create animation group
    if (_animations.count > 0) {
        _animationGroup = [CAAnimationGroup animation];
        _animationGroup.animations = _animations;
        _animationGroup.duration = _duration;
        _animationGroup.beginTime = CACurrentMediaTime() + _delay;
        _animationGroup.repeatCount = _loop ? HUGE_VALF : (_iterationCount > 0 ? _iterationCount : 1);
        _animationGroup.autoreverses = _reverse;
        _animationGroup.timingFunction = [self timingFunctionForEasing:_easing];
        _animationGroup.fillMode = kCAFillModeForwards;
        _animationGroup.removedOnCompletion = NO;
        
        // Set delegate to handle animation events
        _animationGroup.delegate = self;
    }
}

- (void)buildVROAnimations
{
    if (!_vroAnimationGroup) {
        return;
    }
    
    // Clear existing animations
    _vroAnimationGroup->removeAllAnimations();
    
    // Build position animation
    if (_positionFrom && _positionTo && _positionFrom.count >= 3 && _positionTo.count >= 3) {
        VROVector3f fromPos([_positionFrom[0] floatValue], [_positionFrom[1] floatValue], [_positionFrom[2] floatValue]);
        VROVector3f toPos([_positionTo[0] floatValue], [_positionTo[1] floatValue], [_positionTo[2] floatValue]);
        
        auto positionAnimation = VROAnimationVector3f::create(fromPos, toPos);
        positionAnimation->setDuration(_duration);
        _vroAnimationGroup->addAnimation("position", positionAnimation);
    }
    
    // Build scale animation
    if (_scaleFrom && _scaleTo && _scaleFrom.count >= 3 && _scaleTo.count >= 3) {
        VROVector3f fromScale([_scaleFrom[0] floatValue], [_scaleFrom[1] floatValue], [_scaleFrom[2] floatValue]);
        VROVector3f toScale([_scaleTo[0] floatValue], [_scaleTo[1] floatValue], [_scaleTo[2] floatValue]);
        
        auto scaleAnimation = VROAnimationVector3f::create(fromScale, toScale);
        scaleAnimation->setDuration(_duration);
        _vroAnimationGroup->addAnimation("scale", scaleAnimation);
    }
    
    // Build rotation animation
    if (_rotationFrom && _rotationTo && _rotationFrom.count >= 3 && _rotationTo.count >= 3) {
        VROVector3f fromRot([_rotationFrom[0] floatValue] * M_PI / 180.0,
                            [_rotationFrom[1] floatValue] * M_PI / 180.0,
                            [_rotationFrom[2] floatValue] * M_PI / 180.0);
        VROVector3f toRot([_rotationTo[0] floatValue] * M_PI / 180.0,
                          [_rotationTo[1] floatValue] * M_PI / 180.0,
                          [_rotationTo[2] floatValue] * M_PI / 180.0);
        
        auto rotationAnimation = VROAnimationVector3f::create(fromRot, toRot);
        rotationAnimation->setDuration(_duration);
        _vroAnimationGroup->addAnimation("rotation", rotationAnimation);
    }
    
    // Build opacity animation
    if (_opacityFrom && _opacityTo) {
        float fromOpacity = [_opacityFrom floatValue];
        float toOpacity = [_opacityTo floatValue];
        
        auto opacityAnimation = VROAnimationFloat::create(fromOpacity, toOpacity);
        opacityAnimation->setDuration(_duration);
        _vroAnimationGroup->addAnimation("opacity", opacityAnimation);
    }
}

- (CABasicAnimation *)createBasicAnimationForKeyPath:(NSString *)keyPath
                                           fromValue:(id)fromValue
                                             toValue:(id)toValue {
    CABasicAnimation *animation = [CABasicAnimation animationWithKeyPath:keyPath];
    animation.fromValue = fromValue;
    animation.toValue = toValue;
    return animation;
}

- (CAMediaTimingFunction *)timingFunctionForEasing:(NSString *)easing {
    if ([easing isEqualToString:@"linear"]) {
        return [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionLinear];
    } else if ([easing isEqualToString:@"ease-in"]) {
        return [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseIn];
    } else if ([easing isEqualToString:@"ease-out"]) {
        return [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseOut];
    } else if ([easing isEqualToString:@"ease-in-out"]) {
        return [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
    } else {
        return [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionLinear];
    }
}

#pragma mark - CAAnimationDelegate

- (void)animationDidStart:(CAAnimation *)anim {
    VRTLogDebug(@"Animation did start");
    
    if (_onStart) {
        _onStart(@{});
    }
}

- (void)animationDidStop:(CAAnimation *)anim finished:(BOOL)flag {
    VRTLogDebug(@"Animation did stop (finished: %d)", flag);
    
    _isAnimating = NO;
    _isPaused = NO;
    
    if (flag) {
        // Animation completed normally
        if (_onFinish) {
            _onFinish(@{});
        }
    } else {
        // Animation was cancelled
        if (_onCancel) {
            _onCancel(@{});
        }
    }
}

#pragma mark - Layout

- (void)layoutSubviews {
    [super layoutSubviews];
    
    // Update animation if needed based on layout changes
    if (_isAnimating) {
        [self updateAnimation];
    }
}

- (void)dealloc
{
    VRTLogDebug(@"ViroAnimatedComponent deallocating");
    
    // Clean up ViroReact resources
    if (_vroAnimationGroup) {
        _vroAnimationGroup->terminate();
        _vroAnimationGroup = nullptr;
    }
    _vroNode = nullptr;
    _vroTransaction = nullptr;
}

@end