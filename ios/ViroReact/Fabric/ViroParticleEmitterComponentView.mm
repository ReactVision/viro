//
//  ViroParticleEmitterComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroParticleEmitterComponentView.h"
#import "ViroReactUtils.h"
#import "ViroLog.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <QuartzCore/QuartzCore.h>
#import <SceneKit/SceneKit.h>

typedef NS_ENUM(NSInteger, ViroEmissionShape) {
    ViroEmissionShapePoint = 0,
    ViroEmissionShapeSphere,
    ViroEmissionShapeBox,
    ViroEmissionShapeCone,
    ViroEmissionShapeCircle
};

typedef NS_ENUM(NSInteger, ViroParticleBlendMode) {
    ViroParticleBlendModeAlpha = 0,
    ViroParticleBlendModeAdditive,
    ViroParticleBlendModeSubtract,
    ViroParticleBlendModeMultiply,
    ViroParticleBlendModeScreen
};

@implementation ViroParticleEmitterComponentView {
    // ViroReact Integration
    std::shared_ptr<VROParticleEmitter> _vroParticleEmitter;
    std::shared_ptr<VRONode> _vroNode;
    
    // Particle emission
    CGFloat _emissionRate;
    NSInteger _burstCount;
    CGFloat _duration;
    CGFloat _delay;
    BOOL _looping;
    BOOL _prewarm;
    NSInteger _maxParticles;
    
    // Particle appearance
    NSDictionary *_image;
    NSArray<NSNumber *> *_color;
    NSArray<NSNumber *> *_colorVariation;
    CGFloat _opacity;
    CGFloat _opacityVariation;
    CGFloat _size;
    CGFloat _sizeVariation;
    CGFloat _rotation;
    CGFloat _rotationVariation;
    
    // Particle physics
    NSArray<NSNumber *> *_velocity;
    NSArray<NSNumber *> *_velocityVariation;
    NSArray<NSNumber *> *_acceleration;
    NSArray<NSNumber *> *_gravity;
    CGFloat _damping;
    CGFloat _angularVelocity;
    CGFloat _angularAcceleration;
    
    // Particle lifecycle
    CGFloat _lifetime;
    CGFloat _lifetimeVariation;
    CGFloat _startSize;
    CGFloat _endSize;
    NSArray<NSNumber *> *_startColor;
    NSArray<NSNumber *> *_endColor;
    CGFloat _startOpacity;
    CGFloat _endOpacity;
    
    // Emission shape
    NSString *_emissionShape;
    CGFloat _emissionRadius;
    CGFloat _emissionAngle;
    CGFloat _emissionWidth;
    CGFloat _emissionHeight;
    CGFloat _emissionDepth;
    
    // Particle behavior
    NSString *_blendMode;
    NSString *_sortingMode;
    NSString *_alignment;
    BOOL _stretchWithVelocity;
    NSString *_spawnBehavior;
    CGFloat _fixedTimeStep;
    
    // Particle forces
    NSArray<NSDictionary *> *_attractors;
    NSArray<NSDictionary *> *_repulsors;
    NSDictionary *_turbulence;
    NSArray<NSNumber *> *_wind;
    NSArray<NSNumber *> *_magneticField;
    
    // Animation
    NSArray<NSDictionary *> *_animationFrames;
    CGFloat _animationSpeed;
    BOOL _animationLooping;
    BOOL _animationRandomStart;
    
    // Collision
    BOOL _collisionEnabled;
    CGFloat _collisionBounce;
    CGFloat _collisionDamping;
    CGFloat _collisionLifetimeLoss;
    NSArray<NSDictionary *> *_collisionPlanes;
    
    // Performance
    BOOL _cullingEnabled;
    CGFloat _cullingDistance;
    NSString *_levelOfDetail;
    NSString *_updateMode;
    
    // Internal state
    ViroEmissionShape _shapeType;
    ViroParticleBlendMode _blendModeType;
    SCNParticleSystem *_particleSystem;
    SCNNode *_particleNode;
    BOOL _isEmitting;
    BOOL _isPaused;
    NSInteger _activeParticleCount;
    CGFloat _systemAge;
    NSDate *_startTime;
    NSTimer *_updateTimer;
    
    // Event blocks
    RCTBubblingEventBlock _onParticleSpawn;
    RCTBubblingEventBlock _onParticleDeath;
    RCTBubblingEventBlock _onParticleCollision;
    RCTBubblingEventBlock _onSystemStart;
    RCTBubblingEventBlock _onSystemStop;
    RCTBubblingEventBlock _onSystemComplete;
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const facebook::react::ViroParticleEmitterProps>();
        _props = defaultProps;
        
        // Initialize particle emission
        _emissionRate = 100.0f;
        _burstCount = 0;
        _duration = 0.0f; // 0 means infinite
        _delay = 0.0f;
        _looping = YES;
        _prewarm = NO;
        _maxParticles = 1000;
        
        // Initialize particle appearance
        _color = @[@(1.0), @(1.0), @(1.0), @(1.0)];
        _colorVariation = @[@(0.0), @(0.0), @(0.0), @(0.0)];
        _opacity = 1.0f;
        _opacityVariation = 0.0f;
        _size = 1.0f;
        _sizeVariation = 0.0f;
        _rotation = 0.0f;
        _rotationVariation = 0.0f;
        
        // Initialize particle physics
        _velocity = @[@(0.0), @(1.0), @(0.0)];
        _velocityVariation = @[@(0.5), @(0.5), @(0.5)];
        _acceleration = @[@(0.0), @(0.0), @(0.0)];
        _gravity = @[@(0.0), @(-9.8), @(0.0)];
        _damping = 0.0f;
        _angularVelocity = 0.0f;
        _angularAcceleration = 0.0f;
        
        // Initialize particle lifecycle
        _lifetime = 5.0f;
        _lifetimeVariation = 0.0f;
        _startSize = 1.0f;
        _endSize = 0.0f;
        _startColor = @[@(1.0), @(1.0), @(1.0), @(1.0)];
        _endColor = @[@(1.0), @(1.0), @(1.0), @(0.0)];
        _startOpacity = 1.0f;
        _endOpacity = 0.0f;
        
        // Initialize emission shape
        _emissionShape = @"point";
        _emissionRadius = 1.0f;
        _emissionAngle = 0.0f;
        _emissionWidth = 1.0f;
        _emissionHeight = 1.0f;
        _emissionDepth = 1.0f;
        
        // Initialize particle behavior
        _blendMode = @"alpha";
        _sortingMode = @"distance";
        _alignment = @"billboard";
        _stretchWithVelocity = NO;
        _spawnBehavior = @"random";
        _fixedTimeStep = 1.0f / 60.0f;
        
        // Initialize particle forces
        _attractors = @[];
        _repulsors = @[];
        _wind = @[@(0.0), @(0.0), @(0.0)];
        _magneticField = @[@(0.0), @(0.0), @(0.0)];
        
        // Initialize animation
        _animationFrames = @[];
        _animationSpeed = 1.0f;
        _animationLooping = YES;
        _animationRandomStart = NO;
        
        // Initialize collision
        _collisionEnabled = NO;
        _collisionBounce = 0.8f;
        _collisionDamping = 0.5f;
        _collisionLifetimeLoss = 0.1f;
        _collisionPlanes = @[];
        
        // Initialize performance
        _cullingEnabled = YES;
        _cullingDistance = 100.0f;
        _levelOfDetail = @"medium";
        _updateMode = @"automatic";
        
        // Initialize internal state
        _shapeType = ViroEmissionShapePoint;
        _blendModeType = ViroParticleBlendModeAlpha;
        _isEmitting = NO;
        _isPaused = NO;
        _activeParticleCount = 0;
        _systemAge = 0.0f;
        
        // Initialize ViroReact particle emitter
        [self initializeVROParticleEmitter];
        
        // Create particle system
        [self createParticleSystem];
        
        VRTLogDebug(@"ViroParticleEmitter initialized");
    }
    return self;
}

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroParticleEmitterComponentDescriptor>();
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &viroProps = *std::static_pointer_cast<facebook::react::ViroParticleEmitterProps const>(props);
    const auto &oldViroProps = *std::static_pointer_cast<facebook::react::ViroParticleEmitterProps const>(oldProps);
    
    [super updateProps:props oldProps:oldProps];
    
    // TODO: Update properties from viroProps
    // This will be implemented when Fabric code generation is complete
    VRTLogDebug(@"ViroParticleEmitter props updated");
}

#pragma mark - ViroReact Integration

- (void)initializeVROParticleEmitter
{
    VRTLogDebug(@"Initializing VROParticleEmitter");
    
    // Create VROParticleEmitter
    _vroParticleEmitter = VROParticleEmitter::create();
    
    // Set default properties
    _vroParticleEmitter->setEmissionRate(_emissionRate);
    _vroParticleEmitter->setParticleLifetime(_lifetime);
    _vroParticleEmitter->setMaxParticles(_maxParticles);
    _vroParticleEmitter->setLoop(_looping);
    
    // Set default particle size
    _vroParticleEmitter->setParticleSize(_size);
    
    // Set default velocity
    VROVector3f velocity([_velocity[0] floatValue], [_velocity[1] floatValue], [_velocity[2] floatValue]);
    _vroParticleEmitter->setParticleVelocity(velocity);
    
    // Set default gravity
    VROVector3f gravity([_gravity[0] floatValue], [_gravity[1] floatValue], [_gravity[2] floatValue]);
    _vroParticleEmitter->setGravity(gravity);
    
    // Create VRONode to hold the particle emitter
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setParticleEmitter(_vroParticleEmitter);
    
    VRTLogDebug(@"VROParticleEmitter initialized successfully");
}

#pragma mark - Particle Emission

- (void)setEmissionRate:(CGFloat)emissionRate {
    VRTLogDebug(@"Setting emission rate: %.1f", emissionRate);
    _emissionRate = emissionRate;
    _particleSystem.birthRate = emissionRate;
    
    if (_vroParticleEmitter) {
        _vroParticleEmitter->setEmissionRate(emissionRate);
    }
}

- (void)setBurstCount:(NSInteger)burstCount {
    VRTLogDebug(@"Setting burst count: %ld", (long)burstCount);
    _burstCount = burstCount;
}

- (void)setDuration:(CGFloat)duration {
    VRTLogDebug(@"Setting duration: %.2f", duration);
    _duration = duration;
    _particleSystem.emissionDuration = duration;
    
    if (_vroParticleEmitter) {
        _vroParticleEmitter->setDuration(duration);
    }
}

- (void)setDelay:(CGFloat)delay {
    VRTLogDebug(@"Setting delay: %.2f", delay);
    _delay = delay;
    _particleSystem.idleDuration = delay;
}

- (void)setLooping:(BOOL)looping {
    VRTLogDebug(@"Setting looping: %d", looping);
    _looping = looping;
    _particleSystem.loops = looping;
    
    if (_vroParticleEmitter) {
        _vroParticleEmitter->setLoop(looping);
    }
}

- (void)setPrewarm:(BOOL)prewarm {
    VRTLogDebug(@"Setting prewarm: %d", prewarm);
    _prewarm = prewarm;
    _particleSystem.warmupDuration = prewarm ? 1.0f : 0.0f;
}

- (void)setMaxParticles:(NSInteger)maxParticles {
    VRTLogDebug(@"Setting max particles: %ld", (long)maxParticles);
    _maxParticles = maxParticles;
    
    if (_vroParticleEmitter) {
        _vroParticleEmitter->setMaxParticles((int)maxParticles);
    }
}

#pragma mark - Particle Appearance

- (void)setImage:(nullable NSDictionary *)image {
    VRTLogDebug(@"Setting image: %@", image);
    _image = image;
    
    if (image) {
        // TODO: Load image and set as particle texture
        // _particleSystem.particleImage = [self loadImageFromSource:image];
    }
}

- (void)setColor:(nullable NSArray<NSNumber *> *)color {
    VRTLogDebug(@"Setting color: %@", color);
    _color = color ?: @[@(1.0), @(1.0), @(1.0), @(1.0)];
    _particleSystem.particleColor = [self colorFromArray:_color];
}

- (void)setColorVariation:(nullable NSArray<NSNumber *> *)colorVariation {
    VRTLogDebug(@"Setting color variation: %@", colorVariation);
    _colorVariation = colorVariation ?: @[@(0.0), @(0.0), @(0.0), @(0.0)];
    _particleSystem.particleColorVariation = [self vector4FromArray:_colorVariation];
}

- (void)setOpacity:(CGFloat)opacity {
    VRTLogDebug(@"Setting opacity: %.2f", opacity);
    _opacity = opacity;
    _particleSystem.particleColor = [self colorFromArray:_color];
}

- (void)setOpacityVariation:(CGFloat)opacityVariation {
    VRTLogDebug(@"Setting opacity variation: %.2f", opacityVariation);
    _opacityVariation = opacityVariation;
    // Apply opacity variation to color variation
    SCNVector4 colorVar = _particleSystem.particleColorVariation;
    colorVar.w = opacityVariation;
    _particleSystem.particleColorVariation = colorVar;
}

- (void)setSize:(CGFloat)size {
    VRTLogDebug(@"Setting size: %.2f", size);
    _size = size;
    _particleSystem.particleSize = size;
    
    if (_vroParticleEmitter) {
        _vroParticleEmitter->setParticleSize(size);
    }
}

- (void)setSizeVariation:(CGFloat)sizeVariation {
    VRTLogDebug(@"Setting size variation: %.2f", sizeVariation);
    _sizeVariation = sizeVariation;
    _particleSystem.particleSizeVariation = sizeVariation;
}

- (void)setRotation:(CGFloat)rotation {
    VRTLogDebug(@"Setting rotation: %.2f", rotation);
    _rotation = rotation;
    _particleSystem.particleAngle = rotation;
}

- (void)setRotationVariation:(CGFloat)rotationVariation {
    VRTLogDebug(@"Setting rotation variation: %.2f", rotationVariation);
    _rotationVariation = rotationVariation;
    _particleSystem.particleAngleVariation = rotationVariation;
}

#pragma mark - Particle Physics

- (void)setVelocity:(nullable NSArray<NSNumber *> *)velocity {
    VRTLogDebug(@"Setting velocity: %@", velocity);
    _velocity = velocity ?: @[@(0.0), @(1.0), @(0.0)];
    _particleSystem.particleVelocity = [self vector3FromArray:_velocity];
    
    if (_vroParticleEmitter) {
        VROVector3f vel([_velocity[0] floatValue], [_velocity[1] floatValue], [_velocity[2] floatValue]);
        _vroParticleEmitter->setParticleVelocity(vel);
    }
}

- (void)setVelocityVariation:(nullable NSArray<NSNumber *> *)velocityVariation {
    VRTLogDebug(@"Setting velocity variation: %@", velocityVariation);
    _velocityVariation = velocityVariation ?: @[@(0.5), @(0.5), @(0.5)];
    _particleSystem.particleVelocityVariation = [self vector3FromArray:_velocityVariation];
}

- (void)setAcceleration:(nullable NSArray<NSNumber *> *)acceleration {
    VRTLogDebug(@"Setting acceleration: %@", acceleration);
    _acceleration = acceleration ?: @[@(0.0), @(0.0), @(0.0)];
    _particleSystem.acceleration = [self vector3FromArray:_acceleration];
}

- (void)setGravity:(nullable NSArray<NSNumber *> *)gravity {
    VRTLogDebug(@"Setting gravity: %@", gravity);
    _gravity = gravity ?: @[@(0.0), @(-9.8), @(0.0)];
    // SceneKit uses acceleration for gravity
    _particleSystem.acceleration = [self vector3FromArray:_gravity];
    
    if (_vroParticleEmitter) {
        VROVector3f grav([_gravity[0] floatValue], [_gravity[1] floatValue], [_gravity[2] floatValue]);
        _vroParticleEmitter->setGravity(grav);
    }
}

- (void)setDamping:(CGFloat)damping {
    VRTLogDebug(@"Setting damping: %.2f", damping);
    _damping = damping;
    _particleSystem.dampingFactor = damping;
}

- (void)setAngularVelocity:(CGFloat)angularVelocity {
    VRTLogDebug(@"Setting angular velocity: %.2f", angularVelocity);
    _angularVelocity = angularVelocity;
    _particleSystem.particleAngularVelocity = angularVelocity;
}

- (void)setAngularAcceleration:(CGFloat)angularAcceleration {
    VRTLogDebug(@"Setting angular acceleration: %.2f", angularAcceleration);
    _angularAcceleration = angularAcceleration;
    // SceneKit doesn't have angular acceleration, we'll implement this in update logic
}

#pragma mark - Particle Lifecycle

- (void)setLifetime:(CGFloat)lifetime {
    VRTLogDebug(@"Setting lifetime: %.2f", lifetime);
    _lifetime = lifetime;
    _particleSystem.particleLifeSpan = lifetime;
    
    if (_vroParticleEmitter) {
        _vroParticleEmitter->setParticleLifetime(lifetime);
    }
}

- (void)setLifetimeVariation:(CGFloat)lifetimeVariation {
    VRTLogDebug(@"Setting lifetime variation: %.2f", lifetimeVariation);
    _lifetimeVariation = lifetimeVariation;
    _particleSystem.particleLifeSpanVariation = lifetimeVariation;
}

- (void)setStartSize:(CGFloat)startSize {
    VRTLogDebug(@"Setting start size: %.2f", startSize);
    _startSize = startSize;
    _particleSystem.particleSize = startSize;
}

- (void)setEndSize:(CGFloat)endSize {
    VRTLogDebug(@"Setting end size: %.2f", endSize);
    _endSize = endSize;
    
    // Create size controller for size over lifetime
    SCNParticlePropertyController *sizeController = [SCNParticlePropertyController controllerWithAnimation:[self createSizeAnimation]];
    [_particleSystem setPropertyController:sizeController forProperty:SCNParticlePropertySize];
}

- (void)setStartColor:(nullable NSArray<NSNumber *> *)startColor {
    VRTLogDebug(@"Setting start color: %@", startColor);
    _startColor = startColor ?: @[@(1.0), @(1.0), @(1.0), @(1.0)];
    _particleSystem.particleColor = [self colorFromArray:_startColor];
}

- (void)setEndColor:(nullable NSArray<NSNumber *> *)endColor {
    VRTLogDebug(@"Setting end color: %@", endColor);
    _endColor = endColor ?: @[@(1.0), @(1.0), @(1.0), @(0.0)];
    
    // Create color controller for color over lifetime
    SCNParticlePropertyController *colorController = [SCNParticlePropertyController controllerWithAnimation:[self createColorAnimation]];
    [_particleSystem setPropertyController:colorController forProperty:SCNParticlePropertyColor];
}

- (void)setStartOpacity:(CGFloat)startOpacity {
    VRTLogDebug(@"Setting start opacity: %.2f", startOpacity);
    _startOpacity = startOpacity;
    [self updateOpacityAnimation];
}

- (void)setEndOpacity:(CGFloat)endOpacity {
    VRTLogDebug(@"Setting end opacity: %.2f", endOpacity);
    _endOpacity = endOpacity;
    [self updateOpacityAnimation];
}

#pragma mark - Emission Shape

- (void)setEmissionShape:(nullable NSString *)emissionShape {
    VRTLogDebug(@"Setting emission shape: %@", emissionShape);
    _emissionShape = emissionShape ?: @"point";
    
    if ([_emissionShape isEqualToString:@"point"]) {
        _shapeType = ViroEmissionShapePoint;
    } else if ([_emissionShape isEqualToString:@"sphere"]) {
        _shapeType = ViroEmissionShapeSphere;
    } else if ([_emissionShape isEqualToString:@"box"]) {
        _shapeType = ViroEmissionShapeBox;
    } else if ([_emissionShape isEqualToString:@"cone"]) {
        _shapeType = ViroEmissionShapeCone;
    } else if ([_emissionShape isEqualToString:@"circle"]) {
        _shapeType = ViroEmissionShapeCircle;
    }
    
    [self updateEmissionShape];
}

- (void)setEmissionRadius:(CGFloat)emissionRadius {
    VRTLogDebug(@"Setting emission radius: %.2f", emissionRadius);
    _emissionRadius = emissionRadius;
    [self updateEmissionShape];
}

- (void)setEmissionAngle:(CGFloat)emissionAngle {
    VRTLogDebug(@"Setting emission angle: %.2f", emissionAngle);
    _emissionAngle = emissionAngle;
    _particleSystem.spreadingAngle = emissionAngle;
}

- (void)setEmissionWidth:(CGFloat)emissionWidth {
    VRTLogDebug(@"Setting emission width: %.2f", emissionWidth);
    _emissionWidth = emissionWidth;
    [self updateEmissionShape];
}

- (void)setEmissionHeight:(CGFloat)emissionHeight {
    VRTLogDebug(@"Setting emission height: %.2f", emissionHeight);
    _emissionHeight = emissionHeight;
    [self updateEmissionShape];
}

- (void)setEmissionDepth:(CGFloat)emissionDepth {
    VRTLogDebug(@"Setting emission depth: %.2f", emissionDepth);
    _emissionDepth = emissionDepth;
    [self updateEmissionShape];
}

#pragma mark - Particle Behavior

- (void)setBlendMode:(nullable NSString *)blendMode {
    VRTLogDebug(@"Setting blend mode: %@", blendMode);
    _blendMode = blendMode ?: @"alpha";
    
    if ([_blendMode isEqualToString:@"alpha"]) {
        _blendModeType = ViroParticleBlendModeAlpha;
        _particleSystem.blendMode = SCNParticleBlendModeAlpha;
    } else if ([_blendMode isEqualToString:@"additive"]) {
        _blendModeType = ViroParticleBlendModeAdditive;
        _particleSystem.blendMode = SCNParticleBlendModeAdd;
    } else if ([_blendMode isEqualToString:@"subtract"]) {
        _blendModeType = ViroParticleBlendModeSubtract;
        _particleSystem.blendMode = SCNParticleBlendModeSubtract;
    } else if ([_blendMode isEqualToString:@"multiply"]) {
        _blendModeType = ViroParticleBlendModeMultiply;
        _particleSystem.blendMode = SCNParticleBlendModeMultiply;
    } else if ([_blendMode isEqualToString:@"screen"]) {
        _blendModeType = ViroParticleBlendModeScreen;
        _particleSystem.blendMode = SCNParticleBlendModeScreen;
    }
}

- (void)setSortingMode:(nullable NSString *)sortingMode {
    VRTLogDebug(@"Setting sorting mode: %@", sortingMode);
    _sortingMode = sortingMode ?: @"distance";
    
    if ([_sortingMode isEqualToString:@"distance"]) {
        _particleSystem.sortingMode = SCNParticleSortingModeDistance;
    } else if ([_sortingMode isEqualToString:@"oldest_first"]) {
        _particleSystem.sortingMode = SCNParticleSortingModeOldestFirst;
    } else if ([_sortingMode isEqualToString:@"youngest_first"]) {
        _particleSystem.sortingMode = SCNParticleSortingModeYoungestFirst;
    } else if ([_sortingMode isEqualToString:@"projected_depth"]) {
        _particleSystem.sortingMode = SCNParticleSortingModeProjectedDepth;
    }
}

- (void)setAlignment:(nullable NSString *)alignment {
    VRTLogDebug(@"Setting alignment: %@", alignment);
    _alignment = alignment ?: @"billboard";
    
    if ([_alignment isEqualToString:@"billboard"]) {
        _particleSystem.orientationMode = SCNParticleOrientationModeBillboardScreenAligned;
    } else if ([_alignment isEqualToString:@"velocity"]) {
        _particleSystem.orientationMode = SCNParticleOrientationModeVelocityAligned;
    } else if ([_alignment isEqualToString:@"free"]) {
        _particleSystem.orientationMode = SCNParticleOrientationModeFree;
    }
}

- (void)setStretchWithVelocity:(BOOL)stretchWithVelocity {
    VRTLogDebug(@"Setting stretch with velocity: %d", stretchWithVelocity);
    _stretchWithVelocity = stretchWithVelocity;
    _particleSystem.stretchFactor = stretchWithVelocity ? 1.0f : 0.0f;
}

- (void)setSpawnBehavior:(nullable NSString *)spawnBehavior {
    VRTLogDebug(@"Setting spawn behavior: %@", spawnBehavior);
    _spawnBehavior = spawnBehavior ?: @"random";
    // Custom implementation for spawn behavior
}

- (void)setFixedTimeStep:(CGFloat)fixedTimeStep {
    VRTLogDebug(@"Setting fixed time step: %.4f", fixedTimeStep);
    _fixedTimeStep = fixedTimeStep;
    _particleSystem.fixedTimeStep = fixedTimeStep;
}

#pragma mark - Particle Forces

- (void)setAttractors:(nullable NSArray<NSDictionary *> *)attractors {
    VRTLogDebug(@"Setting attractors: %@", attractors);
    _attractors = attractors ?: @[];
    // TODO: Implement attractors using SCNParticlePropertyController
}

- (void)setRepulsors:(nullable NSArray<NSDictionary *> *)repulsors {
    VRTLogDebug(@"Setting repulsors: %@", repulsors);
    _repulsors = repulsors ?: @[];
    // TODO: Implement repulsors using SCNParticlePropertyController
}

- (void)setTurbulence:(nullable NSDictionary *)turbulence {
    VRTLogDebug(@"Setting turbulence: %@", turbulence);
    _turbulence = turbulence;
    // TODO: Implement turbulence using SCNParticlePropertyController
}

- (void)setWind:(nullable NSArray<NSNumber *> *)wind {
    VRTLogDebug(@"Setting wind: %@", wind);
    _wind = wind ?: @[@(0.0), @(0.0), @(0.0)];
    // TODO: Implement wind force
}

- (void)setMagneticField:(nullable NSArray<NSNumber *> *)magneticField {
    VRTLogDebug(@"Setting magnetic field: %@", magneticField);
    _magneticField = magneticField ?: @[@(0.0), @(0.0), @(0.0)];
    // TODO: Implement magnetic field force
}

#pragma mark - Animation

- (void)setAnimationFrames:(nullable NSArray<NSDictionary *> *)animationFrames {
    VRTLogDebug(@"Setting animation frames: %@", animationFrames);
    _animationFrames = animationFrames ?: @[];
    // TODO: Implement frame animation
}

- (void)setAnimationSpeed:(CGFloat)animationSpeed {
    VRTLogDebug(@"Setting animation speed: %.2f", animationSpeed);
    _animationSpeed = animationSpeed;
    _particleSystem.speedFactor = animationSpeed;
}

- (void)setAnimationLooping:(BOOL)animationLooping {
    VRTLogDebug(@"Setting animation looping: %d", animationLooping);
    _animationLooping = animationLooping;
}

- (void)setAnimationRandomStart:(BOOL)animationRandomStart {
    VRTLogDebug(@"Setting animation random start: %d", animationRandomStart);
    _animationRandomStart = animationRandomStart;
}

#pragma mark - Collision

- (void)setCollisionEnabled:(BOOL)collisionEnabled {
    VRTLogDebug(@"Setting collision enabled: %d", collisionEnabled);
    _collisionEnabled = collisionEnabled;
    // TODO: Implement collision detection
}

- (void)setCollisionBounce:(CGFloat)collisionBounce {
    VRTLogDebug(@"Setting collision bounce: %.2f", collisionBounce);
    _collisionBounce = collisionBounce;
}

- (void)setCollisionDamping:(CGFloat)collisionDamping {
    VRTLogDebug(@"Setting collision damping: %.2f", collisionDamping);
    _collisionDamping = collisionDamping;
}

- (void)setCollisionLifetimeLoss:(CGFloat)collisionLifetimeLoss {
    VRTLogDebug(@"Setting collision lifetime loss: %.2f", collisionLifetimeLoss);
    _collisionLifetimeLoss = collisionLifetimeLoss;
}

- (void)setCollisionPlanes:(nullable NSArray<NSDictionary *> *)collisionPlanes {
    VRTLogDebug(@"Setting collision planes: %@", collisionPlanes);
    _collisionPlanes = collisionPlanes ?: @[];
    // TODO: Implement collision planes
}

#pragma mark - Performance

- (void)setCullingEnabled:(BOOL)cullingEnabled {
    VRTLogDebug(@"Setting culling enabled: %d", cullingEnabled);
    _cullingEnabled = cullingEnabled;
}

- (void)setCullingDistance:(CGFloat)cullingDistance {
    VRTLogDebug(@"Setting culling distance: %.2f", cullingDistance);
    _cullingDistance = cullingDistance;
}

- (void)setLevelOfDetail:(nullable NSString *)levelOfDetail {
    VRTLogDebug(@"Setting level of detail: %@", levelOfDetail);
    _levelOfDetail = levelOfDetail ?: @"medium";
}

- (void)setUpdateMode:(nullable NSString *)updateMode {
    VRTLogDebug(@"Setting update mode: %@", updateMode);
    _updateMode = updateMode ?: @"automatic";
}

#pragma mark - Events

- (void)setOnParticleSpawn:(nullable RCTBubblingEventBlock)onParticleSpawn {
    _onParticleSpawn = onParticleSpawn;
}

- (void)setOnParticleDeath:(nullable RCTBubblingEventBlock)onParticleDeath {
    _onParticleDeath = onParticleDeath;
}

- (void)setOnParticleCollision:(nullable RCTBubblingEventBlock)onParticleCollision {
    _onParticleCollision = onParticleCollision;
}

- (void)setOnSystemStart:(nullable RCTBubblingEventBlock)onSystemStart {
    _onSystemStart = onSystemStart;
}

- (void)setOnSystemStop:(nullable RCTBubblingEventBlock)onSystemStop {
    _onSystemStop = onSystemStop;
}

- (void)setOnSystemComplete:(nullable RCTBubblingEventBlock)onSystemComplete {
    _onSystemComplete = onSystemComplete;
}

#pragma mark - Particle System Control Methods

- (void)startEmission {
    VRTLogDebug(@"Starting particle emission");
    
    if (_isEmitting) {
        VRTLogDebug(@"Particle system already emitting");
        return;
    }
    
    _isEmitting = YES;
    _isPaused = NO;
    _startTime = [NSDate date];
    _systemAge = 0.0f;
    
    // Start the particle system
    [_particleSystem reset];
    _particleSystem.birthRate = _emissionRate;
    
    // Start ViroReact particle emitter
    if (_vroParticleEmitter) {
        _vroParticleEmitter->start();
    }
    
    // Start update timer
    [self startUpdateTimer];
    
    // Fire system start event
    if (_onSystemStart) {
        _onSystemStart(@{});
    }
}

- (void)stopEmission {
    VRTLogDebug(@"Stopping particle emission");
    
    if (!_isEmitting) {
        VRTLogDebug(@"Particle system not emitting");
        return;
    }
    
    _isEmitting = NO;
    _isPaused = NO;
    
    // Stop the particle system
    _particleSystem.birthRate = 0.0f;
    
    // Stop ViroReact particle emitter
    if (_vroParticleEmitter) {
        _vroParticleEmitter->stop();
    }
    
    // Stop update timer
    [self stopUpdateTimer];
    
    // Fire system stop event
    if (_onSystemStop) {
        _onSystemStop(@{});
    }
}

- (void)pauseEmission {
    VRTLogDebug(@"Pausing particle emission");
    
    if (!_isEmitting || _isPaused) {
        VRTLogDebug(@"Particle system not emitting or already paused");
        return;
    }
    
    _isPaused = YES;
    _particleSystem.birthRate = 0.0f;
    
    // Pause ViroReact particle emitter
    if (_vroParticleEmitter) {
        _vroParticleEmitter->pause();
    }
    
    // Pause update timer
    [self stopUpdateTimer];
}

- (void)resumeEmission {
    VRTLogDebug(@"Resuming particle emission");
    
    if (!_isEmitting || !_isPaused) {
        VRTLogDebug(@"Particle system not emitting or not paused");
        return;
    }
    
    _isPaused = NO;
    _particleSystem.birthRate = _emissionRate;
    
    // Resume ViroReact particle emitter
    if (_vroParticleEmitter) {
        _vroParticleEmitter->resume();
    }
    
    // Resume update timer
    [self startUpdateTimer];
}

- (void)resetSystem {
    VRTLogDebug(@"Resetting particle system");
    
    [_particleSystem reset];
    
    // Reset ViroReact particle emitter
    if (_vroParticleEmitter) {
        _vroParticleEmitter->reset();
    }
    
    _systemAge = 0.0f;
    _activeParticleCount = 0;
    _startTime = [NSDate date];
}

- (void)burst:(NSInteger)count {
    VRTLogDebug(@"Bursting %ld particles", (long)count);
    
    // Temporarily increase birth rate for burst
    CGFloat originalBirthRate = _particleSystem.birthRate;
    _particleSystem.birthRate = count * 60.0f; // Assume 60 FPS
    
    // Reset birth rate after a short delay
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0/60.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        self->_particleSystem.birthRate = originalBirthRate;
    });
}

- (void)setEmissionEnabled:(BOOL)enabled {
    VRTLogDebug(@"Setting emission enabled: %d", enabled);
    
    if (enabled) {
        [self startEmission];
    } else {
        [self stopEmission];
    }
}

#pragma mark - Particle System State Information

- (BOOL)isEmitting {
    return _isEmitting;
}

- (BOOL)isPaused {
    return _isPaused;
}

- (NSInteger)getActiveParticleCount {
    return _activeParticleCount;
}

- (NSInteger)getTotalParticleCount {
    return _activeParticleCount; // For now, same as active
}

- (CGFloat)getSystemAge {
    if (_startTime) {
        return [[NSDate date] timeIntervalSinceDate:_startTime];
    }
    return 0.0f;
}

- (NSDictionary *)getSystemInfo {
    return @{
        @"emissionRate": @(_emissionRate),
        @"maxParticles": @(_maxParticles),
        @"activeParticles": @(_activeParticleCount),
        @"isEmitting": @(_isEmitting),
        @"isPaused": @(_isPaused),
        @"systemAge": @([self getSystemAge]),
        @"emissionShape": _emissionShape,
        @"blendMode": _blendMode,
        @"sortingMode": _sortingMode,
        @"alignment": _alignment
    };
}

#pragma mark - Particle System Utilities

- (void)setParticleProperty:(NSString *)propertyName value:(nullable id)value forParticle:(NSInteger)particleId {
    VRTLogDebug(@"Setting particle property %@ to %@ for particle %ld", propertyName, value, (long)particleId);
    // TODO: Implement individual particle property setting
}

- (nullable id)getParticleProperty:(NSString *)propertyName forParticle:(NSInteger)particleId {
    VRTLogDebug(@"Getting particle property %@ for particle %ld", propertyName, (long)particleId);
    // TODO: Implement individual particle property getting
    return nil;
}

- (void)applyForceToParticle:(NSArray<NSNumber *> *)force particleId:(NSInteger)particleId {
    VRTLogDebug(@"Applying force %@ to particle %ld", force, (long)particleId);
    // TODO: Implement individual particle force application
}

- (void)applyForceToAllParticles:(NSArray<NSNumber *> *)force {
    VRTLogDebug(@"Applying force %@ to all particles", force);
    // TODO: Implement force application to all particles
}

#pragma mark - Helper Methods

- (void)createParticleSystem {
    _particleSystem = [SCNParticleSystem new];
    
    // Set up basic properties
    _particleSystem.birthRate = _emissionRate;
    _particleSystem.particleLifeSpan = _lifetime;
    _particleSystem.particleSize = _size;
    _particleSystem.particleColor = [self colorFromArray:_color];
    _particleSystem.particleVelocity = [self vector3FromArray:_velocity];
    _particleSystem.acceleration = [self vector3FromArray:_gravity];
    _particleSystem.blendMode = SCNParticleBlendModeAlpha;
    _particleSystem.sortingMode = SCNParticleSortingModeDistance;
    _particleSystem.orientationMode = SCNParticleOrientationModeBillboardScreenAligned;
    
    // Create particle node
    _particleNode = [SCNNode node];
    _particleNode.addParticleSystem(_particleSystem);
    
    // TODO: Add particle node to scene
    // This would be done when integrated with ViroReact scene graph
}

- (void)updateEmissionShape {
    SCNGeometry *emitterGeometry = nil;
    
    switch (_shapeType) {
        case ViroEmissionShapePoint:
            // Point emission - no geometry needed
            break;
        case ViroEmissionShapeSphere:
            emitterGeometry = [SCNSphere sphereWithRadius:_emissionRadius];
            break;
        case ViroEmissionShapeBox:
            emitterGeometry = [SCNBox boxWithWidth:_emissionWidth height:_emissionHeight length:_emissionDepth chamferRadius:0];
            break;
        case ViroEmissionShapeCone:
            emitterGeometry = [SCNCone coneWithTopRadius:0 bottomRadius:_emissionRadius height:_emissionHeight];
            break;
        case ViroEmissionShapeCircle:
            emitterGeometry = [SCNCylinder cylinderWithRadius:_emissionRadius height:0.01f];
            break;
    }
    
    if (emitterGeometry) {
        _particleSystem.emitterShape = emitterGeometry;
    }
}

- (CAKeyframeAnimation *)createSizeAnimation {
    CAKeyframeAnimation *sizeAnimation = [CAKeyframeAnimation animationWithKeyPath:@"particleSize"];
    sizeAnimation.values = @[@(_startSize), @(_endSize)];
    sizeAnimation.keyTimes = @[@(0.0), @(1.0)];
    sizeAnimation.duration = _lifetime;
    return sizeAnimation;
}

- (CAKeyframeAnimation *)createColorAnimation {
    CAKeyframeAnimation *colorAnimation = [CAKeyframeAnimation animationWithKeyPath:@"particleColor"];
    colorAnimation.values = @[
        (__bridge id)[self colorFromArray:_startColor].CGColor,
        (__bridge id)[self colorFromArray:_endColor].CGColor
    ];
    colorAnimation.keyTimes = @[@(0.0), @(1.0)];
    colorAnimation.duration = _lifetime;
    return colorAnimation;
}

- (void)updateOpacityAnimation {
    // Update color animation to include opacity changes
    if (_startOpacity != _endOpacity) {
        NSMutableArray *startColorWithOpacity = [_startColor mutableCopy];
        NSMutableArray *endColorWithOpacity = [_endColor mutableCopy];
        
        if (startColorWithOpacity.count > 3) {
            startColorWithOpacity[3] = @(_startOpacity);
        }
        if (endColorWithOpacity.count > 3) {
            endColorWithOpacity[3] = @(_endOpacity);
        }
        
        _startColor = startColorWithOpacity;
        _endColor = endColorWithOpacity;
        
        [self setStartColor:_startColor];
        [self setEndColor:_endColor];
    }
}

- (void)startUpdateTimer {
    [self stopUpdateTimer];
    
    _updateTimer = [NSTimer scheduledTimerWithTimeInterval:_fixedTimeStep target:self selector:@selector(updateParticleSystem) userInfo:nil repeats:YES];
}

- (void)stopUpdateTimer {
    if (_updateTimer) {
        [_updateTimer invalidate];
        _updateTimer = nil;
    }
}

- (void)updateParticleSystem {
    if (!_isEmitting || _isPaused) {
        return;
    }
    
    // Update system age
    _systemAge = [self getSystemAge];
    
    // Update active particle count (estimation)
    _activeParticleCount = (NSInteger)(_emissionRate * _lifetime);
    
    // Check for system completion
    if (_duration > 0 && _systemAge >= _duration && !_looping) {
        [self stopEmission];
        
        if (_onSystemComplete) {
            _onSystemComplete(@{@"systemAge": @(_systemAge)});
        }
    }
    
    // Apply custom forces and behaviors
    [self applyCustomForces];
    
    // Handle collision detection
    if (_collisionEnabled) {
        [self handleCollisions];
    }
    
    // Handle culling
    if (_cullingEnabled) {
        [self handleCulling];
    }
}

- (void)applyCustomForces {
    // TODO: Implement custom force application
    // This would apply attractors, repulsors, turbulence, wind, etc.
}

- (void)handleCollisions {
    // TODO: Implement collision detection and response
}

- (void)handleCulling {
    // TODO: Implement particle culling based on distance
}

- (UIColor *)colorFromArray:(NSArray<NSNumber *> *)colorArray {
    if (!colorArray || colorArray.count < 3) {
        return [UIColor whiteColor];
    }
    
    CGFloat red = [colorArray[0] floatValue];
    CGFloat green = [colorArray[1] floatValue];
    CGFloat blue = [colorArray[2] floatValue];
    CGFloat alpha = colorArray.count > 3 ? [colorArray[3] floatValue] : 1.0f;
    
    return [UIColor colorWithRed:red green:green blue:blue alpha:alpha];
}

- (SCNVector3)vector3FromArray:(NSArray<NSNumber *> *)vectorArray {
    if (!vectorArray || vectorArray.count < 3) {
        return SCNVector3Make(0, 0, 0);
    }
    
    return SCNVector3Make(
        [vectorArray[0] floatValue],
        [vectorArray[1] floatValue],
        [vectorArray[2] floatValue]
    );
}

- (SCNVector4)vector4FromArray:(NSArray<NSNumber *> *)vectorArray {
    if (!vectorArray || vectorArray.count < 4) {
        return SCNVector4Make(0, 0, 0, 0);
    }
    
    return SCNVector4Make(
        [vectorArray[0] floatValue],
        [vectorArray[1] floatValue],
        [vectorArray[2] floatValue],
        [vectorArray[3] floatValue]
    );
}

- (void)dealloc {
    [self stopUpdateTimer];
    
    // Clean up ViroReact resources
    _vroParticleEmitter = nullptr;
    _vroNode = nullptr;
}

@end