//
//  ViroVRSceneNavigatorComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroVRSceneNavigatorComponentView.h"

#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/UIView+React.h>

#import <react/renderer/components/ViroReactSpec/ComponentDescriptors.h>
#import <react/renderer/components/ViroReactSpec/EventEmitters.h>
#import <react/renderer/components/ViroReactSpec/Props.h>
#import <react/renderer/components/ViroReactSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface ViroVRSceneNavigatorComponentView () <RCTViroVRSceneNavigatorViewProtocol>
@end

@implementation ViroVRSceneNavigatorComponentView {
    BOOL _isVRModeActive;
    NSMutableArray<UIView *> *_sceneViews;
    NSInteger _previousSceneIndex;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<ViroVRSceneNavigatorComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ViroVRSceneNavigatorProps>();
        _props = defaultProps;
        
        [self initializeViroVRSceneNavigator];
    }
    
    return self;
}

- (void)initializeViroVRSceneNavigator
{
    NSLog(@"Initializing ViroVRSceneNavigatorComponentView");
    
    // Initialize default values
    _vrModeEnabled = YES;
    _autofocus = YES;
    _debug = NO;
    _currentSceneIndex = 0;
    _previousSceneIndex = -1;
    
    // Renderer settings
    _hdrEnabled = YES;
    _pbrEnabled = YES;
    _bloomEnabled = NO;
    _shadowsEnabled = YES;
    _multisamplingEnabled = YES;
    
    _hasOnExitViroCallback = NO;
    _isVRModeActive = NO;
    
    // Initialize scene management
    _sceneViews = [[NSMutableArray alloc] init];
    
    // Create VR scene view
    _vrSceneView = [[SCNView alloc] initWithFrame:self.bounds];
    _vrSceneView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _vrSceneView.backgroundColor = [UIColor blackColor];
    
    // Create VR scene
    _vrScene = [SCNScene scene];
    _vrSceneView.scene = _vrScene;
    
    // Create VR camera
    _vrCamera = [SCNCamera camera];
    _vrCamera.xFov = 60;
    _vrCamera.yFov = 60;
    _vrCamera.automaticallyAdjustsZRange = YES;
    
    _vrCameraNode = [SCNNode node];
    _vrCameraNode.camera = _vrCamera;
    _vrCameraNode.position = SCNVector3Make(0, 0, 0);
    [_vrScene.rootNode addChildNode:_vrCameraNode];
    
    [self addSubview:_vrSceneView];
    
    // Configure VR renderer
    [self configureVRRenderer];
    
    // TODO: Initialize ViroReact VR system
    // This will need to integrate with the existing ViroReact VR implementation
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<ViroVRSceneNavigatorProps const>(oldProps);
    const auto &newViewProps = *std::static_pointer_cast<ViroVRSceneNavigatorProps const>(props);
    
    // Handle VR mode changes
    if (oldViewProps.vrModeEnabled != newViewProps.vrModeEnabled) {
        _vrModeEnabled = newViewProps.vrModeEnabled;
        NSLog(@"ViroVRSceneNavigator VR mode enabled: %@", _vrModeEnabled ? @"YES" : @"NO");
        
        if (_vrModeEnabled) {
            [self enableVRMode];
        } else {
            [self disableVRMode];
        }
    }
    
    // Handle autofocus changes
    if (oldViewProps.autofocus != newViewProps.autofocus) {
        _autofocus = newViewProps.autofocus;
        NSLog(@"ViroVRSceneNavigator autofocus: %@", _autofocus ? @"YES" : @"NO");
        [self updateVRSettings];
    }
    
    // Handle debug changes
    if (oldViewProps.debug != newViewProps.debug) {
        _debug = newViewProps.debug;
        NSLog(@"ViroVRSceneNavigator debug: %@", _debug ? @"YES" : @"NO");
        _vrSceneView.showsStatistics = _debug;
        _vrSceneView.debugOptions = _debug ? (SCNDebugOptionShowBoundingBoxes | SCNDebugOptionShowWireframe) : SCNDebugOptionNone;
    }
    
    // Handle current scene index changes
    if (oldViewProps.currentSceneIndex != newViewProps.currentSceneIndex) {
        _currentSceneIndex = newViewProps.currentSceneIndex;
        NSLog(@"ViroVRSceneNavigator current scene index: %ld", (long)_currentSceneIndex);
        [self navigateToSceneAtIndex:_currentSceneIndex];
    }
    
    // Handle renderer settings
    if (oldViewProps.hdrEnabled != newViewProps.hdrEnabled) {
        _hdrEnabled = newViewProps.hdrEnabled;
        NSLog(@"ViroVRSceneNavigator HDR enabled: %@", _hdrEnabled ? @"YES" : @"NO");
        [self configureVRRenderer];
    }
    
    if (oldViewProps.pbrEnabled != newViewProps.pbrEnabled) {
        _pbrEnabled = newViewProps.pbrEnabled;
        NSLog(@"ViroVRSceneNavigator PBR enabled: %@", _pbrEnabled ? @"YES" : @"NO");
        [self configureVRRenderer];
    }
    
    if (oldViewProps.shadowsEnabled != newViewProps.shadowsEnabled) {
        _shadowsEnabled = newViewProps.shadowsEnabled;
        NSLog(@"ViroVRSceneNavigator shadows enabled: %@", _shadowsEnabled ? @"YES" : @"NO");
        [self configureVRRenderer];
    }
    
    // Handle callback flags
    if (oldViewProps.hasOnExitViroCallback != newViewProps.hasOnExitViroCallback) {
        _hasOnExitViroCallback = newViewProps.hasOnExitViroCallback;
        NSLog(@"ViroVRSceneNavigator has exit callback: %@", _hasOnExitViroCallback ? @"YES" : @"NO");
    }
    
    [super updateProps:props oldProps:oldProps];
}

- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter
{
    [super updateEventEmitter:eventEmitter];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
    // Handle VR scene navigator specific commands
    if ([commandName isEqualToString:@"recenterTracking"]) {
        [self recenterVRTracking];
    } else if ([commandName isEqualToString:@"project"]) {
        if (args.count >= 3) {
            SCNVector3 point = SCNVector3Make([args[0] floatValue], [args[1] floatValue], [args[2] floatValue]);
            SCNVector3 projected = [self projectPoint:point];
            NSLog(@"Projected point: (%.2f, %.2f, %.2f)", projected.x, projected.y, projected.z);
        }
    } else if ([commandName isEqualToString:@"unproject"]) {
        if (args.count >= 3) {
            SCNVector3 point = SCNVector3Make([args[0] floatValue], [args[1] floatValue], [args[2] floatValue]);
            SCNVector3 unprojected = [self unprojectPoint:point];
            NSLog(@"Unprojected point: (%.2f, %.2f, %.2f)", unprojected.x, unprojected.y, unprojected.z);
        }
    }
}

#pragma mark - VR Mode Management

- (void)enableVRMode
{
    NSLog(@"Enabling VR mode");
    
    _isVRModeActive = YES;
    
    // TODO: Enable ViroReact VR mode
    // This will need to integrate with the existing ViroReact VR system
    
    [self updateVRSettings];
    [self configureVRRenderer];
}

- (void)disableVRMode
{
    NSLog(@"Disabling VR mode");
    
    _isVRModeActive = NO;
    
    // TODO: Disable ViroReact VR mode
    // This will need to integrate with the existing ViroReact VR system
    
    [self updateVRSettings];
}

- (void)updateVRSettings
{
    if (!_isVRModeActive) {
        return;
    }
    
    NSLog(@"Updating VR settings");
    
    // Configure autofocus
    if (_autofocus) {
        // TODO: Enable VR autofocus
    } else {
        // TODO: Disable VR autofocus
    }
    
    // Update VR scene view settings
    _vrSceneView.allowsCameraControl = !_isVRModeActive; // Disable camera control in VR mode
    _vrSceneView.showsStatistics = _debug;
}

- (void)configureVRRenderer
{
    NSLog(@"Configuring VR renderer - HDR: %@, PBR: %@, Shadows: %@", 
          _hdrEnabled ? @"YES" : @"NO",
          _pbrEnabled ? @"YES" : @"NO", 
          _shadowsEnabled ? @"YES" : @"NO");
    
    // Configure HDR
    if (_hdrEnabled && _isVRModeActive) {
        // TODO: Enable HDR rendering in VR mode
    }
    
    // Configure PBR
    if (_pbrEnabled && _isVRModeActive) {
        // TODO: Enable PBR rendering in VR mode
    }
    
    // Configure shadows
    _vrSceneView.antialiasingMode = _multisamplingEnabled ? SCNAntialiasingModeMultisampling4X : SCNAntialiasingModeNone;
    
    // Configure bloom
    if (_bloomEnabled && _isVRModeActive) {
        // TODO: Enable bloom effect in VR mode
    }
}

#pragma mark - Scene Navigation

- (void)navigateToSceneAtIndex:(NSInteger)index
{
    if (index == _previousSceneIndex) {
        return;
    }
    
    NSLog(@"Navigating to scene at index: %ld", (long)index);
    
    _previousSceneIndex = _currentSceneIndex;
    
    // TODO: Implement VR scene navigation
    // This will need to integrate with the existing ViroReact scene system
    
    [self updateCurrentScene];
}

- (void)updateCurrentScene
{
    NSLog(@"Updating current VR scene");
    
    // TODO: Update VR scene content based on current scene index
    // This will need to integrate with the existing ViroReact scene system
}

#pragma mark - VR Utilities

- (void)recenterVRTracking
{
    NSLog(@"Recentering VR tracking");
    
    // TODO: Implement VR tracking recentering
    // This will need to integrate with the existing ViroReact VR tracking system
    
    // Reset camera position as fallback
    _vrCameraNode.position = SCNVector3Make(0, 0, 0);
    _vrCameraNode.rotation = SCNVector4Make(0, 0, 0, 0);
}

- (SCNVector3)projectPoint:(SCNVector3)point
{
    // TODO: Implement proper VR point projection
    // For now, return the same point
    NSLog(@"Projecting VR point: (%.2f, %.2f, %.2f)", point.x, point.y, point.z);
    return point;
}

- (SCNVector3)unprojectPoint:(SCNVector3)point
{
    // TODO: Implement proper VR point unprojection
    // For now, return the same point
    NSLog(@"Unprojecting VR point: (%.2f, %.2f, %.2f)", point.x, point.y, point.z);
    return point;
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // Update VR scene view frame
    _vrSceneView.frame = self.bounds;
}

#pragma mark - Event Handling

- (void)emitExitViroEvent
{
    if (_hasOnExitViroCallback && _onExitViro) {
        NSLog(@"Emitting VR exit event");
        _onExitViro(@{});
    }
}

#pragma mark - Child View Management

- (void)insertReactSubview:(UIView *)subview atIndex:(NSInteger)atIndex
{
    [super insertReactSubview:subview atIndex:atIndex];
    
    // Add scene views to our tracking array
    if (subview && ![_sceneViews containsObject:subview]) {
        [_sceneViews addObject:subview];
        NSLog(@"Added VR scene view at index: %ld", (long)atIndex);
    }
}

- (void)removeReactSubview:(UIView *)subview
{
    [super removeReactSubview:subview];
    
    // Remove from tracking array
    if ([_sceneViews containsObject:subview]) {
        [_sceneViews removeObject:subview];
        NSLog(@"Removed VR scene view");
    }
}

#pragma mark - Property Setters

- (void)setVrModeEnabled:(BOOL)vrModeEnabled
{
    if (_vrModeEnabled == vrModeEnabled) {
        return;
    }
    
    _vrModeEnabled = vrModeEnabled;
    
    if (vrModeEnabled) {
        [self enableVRMode];
    } else {
        [self disableVRMode];
    }
}

- (void)setCurrentSceneIndex:(NSInteger)currentSceneIndex
{
    if (_currentSceneIndex == currentSceneIndex) {
        return;
    }
    
    _currentSceneIndex = currentSceneIndex;
    [self navigateToSceneAtIndex:currentSceneIndex];
}

- (void)setViroAppProps:(NSDictionary *)viroAppProps
{
    _viroAppProps = viroAppProps;
    NSLog(@"Updated VR app props: %@", viroAppProps);
    
    // TODO: Apply app props to VR system
}

#pragma mark - Lifecycle

- (void)prepareForRecycle
{
    [super prepareForRecycle];
    
    // Disable VR mode
    [self disableVRMode];
    
    // Clear scene views
    [_sceneViews removeAllObjects];
    
    // Reset properties
    _vrModeEnabled = YES;
    _autofocus = YES;
    _debug = NO;
    _currentSceneIndex = 0;
    _previousSceneIndex = -1;
    _hasOnExitViroCallback = NO;
    _isVRModeActive = NO;
}

@end

Class<RCTComponentViewProtocol> ViroVRSceneNavigatorCls(void)
{
    return ViroVRSceneNavigatorComponentView.class;
}