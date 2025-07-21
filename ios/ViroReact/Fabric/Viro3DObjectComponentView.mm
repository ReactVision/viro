//
//  Viro3DObjectComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "Viro3DObjectComponentView.h"
#import "ViroReactUtils.h"
#import "ViroLog.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>

@implementation Viro3DObjectComponentView {
    // ViroReact Integration
    std::shared_ptr<VRO3DObject> _vro3DObject;
    std::shared_ptr<VRONode> _vroNode;
    std::shared_ptr<VROLoader> _vroLoader;
    
    // 3D Model properties
    NSDictionary *_source;
    NSString *_uri;
    NSString *_type;
    NSArray<NSDictionary *> *_resources;
    
    // Model appearance
    NSArray<NSString *> *_materials;
    NSInteger _lightReceivingBitMask;
    NSInteger _shadowCastingBitMask;
    
    // Model transformation
    NSArray<NSNumber *> *_scale;
    NSArray<NSNumber *> *_rotation;
    NSArray<NSNumber *> *_position;
    NSArray<NSNumber *> *_pivot;
    
    // Animation properties
    NSDictionary *_animation;
    NSArray<NSDictionary *> *_morphTargets;
    NSMutableDictionary<NSString *, NSNumber *> *_morphTargetWeights;
    
    // Loading configuration
    BOOL _highAccuracyEvents;
    BOOL _ignoreEventHandling;
    
    // Model state
    BOOL _isLoading;
    BOOL _isLoaded;
    
    // Animation state
    NSMutableDictionary<NSString *, NSDictionary *> *_animationStates;
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const facebook::react::Viro3DObjectProps>();
        _props = defaultProps;
        
        // Initialize default values
        _lightReceivingBitMask = 1;
        _shadowCastingBitMask = 1;
        _scale = @[@1.0, @1.0, @1.0];
        _rotation = @[@0.0, @0.0, @0.0];
        _position = @[@0.0, @0.0, @0.0];
        _pivot = @[@0.0, @0.0, @0.0];
        _highAccuracyEvents = NO;
        _ignoreEventHandling = NO;
        _isLoading = NO;
        _isLoaded = NO;
        
        // Initialize state tracking
        _morphTargetWeights = [NSMutableDictionary dictionary];
        _animationStates = [NSMutableDictionary dictionary];
        
        // Initialize ViroReact 3D object
        [self initializeVRO3DObject];
        
        VRTLogDebug(@"Viro3DObject initialized");
    }
    return self;
}

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::Viro3DObjectComponentDescriptor>();
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &viroProps = *std::static_pointer_cast<facebook::react::Viro3DObjectProps const>(props);
    const auto &oldViroProps = *std::static_pointer_cast<facebook::react::Viro3DObjectProps const>(oldProps);
    
    [super updateProps:props oldProps:oldProps];
    
    // TODO: Update properties from viroProps
    // This will be implemented when Fabric code generation is complete
    VRTLogDebug(@"Viro3DObject props updated");
}

#pragma mark - 3D Model Source Properties

- (void)initializeVRO3DObject
{
    VRTLogDebug(@"Initializing VRO3DObject");
    
    // Create VRO3DObject
    _vro3DObject = VRO3DObject::create();
    
    // Create VRONode to hold the 3D object
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vro3DObject);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    _vroNode->setLightReceivingBitMask(_lightReceivingBitMask);
    _vroNode->setShadowCastingBitMask(_shadowCastingBitMask);
    
    // Apply default transform
    [self updateTransform];
    
    VRTLogDebug(@"VRO3DObject initialized successfully");
}

- (void)setSource:(nullable NSDictionary *)source {
    VRTLogDebug(@"Setting 3D object source: %@", source);
    _source = source;
    
    // Extract URI and type from source dictionary
    if (source) {
        NSString *uri = source[@"uri"];
        NSString *type = source[@"type"];
        
        if (uri) {
            [self setUri:uri];
            if (type) {
                [self setType:type];
            }
            
        }
    } else {
        // Clear the 3D object
        [self unload3DObject];
    }
}

- (void)setUri:(nullable NSString *)uri {
    VRTLogDebug(@"Setting 3D object URI: %@", uri);
    _uri = uri;
    
    if (uri && uri.length > 0) {
        [self load3DObjectFromURI:uri];
    }
}

- (void)setType:(nullable NSString *)type {
    VRTLogDebug(@"Setting 3D object type: %@", type);
    _type = type;
    
    // Supported types: OBJ, FBX, GLTF, GLB, DAE
    // Type helps optimize loading and parsing
}

#pragma mark - Model Resources

- (void)setResources:(nullable NSArray<NSDictionary *> *)resources {
    VRTLogDebug(@"Setting 3D object resources: %@", resources);
    _resources = resources;
    
    // Resources include textures, materials, and other assets
    // referenced by the 3D model
    if (_isLoaded) {
        [self applyResourcesToLoadedModel];
    }
}

#pragma mark - Model Appearance

- (void)setMaterials:(nullable NSArray<NSString *> *)materials {
    VRTLogDebug(@"Setting materials: %@", materials);
    _materials = materials;
    
    // TODO: Apply materials to the 3D object
    // This maps material names to ViroReact materials
}

- (void)setLightReceivingBitMask:(NSInteger)lightReceivingBitMask {
    VRTLogDebug(@"Setting light receiving bit mask: %ld", (long)lightReceivingBitMask);
    _lightReceivingBitMask = lightReceivingBitMask;
    
    // TODO: Update light receiving configuration
}

- (void)setShadowCastingBitMask:(NSInteger)shadowCastingBitMask {
    VRTLogDebug(@"Setting shadow casting bit mask: %ld", (long)shadowCastingBitMask);
    _shadowCastingBitMask = shadowCastingBitMask;
    
    // TODO: Update shadow casting configuration
}

#pragma mark - Model Transformation

- (void)setScale:(nullable NSArray<NSNumber *> *)scale {
    VRTLogDebug(@"Setting scale: %@", scale);
    
    if (scale && scale.count >= 3) {
        _scale = scale;
    } else {
        _scale = @[@1.0, @1.0, @1.0];
    }
    
    [self updateModelTransform];
}

- (void)setRotation:(nullable NSArray<NSNumber *> *)rotation {
    VRTLogDebug(@"Setting rotation: %@", rotation);
    
    if (rotation && rotation.count >= 3) {
        _rotation = rotation;
    } else {
        _rotation = @[@0.0, @0.0, @0.0];
    }
    
    [self updateModelTransform];
}

- (void)setPosition:(nullable NSArray<NSNumber *> *)position {
    VRTLogDebug(@"Setting position: %@", position);
    
    if (position && position.count >= 3) {
        _position = position;
    } else {
        _position = @[@0.0, @0.0, @0.0];
    }
    
    [self updateModelTransform];
}

- (void)setPivot:(nullable NSArray<NSNumber *> *)pivot {
    VRTLogDebug(@"Setting pivot: %@", pivot);
    
    if (pivot && pivot.count >= 3) {
        _pivot = pivot;
    } else {
        _pivot = @[@0.0, @0.0, @0.0];
    }
    
    [self updateModelTransform];
}

#pragma mark - Animation Properties

- (void)setAnimation:(nullable NSDictionary *)animation {
    VRTLogDebug(@"Setting animation: %@", animation);
    _animation = animation;
    
    if (animation) {
        NSString *name = animation[@"name"];
        BOOL loop = [animation[@"loop"] boolValue];
        BOOL play = [animation[@"play"] boolValue];
        NSNumber *delay = animation[@"delay"];
        NSNumber *duration = animation[@"duration"];
        
        if (name && play) {
            [self playAnimation:name loop:loop];
        }
    }
}

- (void)setMorphTargets:(nullable NSArray<NSDictionary *> *)morphTargets {
    VRTLogDebug(@"Setting morph targets: %@", morphTargets);
    _morphTargets = morphTargets;
    
    // Apply morph target weights
    for (NSDictionary *target in morphTargets) {
        NSString *name = target[@"name"];
        NSNumber *weight = target[@"weight"];
        
        if (name && weight) {
            [self setMorphTargetWeight:name weight:[weight floatValue]];
        }
    }
}

#pragma mark - Loading Configuration

- (void)setHighAccuracyEvents:(BOOL)highAccuracyEvents {
    VRTLogDebug(@"Setting high accuracy events: %d", highAccuracyEvents);
    _highAccuracyEvents = highAccuracyEvents;
    
    // TODO: Configure event precision
}

- (void)setIgnoreEventHandling:(BOOL)ignoreEventHandling {
    VRTLogDebug(@"Setting ignore event handling: %d", ignoreEventHandling);
    _ignoreEventHandling = ignoreEventHandling;
    
    // TODO: Configure event handling
}

#pragma mark - Events

- (void)setOnLoadStart:(nullable RCTBubblingEventBlock)onLoadStart {
    _onLoadStart = onLoadStart;
}

- (void)setOnLoad:(nullable RCTBubblingEventBlock)onLoad {
    _onLoad = onLoad;
}

- (void)setOnError:(nullable RCTBubblingEventBlock)onError {
    _onError = onError;
}

#pragma mark - Animation Control Methods

- (void)playAnimation:(NSString *)animationName loop:(BOOL)loop {
    VRTLogDebug(@"Playing animation: %@ (loop: %d)", animationName, loop);
    
    if (!_isLoaded) {
        VRTLogWarn(@"Cannot play animation - 3D object not loaded");
        return;
    }
    
    // Store animation state
    _animationStates[animationName] = @{
        @"playing": @YES,
        @"loop": @(loop),
        @"startTime": @(CACurrentMediaTime())
    };
    
    // TODO: Play animation on ViroReact 3D object
    // This will integrate with the ViroReact animation system
}

- (void)pauseAnimation:(NSString *)animationName {
    VRTLogDebug(@"Pausing animation: %@", animationName);
    
    NSMutableDictionary *state = [_animationStates[animationName] mutableCopy];
    if (state) {
        state[@"playing"] = @NO;
        state[@"pauseTime"] = @(CACurrentMediaTime());
        _animationStates[animationName] = state;
    }
    
    // TODO: Pause animation on ViroReact 3D object
}

- (void)stopAnimation:(NSString *)animationName reset:(BOOL)reset {
    VRTLogDebug(@"Stopping animation: %@ (reset: %d)", animationName, reset);
    
    [_animationStates removeObjectForKey:animationName];
    
    // TODO: Stop animation on ViroReact 3D object
    // If reset is YES, return to the first frame
}

#pragma mark - Morph Target Control

- (void)setMorphTargetWeight:(NSString *)targetName weight:(CGFloat)weight {
    VRTLogDebug(@"Setting morph target weight: %@ = %.2f", targetName, weight);
    
    // Clamp weight to [0, 1]
    weight = MAX(0.0f, MIN(1.0f, weight));
    _morphTargetWeights[targetName] = @(weight);
    
    if (_isLoaded) {
        // TODO: Apply morph target weight to ViroReact 3D object
    }
}

#pragma mark - 3D Object Loading

- (void)load3DObjectFromURI:(NSString *)uri {
    VRTLogDebug(@"Loading 3D object from URI: %@", uri);
    
    _isLoading = YES;
    _isLoaded = NO;
    
    // Fire onLoadStart event
    if (_onLoadStart) {
        _onLoadStart(@{});
    }
    
    if (!_vroLoader) {
        _vroLoader = VROLoader::create();
    }
    
    // Create loading callback
    std::function<void(std::shared_ptr<VRONode>, bool)> callback = [self](std::shared_ptr<VRONode> node, bool success) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self handle3DObjectLoaded:node success:success];
        });
    };
    
    // Load the 3D model based on type
    VROResourceType resourceType = [self getResourceTypeFromURI:uri];
    NSURL *modelURL = [NSURL URLWithString:uri];
    
    if (modelURL) {
        _vroLoader->loadAsync(modelURL, resourceType, _vroNode, callback);
    } else {
        [self handle3DObjectLoaded:nullptr success:false];
    }
}

- (void)handle3DObjectLoaded {
    VRTLogDebug(@"3D object loaded successfully");
    
    _isLoading = NO;
    _isLoaded = YES;
    
    // Apply any pending configurations
    [self applyResourcesToLoadedModel];
    [self updateModelTransform];
    
    // Apply morph target weights
    for (NSString *targetName in _morphTargetWeights) {
        CGFloat weight = [_morphTargetWeights[targetName] floatValue];
        // TODO: Apply morph target weight
    }
    
    // Fire onLoad event
    if (_onLoad) {
        NSMutableDictionary *event = [NSMutableDictionary dictionary];
        
        // TODO: Add model information to event
        // - Bounding box
        // - Vertex count
        // - Animation names
        // - Morph target names
        
        _onLoad(event);
    }
}

- (void)handle3DObjectLoadError:(NSString *)error {
    VRTLogError(@"3D object load error: %@", error);
    
    _isLoading = NO;
    _isLoaded = NO;
    
    // Fire onError event
    if (_onError) {
        _onError(@{
            @"error": error ?: @"Unknown error loading 3D object"
        });
    }
}

- (void)unload3DObject {
    VRTLogDebug(@"Unloading 3D object");
    
    _isLoading = NO;
    _isLoaded = NO;
    
    // Clear animation states
    [_animationStates removeAllObjects];
    [_morphTargetWeights removeAllObjects];
    
    // TODO: Remove 3D object from ViroReact scene
}

#pragma mark - Helper Methods

- (void)updateModelTransform {
    if (!_isLoaded) {
        return;
    }
    
    VRTLogDebug(@"Updating model transform - Position: %@, Rotation: %@, Scale: %@, Pivot: %@",
                _position, _rotation, _scale, _pivot);
    
    // TODO: Apply transformation to ViroReact 3D object
    // This includes position, rotation, scale, and pivot point
}

- (void)applyResourcesToLoadedModel {
    if (!_resources || _resources.count == 0) {
        return;
    }
    
    VRTLogDebug(@"Applying %lu resources to loaded model", (unsigned long)_resources.count);
    
    // TODO: Apply resources (textures, materials) to the loaded 3D object
    for (NSDictionary *resource in _resources) {
        NSString *type = resource[@"type"];
        NSString *uri = resource[@"uri"];
        NSString *name = resource[@"name"];
        
        if ([type isEqualToString:@"texture"]) {
            // Load and apply texture
        } else if ([type isEqualToString:@"material"]) {
            // Load and apply material
        }
    }
}

#pragma mark - Layout

- (void)layoutSubviews {
    [super layoutSubviews];
    
    // 3D objects don't have traditional 2D layout,
    // but we may need to update the scene graph here
}

- (void)handle3DObjectLoaded:(std::shared_ptr<VRONode>)node success:(BOOL)success {
    _isLoading = NO;
    _isLoaded = success;
    
    if (success && node) {
        VRTLogDebug(@"3D object loaded successfully");
        
        // Replace the geometry in our node with the loaded model
        _vroNode = node;
        [self updateTransform];
        [self applyResourcesToLoadedModel];
        
        // Fire onLoad event
        if (_onLoad) {
            _onLoad(@{
                @"success": @YES
            });
        }
    } else {
        VRTLogError(@"Failed to load 3D object");
        [self fireErrorEvent:@"Failed to load 3D object"];
    }
}

- (VROResourceType)getResourceTypeFromURI:(NSString *)uri {
    NSString *extension = [[uri pathExtension] lowercaseString];
    
    if ([extension isEqualToString:@"obj"]) {
        return VROResourceType::OBJ;
    } else if ([extension isEqualToString:@"fbx"]) {
        return VROResourceType::FBX;
    } else if ([extension isEqualToString:@"gltf"]) {
        return VROResourceType::GLTF;
    } else if ([extension isEqualToString:@"glb"]) {
        return VROResourceType::GLB;
    } else if ([extension isEqualToString:@"dae"]) {
        return VROResourceType::DAE;
    } else {
        // Default to OBJ
        return VROResourceType::OBJ;
    }
}

- (void)updateTransform {
    if (!_vroNode) {
        return;
    }
    
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
    
    // Apply scale
    if (_scale && _scale.count >= 3) {
        VROVector3f scl([_scale[0] floatValue], [_scale[1] floatValue], [_scale[2] floatValue]);
        _vroNode->setScale(scl);
    }
}

- (void)fireErrorEvent:(NSString *)errorMessage {
    VRTLogError(@"3D Object error: %@", errorMessage);
    
    if (_onError) {
        _onError(@{
            @"error": errorMessage
        });
    }
}

@end