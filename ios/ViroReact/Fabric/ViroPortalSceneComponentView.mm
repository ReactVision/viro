//
//  ViroPortalSceneComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroPortalSceneComponentView.h"
#import <React/RCTAssert.h>
#import <React/RCTUtils.h>
#import <React/RCTLog.h>
#import <SceneKit/SceneKit.h>

@interface ViroPortalSceneComponentView ()

// SceneKit components
@property (nonatomic, strong) SCNNode *portalSceneNode;
@property (nonatomic, strong) SCNNode *portalContentNode;
@property (nonatomic, strong) NSMutableArray<SCNNode *> *contentNodes;

// Portal state
@property (nonatomic, assign) BOOL isActive;

@end

@implementation ViroPortalSceneComponentView

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        [self commonInit];
    }
    return self;
}

- (void)commonInit
{
    // Initialize default values
    _passable = @"true";
    _position = @[@0, @0, @0];
    _rotation = @[@0, @0, @0];
    _scale = @[@1, @1, @1];
    
    // Initialize collections
    _contentNodes = [NSMutableArray array];
    
    // Initialize state
    _isActive = YES;
    
    // Setup SceneKit components
    [self setupSceneKitComponents];
}

- (void)setupSceneKitComponents
{
    // Create portal scene node
    _portalSceneNode = [SCNNode node];
    _portalSceneNode.name = @"ViroPortalScene";
    
    // Create content container
    _portalContentNode = [SCNNode node];
    _portalContentNode.name = @"PortalSceneContent";
    
    // Add content node to scene
    [_portalSceneNode addChildNode:_portalContentNode];
    
    // Apply transforms
    [self updateTransforms];
    
    // Setup stencil rendering for portal effect
    [self setupPortalRendering];
}

- (void)setupPortalRendering
{
    // Configure rendering order for portal effect
    _portalContentNode.renderingOrder = 100;
    
    // Apply stencil test to content
    [self applyStencilToNode:_portalContentNode stencilValue:1];
}

- (void)applyStencilToNode:(SCNNode *)node stencilValue:(uint8_t)stencilValue
{
    // Apply stencil test to node's geometry
    if (node.geometry) {
        for (SCNMaterial *material in node.geometry.materials) {
            material.stencilOperationFrontAndBack = SCNStencilOperationKeep;
            material.stencilOperationDepthFail = SCNStencilOperationKeep;
            material.stencilOperationDepthPass = SCNStencilOperationKeep;
            material.stencilReferenceValue = stencilValue;
        }
    }
    
    // Recursively apply to children
    for (SCNNode *child in node.childNodes) {
        [self applyStencilToNode:child stencilValue:stencilValue];
    }
}

#pragma mark - Property Setters

- (void)setPassable:(NSString *)passable
{
    _passable = passable;
    [self updatePortalSceneState];
}

- (void)setPosition:(NSArray<NSNumber *> *)position
{
    _position = position;
    [self updateTransforms];
}

- (void)setRotation:(NSArray<NSNumber *> *)rotation
{
    _rotation = rotation;
    [self updateTransforms];
}

- (void)setScale:(NSArray<NSNumber *> *)scale
{
    _scale = scale;
    [self updateTransforms];
}

#pragma mark - Transform Updates

- (void)updateTransforms
{
    // Update position
    if (_position.count >= 3) {
        _portalSceneNode.position = SCNVector3Make(
            [_position[0] floatValue],
            [_position[1] floatValue],
            [_position[2] floatValue]
        );
    }
    
    // Update rotation
    if (_rotation.count >= 3) {
        _portalSceneNode.eulerAngles = SCNVector3Make(
            [_rotation[0] floatValue] * M_PI / 180.0,
            [_rotation[1] floatValue] * M_PI / 180.0,
            [_rotation[2] floatValue] * M_PI / 180.0
        );
    }
    
    // Update scale
    if (_scale.count >= 3) {
        _portalSceneNode.scale = SCNVector3Make(
            [_scale[0] floatValue],
            [_scale[1] floatValue],
            [_scale[2] floatValue]
        );
    }
}

#pragma mark - Portal Scene Management

- (void)updatePortalSceneState
{
    // Update portal scene based on passable state
    BOOL isPassable = [_passable isEqualToString:@"true"];
    
    if (!isPassable) {
        // Add physics body to prevent passing
        _portalSceneNode.physicsBody = [SCNPhysicsBody staticBody];
    } else {
        // Remove physics body
        _portalSceneNode.physicsBody = nil;
    }
}

- (void)addPortalContent:(SCNNode *)content
{
    if (!content) return;
    
    [_contentNodes addObject:content];
    [_portalContentNode addChildNode:content];
    
    // Apply stencil test to new content
    [self applyStencilToNode:content stencilValue:1];
}

- (void)removePortalContent:(SCNNode *)content
{
    if (!content) return;
    
    [_contentNodes removeObject:content];
    [content removeFromParentNode];
}

#pragma mark - Event Handling

- (void)handlePortalEnter
{
    if (_onPortalEnter) {
        _onPortalEnter(@{
            @"position": _position
        });
    }
}

- (void)handlePortalExit
{
    if (_onPortalExit) {
        _onPortalExit(@{
            @"position": _position
        });
    }
}

#pragma mark - Public Methods

- (SCNNode *)getPortalSceneNode
{
    return _portalSceneNode;
}

- (SCNNode *)getPortalContentNode
{
    return _portalContentNode;
}

- (NSArray<SCNNode *> *)getContentNodes
{
    return [_contentNodes copy];
}

- (BOOL)isActive
{
    return _isActive;
}

- (void)setActive:(BOOL)active
{
    _isActive = active;
    _portalSceneNode.hidden = !active;
}

@end