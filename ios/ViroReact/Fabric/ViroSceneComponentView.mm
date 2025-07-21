//
//  ViroSceneComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroSceneComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>

@interface ViroSceneComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROScene> vroScene;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroRootNode;

// Scene configuration
@property (nonatomic, strong, nullable) NSDictionary *soundRoom;
@property (nonatomic, strong, nullable) NSDictionary *physicsWorld;
@property (nonatomic, strong, nullable) NSArray *postProcessEffects;
@property (nonatomic, strong, nullable) NSDictionary *lightingEnvironment;
@property (nonatomic, strong, nullable) NSDictionary *backgroundTexture;
@property (nonatomic, strong, nullable) NSDictionary *backgroundCubeTexture;

// Event blocks
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onPlatformUpdate;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onCameraTransformUpdate;

@end

@implementation ViroSceneComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroSceneComponentDescriptor>();
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
    RCTLogInfo(@"[ViroSceneComponentView] Initializing");
    
    // Initialize ViroReact scene
    [self initializeVROScene];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D content to extend beyond bounds
}

#pragma mark - ViroReact Integration

- (void)initializeVROScene
{
    RCTLogInfo(@"[ViroSceneComponentView] Creating VROScene");
    
    // Create ViroReact scene
    _vroScene = VROScene::create();
    
    // Create root node for the scene
    _vroRootNode = std::make_shared<VRONode>();
    _vroScene->setRootNode(_vroRootNode);
    
    // Set default scene properties
    _vroScene->setBackgroundType(VROBackgroundType::None);
    
    RCTLogInfo(@"[ViroSceneComponentView] VROScene created successfully");
}

- (void)updateSceneConfiguration
{
    if (!_vroScene) {
        return;
    }
    
    RCTLogInfo(@"[ViroSceneComponentView] Updating scene configuration");
    
    // Apply lighting environment
    if (_lightingEnvironment) {
        [self applyLightingEnvironment:_lightingEnvironment];
    }
    
    // Apply background configuration
    if (_backgroundTexture) {
        [self applyBackgroundTexture:_backgroundTexture];
    } else if (_backgroundCubeTexture) {
        [self applyBackgroundCubeTexture:_backgroundCubeTexture];
    }
    
    // Apply physics world configuration
    if (_physicsWorld) {
        [self applyPhysicsWorld:_physicsWorld];
    }
    
    // Apply sound room configuration
    if (_soundRoom) {
        [self applySoundRoom:_soundRoom];
    }
    
    // Apply post-process effects
    if (_postProcessEffects) {
        [self applyPostProcessEffects:_postProcessEffects];
    }
}

- (void)applyLightingEnvironment:(NSDictionary *)lightingEnv
{
    NSString *source = lightingEnv[@"source"];
    if (source) {
        // TODO: Load and apply lighting environment texture
        RCTLogInfo(@"[ViroSceneComponentView] Applying lighting environment: %@", source);
    }
}

- (void)applyBackgroundTexture:(NSDictionary *)texture
{
    NSString *source = texture[@"source"];
    if (source) {
        RCTLogInfo(@"[ViroSceneComponentView] Applying background texture: %@", source);
        _vroScene->setBackgroundType(VROBackgroundType::Sphere);
        // TODO: Load and apply background texture
    }
}

- (void)applyBackgroundCubeTexture:(NSDictionary *)cubeTexture
{
    NSArray *sources = cubeTexture[@"source"];
    if (sources && sources.count == 6) {
        RCTLogInfo(@"[ViroSceneComponentView] Applying background cube texture");
        _vroScene->setBackgroundType(VROBackgroundType::Cube);
        // TODO: Load and apply cube map textures
    }
}

- (void)applyPhysicsWorld:(NSDictionary *)physicsWorld
{
    NSArray *gravity = physicsWorld[@"gravity"];
    if (gravity && gravity.count >= 3) {
        VROVector3f gravityVector([gravity[0] floatValue], [gravity[1] floatValue], [gravity[2] floatValue]);
        RCTLogInfo(@"[ViroSceneComponentView] Setting physics gravity: [%.2f, %.2f, %.2f]", 
                   gravityVector.x, gravityVector.y, gravityVector.z);
        // TODO: Apply gravity to physics world
    }
    
    BOOL drawBounds = [physicsWorld[@"drawBounds"] boolValue];
    if (drawBounds) {
        RCTLogInfo(@"[ViroSceneComponentView] Enabling physics debug drawing");
        // TODO: Enable physics debug rendering
    }
}

- (void)applySoundRoom:(NSDictionary *)soundRoom
{
    NSString *roomType = soundRoom[@"roomType"];
    NSNumber *size = soundRoom[@"size"];
    NSNumber *wallMaterial = soundRoom[@"wallMaterial"];
    
    RCTLogInfo(@"[ViroSceneComponentView] Applying sound room - Type: %@, Size: %@, Material: %@", 
               roomType, size, wallMaterial);
    
    // TODO: Configure spatial audio environment
}

- (void)applyPostProcessEffects:(NSArray *)effects
{
    RCTLogInfo(@"[ViroSceneComponentView] Applying %lu post-process effects", (unsigned long)effects.count);
    
    for (NSDictionary *effect in effects) {
        NSString *type = effect[@"type"];
        if ([type isEqualToString:@"bloom"]) {
            // TODO: Apply bloom effect
            RCTLogInfo(@"[ViroSceneComponentView] Applying bloom effect");
        } else if ([type isEqualToString:@"hdr"]) {
            // TODO: Apply HDR tone mapping
            RCTLogInfo(@"[ViroSceneComponentView] Applying HDR tone mapping");
        } else if ([type isEqualToString:@"fxaa"]) {
            // TODO: Apply FXAA anti-aliasing
            RCTLogInfo(@"[ViroSceneComponentView] Applying FXAA anti-aliasing");
        }
    }
}

#pragma mark - Configuration Methods

- (void)setSoundRoom:(nullable NSDictionary *)soundRoom
{
    RCTLogInfo(@"[ViroSceneComponentView] Setting sound room: %@", soundRoom);
    _soundRoom = soundRoom;
    
    [self updateSceneConfiguration];
}

- (void)setPhysicsWorld:(nullable NSDictionary *)physicsWorld
{
    RCTLogInfo(@"[ViroSceneComponentView] Setting physics world: %@", physicsWorld);
    _physicsWorld = physicsWorld;
    
    [self updateSceneConfiguration];
}

- (void)setPostProcessEffects:(nullable NSArray *)effects
{
    RCTLogInfo(@"[ViroSceneComponentView] Setting post process effects: %@", effects);
    _postProcessEffects = effects;
    
    [self updateSceneConfiguration];
}

- (void)setLightingEnvironment:(nullable NSDictionary *)lightingEnv
{
    RCTLogInfo(@"[ViroSceneComponentView] Setting lighting environment: %@", lightingEnv);
    _lightingEnvironment = lightingEnv;
    
    [self updateSceneConfiguration];
}

- (void)setBackgroundTexture:(nullable NSDictionary *)texture
{
    RCTLogInfo(@"[ViroSceneComponentView] Setting background texture: %@", texture);
    _backgroundTexture = texture;
    
    [self updateSceneConfiguration];
}

- (void)setBackgroundCubeTexture:(nullable NSDictionary *)cubeTexture
{
    RCTLogInfo(@"[ViroSceneComponentView] Setting background cube texture: %@", cubeTexture);
    _backgroundCubeTexture = cubeTexture;
    
    [self updateSceneConfiguration];
}

#pragma mark - Event Handling

- (void)setOnPlatformUpdate:(nullable RCTBubblingEventBlock)onPlatformUpdate
{
    _onPlatformUpdate = onPlatformUpdate;
    
    // Register for platform update events from ViroReact renderer
    // This will be handled by the parent scene navigator
}

- (void)setOnCameraTransformUpdate:(nullable RCTBubblingEventBlock)onCameraTransformUpdate
{
    _onCameraTransformUpdate = onCameraTransformUpdate;
    
    // Register for camera transform update events from ViroReact renderer
    // This will be handled by the parent scene navigator
}

#pragma mark - Event Emission

- (void)emitPlatformUpdateEvent:(NSDictionary *)platformInfo
{
    if (_onPlatformUpdate) {
        _onPlatformUpdate(@{
            @"platformInfo": platformInfo
        });
    }
}

- (void)emitCameraTransformUpdateEvent:(NSDictionary *)cameraTransform
{
    if (_onCameraTransformUpdate) {
        _onCameraTransformUpdate(@{
            @"cameraTransform": cameraTransform
        });
    }
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    RCTLogInfo(@"[ViroSceneComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // Update scene viewport if needed
    if (_vroScene) {
        // Scene should fill the entire bounds
        // Child components (nodes) will be positioned in 3D space
        [self updateSceneConfiguration];
    }
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroSceneComponentView] Scene added to window");
        
        // Activate scene in ViroReact renderer
        if (_vroScene) {
            [self updateSceneConfiguration];
        }
        
        // Emit platform update event
        [self emitPlatformUpdateEvent:@{
            @"platform": @"ios",
            @"vrMode": @NO,
            @"arMode": @NO
        }];
    } else {
        RCTLogInfo(@"[ViroSceneComponentView] Scene removed from window");
        
        // Scene will be deactivated when the parent navigator removes it
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroSceneComponentView] Deallocating");
    
    // Clean up ViroReact scene resources
    _vroScene = nullptr;
    _vroRootNode = nullptr;
}

@end

Class<RCTComponentViewProtocol> ViroSceneCls(void)
{
    return ViroSceneComponentView.class;
}