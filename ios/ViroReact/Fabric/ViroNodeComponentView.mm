//
//  ViroNodeComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroNodeComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTNode.h"

@interface ViroNodeComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;
@property (nonatomic, strong) std::shared_ptr<VROEventDelegateiOS> eventDelegate;
@property (nonatomic, strong) std::shared_ptr<VROTransformDelegateiOS> transformDelegate;

// Transform properties
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *position;
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *scale;
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *rotation;
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *rotationPivot;
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *scalePivot;
@property (nonatomic, strong, nullable) NSArray<NSString *> *transformBehaviors;

// Visibility and interaction
@property (nonatomic, assign) BOOL visible;
@property (nonatomic, assign) CGFloat opacity;
@property (nonatomic, assign) NSInteger renderingOrder;
@property (nonatomic, assign) BOOL ignoreEventHandling;
@property (nonatomic, strong, nullable) NSString *dragType;

// Physics and animation
@property (nonatomic, strong, nullable) NSDictionary *physicsBody;
@property (nonatomic, assign) BOOL highAccuracyEvents;
@property (nonatomic, strong, nullable) NSDictionary *animation;

// Event blocks
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onTransformUpdate;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onClick;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onHover;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onDrag;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onFuse;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onTouch;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onScroll;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onSwipe;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onCollision;

@end

@implementation ViroNodeComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroNodeComponentDescriptor>();
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
    RCTLogInfo(@"[ViroNodeComponentView] Initializing");
    
    // Set default values
    _visible = YES;
    _opacity = 1.0;
    _renderingOrder = 0;
    _ignoreEventHandling = NO;
    _highAccuracyEvents = NO;
    
    // Default transform values
    _position = @[@0, @0, @0];
    _scale = @[@1, @1, @1];
    _rotation = @[@0, @0, @0];
    
    // Initialize ViroReact node
    [self initializeVRONode];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D content to extend beyond bounds
}

- (void)initializeVRONode
{
    RCTLogInfo(@"[ViroNodeComponentView] Creating VRONode");
    
    // Create VRONode - the core 3D node object
    _vroNode = std::make_shared<VRONode>();
    
    // Set default properties
    _vroNode->setOpacity(_opacity);
    _vroNode->setVisible(_visible);
    _vroNode->setRenderingOrder(_renderingOrder);
    
    // Apply default transform
    [self updateVRONodeTransform];
    
    // Create event delegate for handling user interactions
    _eventDelegate = std::make_shared<VROEventDelegateiOS>((__bridge void *)self);
    _vroNode->setEventDelegate(_eventDelegate);
    
    // Create transform delegate for transform updates
    _transformDelegate = std::make_shared<VROTransformDelegateiOS>((__bridge void *)self);
    _vroNode->setTransformDelegate(_transformDelegate);
    
    RCTLogInfo(@"[ViroNodeComponentView] VRONode created successfully");
}

- (void)updateVRONodeTransform
{
    if (!_vroNode) {
        return;
    }
    
    // Apply position
    if (_position && _position.count >= 3) {
        VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
        _vroNode->setPosition(pos);
    }
    
    // Apply scale
    if (_scale && _scale.count >= 3) {
        VROVector3f scl([_scale[0] floatValue], [_scale[1] floatValue], [_scale[2] floatValue]);
        _vroNode->setScale(scl);
    }
    
    // Apply rotation (Euler angles in radians)
    if (_rotation && _rotation.count >= 3) {
        VROVector3f rot([_rotation[0] floatValue], [_rotation[1] floatValue], [_rotation[2] floatValue]);
        _vroNode->setRotation(rot);
    }
}

#pragma mark - Transform Methods

- (void)setPosition:(nullable NSArray<NSNumber *> *)position
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting position: %@", position);
    _position = position ?: @[@0, @0, @0];
    
    // Apply position transform to ViroReact node
    if (_vroNode && _position.count >= 3) {
        VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
        _vroNode->setPosition(pos);
    }
}

- (void)setScale:(nullable NSArray<NSNumber *> *)scale
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting scale: %@", scale);
    _scale = scale ?: @[@1, @1, @1];
    
    // Apply scale transform to ViroReact node
    if (_vroNode && _scale.count >= 3) {
        VROVector3f scl([_scale[0] floatValue], [_scale[1] floatValue], [_scale[2] floatValue]);
        _vroNode->setScale(scl);
    }
}

- (void)setRotation:(nullable NSArray<NSNumber *> *)rotation
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting rotation: %@", rotation);
    _rotation = rotation ?: @[@0, @0, @0];
    
    // Apply rotation transform to ViroReact node
    if (_vroNode && _rotation.count >= 3) {
        VROVector3f rot([_rotation[0] floatValue], [_rotation[1] floatValue], [_rotation[2] floatValue]);
        _vroNode->setRotation(rot);
    }
}

- (void)setRotationPivot:(nullable NSArray<NSNumber *> *)rotationPivot
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting rotation pivot: %@", rotationPivot);
    _rotationPivot = rotationPivot;
    
    // TODO: Apply rotation pivot to ViroReact node
}

- (void)setScalePivot:(nullable NSArray<NSNumber *> *)scalePivot
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting scale pivot: %@", scalePivot);
    _scalePivot = scalePivot;
    
    // TODO: Apply scale pivot to ViroReact node
}

- (void)setTransformBehaviors:(nullable NSArray<NSString *> *)transformBehaviors
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting transform behaviors: %@", transformBehaviors);
    _transformBehaviors = transformBehaviors;
    
    // TODO: Apply transform behaviors to ViroReact node
    // This affects how transforms are applied (billboard, constrain to plane, etc.)
}

#pragma mark - Visibility and Interaction

- (void)setVisible:(BOOL)visible
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting visible: %@", visible ? @"YES" : @"NO");
    _visible = visible;
    
    // Apply visibility to ViroReact node
    if (_vroNode) {
        _vroNode->setVisible(visible);
    }
    self.hidden = !visible;
}

- (void)setOpacity:(CGFloat)opacity
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting opacity: %f", opacity);
    _opacity = opacity;
    
    // Apply opacity to ViroReact node
    if (_vroNode) {
        _vroNode->setOpacity(opacity);
    }
    self.alpha = opacity;
}

- (void)setRenderingOrder:(NSInteger)renderingOrder
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting rendering order: %ld", (long)renderingOrder);
    _renderingOrder = renderingOrder;
    
    // Apply rendering order to ViroReact node
    if (_vroNode) {
        _vroNode->setRenderingOrder((int)renderingOrder);
    }
}

- (void)setIgnoreEventHandling:(BOOL)ignoreEventHandling
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting ignore event handling: %@", ignoreEventHandling ? @"YES" : @"NO");
    _ignoreEventHandling = ignoreEventHandling;
    
    // TODO: Apply event handling setting to ViroReact node
    self.userInteractionEnabled = !ignoreEventHandling;
}

- (void)setDragType:(nullable NSString *)dragType
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting drag type: %@", dragType);
    _dragType = dragType;
    
    // TODO: Apply drag type to ViroReact node
    // Types: "FixedDistance", "FixedToWorld", "FixedDistanceOrigin", "FixedToPlane"
}

#pragma mark - Physics

- (void)setPhysicsBody:(nullable NSDictionary *)physicsBody
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting physics body: %@", physicsBody);
    _physicsBody = physicsBody;
    
    // TODO: Apply physics body to ViroReact node
    // This affects collision detection, dynamics, etc.
}

- (void)setHighAccuracyEvents:(BOOL)highAccuracyEvents
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting high accuracy events: %@", highAccuracyEvents ? @"YES" : @"NO");
    _highAccuracyEvents = highAccuracyEvents;
    
    // TODO: Apply high accuracy events setting to ViroReact node
}

#pragma mark - Animation

- (void)setAnimation:(nullable NSDictionary *)animation
{
    RCTLogInfo(@"[ViroNodeComponentView] Setting animation: %@", animation);
    _animation = animation;
    
    // TODO: Apply animation to ViroReact node
}

#pragma mark - Event Callbacks

- (void)setOnTransformUpdate:(nullable RCTBubblingEventBlock)onTransformUpdate
{
    _onTransformUpdate = onTransformUpdate;
    // TODO: Register for transform update events from ViroReact node
}

- (void)setOnClick:(nullable RCTBubblingEventBlock)onClick
{
    _onClick = onClick;
    // TODO: Register for click events from ViroReact node
}

- (void)setOnHover:(nullable RCTBubblingEventBlock)onHover
{
    _onHover = onHover;
    // TODO: Register for hover events from ViroReact node
}

- (void)setOnDrag:(nullable RCTBubblingEventBlock)onDrag
{
    _onDrag = onDrag;
    // TODO: Register for drag events from ViroReact node
}

- (void)setOnFuse:(nullable RCTBubblingEventBlock)onFuse
{
    _onFuse = onFuse;
    // TODO: Register for fuse events from ViroReact node
}

- (void)setOnTouch:(nullable RCTBubblingEventBlock)onTouch
{
    _onTouch = onTouch;
    // TODO: Register for touch events from ViroReact node
}

- (void)setOnScroll:(nullable RCTBubblingEventBlock)onScroll
{
    _onScroll = onScroll;
    // TODO: Register for scroll events from ViroReact node
}

- (void)setOnSwipe:(nullable RCTBubblingEventBlock)onSwipe
{
    _onSwipe = onSwipe;
    // TODO: Register for swipe events from ViroReact node
}

- (void)setOnCollision:(nullable RCTBubblingEventBlock)onCollision
{
    _onCollision = onCollision;
    // TODO: Register for collision events from ViroReact node
}

#pragma mark - Event Emission

- (void)emitClickEvent:(NSDictionary *)clickInfo
{
    if (_onClick) {
        _onClick(clickInfo);
    }
}

- (void)emitHoverEvent:(NSDictionary *)hoverInfo
{
    if (_onHover) {
        _onHover(hoverInfo);
    }
}

- (void)emitDragEvent:(NSDictionary *)dragInfo
{
    if (_onDrag) {
        _onDrag(dragInfo);
    }
}

- (void)emitTransformUpdateEvent:(NSDictionary *)transformInfo
{
    if (_onTransformUpdate) {
        _onTransformUpdate(transformInfo);
    }
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact node
    RCTLogInfo(@"[ViroNodeComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // For 3D nodes, layout is handled by 3D transforms, not 2D layout
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroNodeComponentView] Node added to window");
        // TODO: Add node to ViroReact scene when added to window
    } else {
        RCTLogInfo(@"[ViroNodeComponentView] Node removed from window");
        // TODO: Remove node from ViroReact scene when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroNodeComponentView] Deallocating");
    // TODO: Clean up ViroReact node resources
}

@end

Class<RCTComponentViewProtocol> ViroNodeCls(void)
{
    return ViroNodeComponentView.class;
}