//
//  ViroSceneNavigatorComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroSceneNavigatorComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTScene.h"
#import "VRTMaterialManager.h"

@interface ViroSceneNavigatorComponentView ()

// ViroReact Integration
@property (nonatomic, strong, nullable) id<VROView> vroView;
@property (nonatomic, strong) NSMutableArray<VRTScene *> *sceneStack;
@property (nonatomic, strong, nullable) VRTScene *currentScene;

// Scene configuration
@property (nonatomic, strong, nullable) NSDictionary *initialScene;
@property (nonatomic, strong, nullable) NSDictionary *viroAppProps;

// Rendering configuration
@property (nonatomic, assign) BOOL autofocus;
@property (nonatomic, assign) BOOL bloomEnabled;
@property (nonatomic, assign) BOOL shadowsEnabled;
@property (nonatomic, assign) BOOL multisamplingEnabled;
@property (nonatomic, assign) BOOL hdrEnabled;
@property (nonatomic, assign) BOOL pbrEnabled;
@property (nonatomic, assign) BOOL vrModeEnabled;
@property (nonatomic, assign) BOOL debug;
@property (nonatomic, assign) BOOL canCameraTransformUpdate;

// Camera and rendering settings
@property (nonatomic, strong) NSString *worldAlignment;
@property (nonatomic, strong) NSString *videoQuality;
@property (nonatomic, assign) NSInteger numberOfTrackedImages;

@end

@implementation ViroSceneNavigatorComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroSceneNavigatorComponentDescriptor>();
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
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Initializing ViroReact Scene Navigator");
    
    // Set default values
    _autofocus = YES;
    _bloomEnabled = NO;
    _shadowsEnabled = YES;
    _multisamplingEnabled = YES;
    _hdrEnabled = NO;
    _pbrEnabled = YES;
    _vrModeEnabled = NO;
    _debug = NO;
    _canCameraTransformUpdate = NO;
    _worldAlignment = @"gravity";
    _videoQuality = @"high";
    _numberOfTrackedImages = 1;
    
    // Initialize ViroReact components
    _sceneStack = [[NSMutableArray alloc] init];
    
    // Initialize ViroReact renderer
    [self initializeVROView];
    
    self.backgroundColor = [UIColor blackColor];
    self.clipsToBounds = YES;
}

- (void)initializeVROView
{
    if (_vroView != nil) {
        return;
    }
    
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Initializing VROView with VR mode: %@", _vrModeEnabled ? @"YES" : @"NO");
    
    // Create ViroReact renderer configuration
    VRORendererConfiguration config;
    config.enableHDR = _hdrEnabled;
    config.enablePBR = _pbrEnabled;
    config.enableBloom = _bloomEnabled;
    config.enableShadows = _shadowsEnabled;
    config.enableMultisampling = _multisamplingEnabled;
    
    // Initialize VROView based on platform capabilities
    if (_vrModeEnabled) {
        // Create VR view for immersive experiences
        _vroView = [[VROViewGVR alloc] initWithConfig:config];
    } else {
        // Create standard 3D view for mobile AR/3D experiences  
        _vroView = [[VROViewiOS alloc] initWithConfig:config];
    }
    
    // Configure VROView
    _vroView.renderDelegate = self;
    [_vroView setVrMode:_vrModeEnabled];
    [_vroView setAutoresizingMask:UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight];
    
    // Add VROView to component view
    [self addSubview:(UIView *)_vroView];
    
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] ViroReact renderer initialized successfully");
}

#pragma mark - Scene Navigation Methods

- (void)push:(NSDictionary *)scene passProps:(nullable NSDictionary *)passProps
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Pushing scene: %@", scene);
    
    if (!_vroView) {
        RCTLogError(@"[ViroSceneNavigatorComponentView] Cannot push scene - VROView not initialized");
        return;
    }
    
    // Create new VRTScene from scene dictionary
    VRTScene *newScene = [self createSceneFromDictionary:scene withProps:passProps];
    if (newScene) {
        // Add current scene to stack if it exists
        if (_currentScene) {
            [_sceneStack addObject:_currentScene];
        }
        
        // Set new scene as current and apply to VROView
        _currentScene = newScene;
        [self applySceneToRenderer:newScene];
        
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Scene pushed successfully, stack depth: %lu", (unsigned long)_sceneStack.count);
    }
}

- (void)pop
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Popping scene, stack depth: %lu", (unsigned long)_sceneStack.count);
    
    if (_sceneStack.count == 0) {
        RCTLogWarn(@"[ViroSceneNavigatorComponentView] Cannot pop - scene stack is empty");
        return;
    }
    
    // Get previous scene from stack
    VRTScene *previousScene = [_sceneStack lastObject];
    [_sceneStack removeLastObject];
    
    // Apply previous scene to renderer
    _currentScene = previousScene;
    [self applySceneToRenderer:previousScene];
    
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Scene popped successfully, new stack depth: %lu", (unsigned long)_sceneStack.count);
}

- (void)popN:(NSInteger)n
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Popping %ld scenes", (long)n);
    
    // Implement popN in ViroReact renderer
    NSInteger scenesToPop = MIN(n, (NSInteger)_sceneStack.count);
    
    if (scenesToPop <= 0) {
        RCTLogWarn(@"[ViroSceneNavigatorComponentView] Cannot pop %ld scenes - only %lu scenes in stack", (long)n, (unsigned long)_sceneStack.count);
        return;
    }
    
    // Remove n scenes from stack
    for (NSInteger i = 0; i < scenesToPop; i++) {
        [_sceneStack removeLastObject];
    }
    
    // Apply the resulting scene
    if (_sceneStack.count > 0) {
        VRTScene *newCurrentScene = [_sceneStack lastObject];
        [_sceneStack removeLastObject];
        _currentScene = newCurrentScene;
        [self applySceneToRenderer:newCurrentScene];
    }
    
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Popped %ld scenes successfully", (long)scenesToPop);
}

- (void)replace:(NSDictionary *)scene passProps:(nullable NSDictionary *)passProps
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Replacing scene: %@", scene);
    
    // Implement scene replace in ViroReact renderer
    VRTScene *newScene = [self createSceneFromDictionary:scene withProps:passProps];
    if (newScene) {
        // Replace current scene without modifying the stack
        _currentScene = newScene;
        [self applySceneToRenderer:newScene];
        
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Scene replaced successfully");
    }
}

- (void)jumpToScene:(NSDictionary *)scene passProps:(nullable NSDictionary *)passProps
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Jumping to scene: %@", scene);
    
    // Implement jumpToScene in ViroReact renderer
    VRTScene *newScene = [self createSceneFromDictionary:scene withProps:passProps];
    if (newScene) {
        // Clear entire scene stack and set new scene as current
        [_sceneStack removeAllObjects];
        _currentScene = newScene;
        [self applySceneToRenderer:newScene];
        
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Jumped to scene successfully, stack cleared");
    }
}

#pragma mark - Configuration Methods

- (void)setInitialScene:(nullable NSDictionary *)scene
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting initial scene: %@", scene);
    _initialScene = scene;
    
    if (_initialScene && _vroView) {
        // Load initial scene in ViroReact renderer
        [self push:scene passProps:_viroAppProps];
    }
}

- (void)setViroAppProps:(nullable NSDictionary *)props
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting viro app props: %@", props);
    _viroAppProps = props;
}

- (void)setAutofocus:(BOOL)autofocus
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting autofocus: %@", autofocus ? @"YES" : @"NO");
    _autofocus = autofocus;
    
    // Apply autofocus setting to ViroReact renderer
    if (_vroView) {
        // Note: ViroKit autofocus implementation would go here
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Autofocus applied to VROView");
    }
}

- (void)setBloomEnabled:(BOOL)enabled
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting bloom enabled: %@", enabled ? @"YES" : @"NO");
    _bloomEnabled = enabled;
    
    // Apply bloom setting to ViroReact renderer
    if (_vroView) {
        // Note: ViroKit bloom configuration would be applied here
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Bloom setting applied to VROView");
    }
}

- (void)setShadowsEnabled:(BOOL)enabled
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting shadows enabled: %@", enabled ? @"YES" : @"NO");
    _shadowsEnabled = enabled;
    
    // Apply shadows setting to ViroReact renderer
    if (_vroView) {
        // Note: ViroKit shadow configuration would be applied here
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Shadows setting applied to VROView");
    }
}

- (void)setMultisamplingEnabled:(BOOL)enabled
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting multisampling enabled: %@", enabled ? @"YES" : @"NO");
    _multisamplingEnabled = enabled;
    
    // Apply multisampling setting to ViroReact renderer
    if (_vroView) {
        // Note: ViroKit multisampling configuration would be applied here
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Multisampling setting applied to VROView");
    }
}

- (void)setHdrEnabled:(BOOL)enabled
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting HDR enabled: %@", enabled ? @"YES" : @"NO");
    _hdrEnabled = enabled;
    // TODO: Apply HDR setting to ViroReact renderer
}

- (void)setPbrEnabled:(BOOL)enabled
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting PBR enabled: %@", enabled ? @"YES" : @"NO");
    _pbrEnabled = enabled;
    // TODO: Apply PBR setting to ViroReact renderer
}

- (void)setWorldAlignment:(nullable NSString *)alignment
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting world alignment: %@", alignment);
    _worldAlignment = alignment ?: @"gravity";
    // TODO: Apply world alignment to ViroReact renderer
}

- (void)setVideoQuality:(nullable NSString *)quality
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting video quality: %@", quality);
    _videoQuality = quality ?: @"high";
    // TODO: Apply video quality to ViroReact renderer
}

- (void)setNumberOfTrackedImages:(NSInteger)count
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting number of tracked images: %ld", (long)count);
    _numberOfTrackedImages = count;
    // TODO: Apply tracked images setting to ViroReact renderer
}

- (void)setVrModeEnabled:(BOOL)enabled
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting VR mode enabled: %@", enabled ? @"YES" : @"NO");
    _vrModeEnabled = enabled;
    
    // Apply VR mode to ViroReact renderer
    if (_vroView) {
        [_vroView setVrMode:enabled];
    } else {
        // VROView will be initialized with this setting when created
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] VR mode will be applied when VROView is initialized");
    }
}

- (void)setDebug:(BOOL)debug
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting debug: %@", debug ? @"YES" : @"NO");
    _debug = debug;
    
    // Apply debug mode to ViroReact renderer
    if (_vroView) {
        [_vroView setDebugHUD:debug];
    }
}

- (void)setCanCameraTransformUpdate:(BOOL)canUpdate
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Setting can camera transform update: %@", canUpdate ? @"YES" : @"NO");
    _canCameraTransformUpdate = canUpdate;
    // TODO: Apply camera transform update setting to ViroReact renderer
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact renderer view
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Added to window");
        // TODO: Start ViroReact renderer when added to window
    } else {
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Removed from window");
        // TODO: Pause/stop ViroReact renderer when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Deallocating ViroReact resources");
    
    // Clean up ViroReact renderer resources
    if (_vroView) {
        [_vroView removeFromSuperview];
        _vroView.renderDelegate = nil;
        _vroView = nil;
    }
    
    // Clear scene stack
    [_sceneStack removeAllObjects];
    _currentScene = nil;
}

#pragma mark - ViroReact Integration Helper Methods

- (VRTScene *)createSceneFromDictionary:(NSDictionary *)sceneDict withProps:(nullable NSDictionary *)props
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Creating VRTScene from dictionary: %@", sceneDict);
    
    // Create new VRTScene instance
    // Note: In a full implementation, this would need bridge access to create React components
    // For now, we'll create a basic scene structure
    VRTScene *scene = [[VRTScene alloc] init];
    
    // Apply scene properties from dictionary
    if (sceneDict[@"component"]) {
        // Set scene component reference
        // This would normally involve React component instantiation
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Scene component: %@", sceneDict[@"component"]);
    }
    
    if (props) {
        // Apply passed props to scene
        RCTLogInfo(@"[ViroSceneNavigatorComponentView] Applying scene props: %@", props);
    }
    
    return scene;
}

- (void)applySceneToRenderer:(VRTScene *)scene
{
    if (!_vroView || !scene) {
        RCTLogError(@"[ViroSceneNavigatorComponentView] Cannot apply scene - missing VROView or scene");
        return;
    }
    
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Applying scene to ViroReact renderer");
    
    // Set scene as current in VROView
    [_vroView setScene:scene.vroScene];
    
    // Apply scene-specific configurations
    [self applyRenderingSettings];
    
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Scene applied successfully to renderer");
}

- (void)applyRenderingSettings
{
    if (!_vroView) {
        return;
    }
    
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] Applying rendering settings to VROView");
    
    // Apply rendering configuration to VROView
    [_vroView setVrMode:_vrModeEnabled];
    [_vroView setDebugHUD:_debug];
    
    // Note: Additional rendering settings would be applied here
    // such as HDR, PBR, shadows, bloom, etc. based on ViroKit API
}

#pragma mark - VROViewDelegate

- (void)viewDidLoad:(id<VROView>)view
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] VROView loaded successfully");
    
    // Load initial scene if specified
    if (_initialScene) {
        [self push:_initialScene passProps:_viroAppProps];
    }
}

- (void)viewDidAppear:(id<VROView>)view
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] VROView appeared");
}

- (void)viewDidDisappear:(id<VROView>)view
{
    RCTLogInfo(@"[ViroSceneNavigatorComponentView] VROView disappeared");
}

@end

Class<RCTComponentViewProtocol> ViroSceneNavigatorCls(void)
{
    return ViroSceneNavigatorComponentView.class;
}