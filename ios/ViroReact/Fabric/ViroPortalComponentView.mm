//
//  ViroPortalComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroPortalComponentView.h"
#import <React/RCTAssert.h>
#import <React/RCTUtils.h>
#import <React/RCTLog.h>
#import <SceneKit/SceneKit.h>

@interface ViroPortalComponentView ()

// SceneKit components
@property (nonatomic, strong) SCNNode *portalNode;
@property (nonatomic, strong) SCNNode *portalFrameNode;
@property (nonatomic, strong) SCNNode *portalContentNode;
@property (nonatomic, strong) SCNPlane *portalPlane;
@property (nonatomic, strong) SCNMaterial *portalMaterial;

// Portal state
@property (nonatomic, assign) BOOL isInPortal;
@property (nonatomic, assign) BOOL isTransitioning;
@property (nonatomic, assign) CGFloat transitionProgress;

// Camera tracking
@property (nonatomic, strong) SCNNode *cameraNode;
@property (nonatomic, assign) SCNVector3 lastCameraPosition;

@end

@implementation ViroPortalComponentView

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
    _portalEnterCompletionAction = @"none";
    _portalExitCompletionAction = @"none";
    _portalScale = 1.0f;
    
    // Initialize state
    _isInPortal = NO;
    _isTransitioning = NO;
    _transitionProgress = 0.0f;
    _lastCameraPosition = SCNVector3Make(0, 0, 0);
    
    // Setup SceneKit components
    [self setupSceneKitComponents];
    
    // Start camera tracking
    [self startCameraTracking];
}

- (void)setupSceneKitComponents
{
    // Create portal node
    _portalNode = [SCNNode node];
    _portalNode.name = @"ViroPortal";
    
    // Create portal frame
    _portalFrameNode = [SCNNode node];
    _portalFrameNode.name = @"PortalFrame";
    
    // Create portal plane (invisible, used for detection)
    _portalPlane = [SCNPlane planeWithWidth:2.0 height:3.0];
    _portalPlane.firstMaterial.colorBufferWriteMask = SCNColorMaskNone;
    _portalPlane.firstMaterial.readsFromDepthBuffer = YES;
    _portalPlane.firstMaterial.writesToDepthBuffer = YES;
    
    SCNNode *planeNode = [SCNNode nodeWithGeometry:_portalPlane];
    planeNode.name = @"PortalPlane";
    [_portalFrameNode addChildNode:planeNode];
    
    // Create portal content container
    _portalContentNode = [SCNNode node];
    _portalContentNode.name = @"PortalContent";
    _portalContentNode.renderingOrder = 100;
    
    // Add nodes to hierarchy
    [_portalNode addChildNode:_portalFrameNode];
    [_portalNode addChildNode:_portalContentNode];
    
    // Setup portal material
    [self setupPortalMaterial];
}

- (void)setupPortalMaterial
{
    _portalMaterial = [SCNMaterial material];
    _portalMaterial.lightingModelName = SCNLightingModelConstant;
    _portalMaterial.colorBufferWriteMask = SCNColorMaskNone;
    _portalMaterial.readsFromDepthBuffer = YES;
    _portalMaterial.writesToDepthBuffer = YES;
    
    // Apply stencil test for portal effect
    _portalMaterial.stencilOperationFrontAndBack = SCNStencilOperationReplace;
    _portalMaterial.stencilOperationDepthFail = SCNStencilOperationKeep;
    _portalMaterial.stencilOperationDepthPass = SCNStencilOperationReplace;
    _portalMaterial.stencilReferenceValue = 1;
    
    _portalPlane.firstMaterial = _portalMaterial;
}

#pragma mark - Property Setters

- (void)setPassable:(NSString *)passable
{
    _passable = passable;
    [self updatePortalState];
}

- (void)setPortalEnterCompletionAction:(NSString *)portalEnterCompletionAction
{
    _portalEnterCompletionAction = portalEnterCompletionAction;
}

- (void)setPortalExitCompletionAction:(NSString *)portalExitCompletionAction
{
    _portalExitCompletionAction = portalExitCompletionAction;
}

- (void)setPortalScale:(CGFloat)portalScale
{
    _portalScale = portalScale;
    _portalNode.scale = SCNVector3Make(portalScale, portalScale, portalScale);
}

#pragma mark - Portal Management

- (void)updatePortalState
{
    BOOL isPassable = [_passable isEqualToString:@"true"];
    
    if (isPassable) {
        // Enable portal physics
        _portalNode.physicsBody = nil;
    } else {
        // Add collision physics to prevent passing
        _portalNode.physicsBody = [SCNPhysicsBody staticBody];
        _portalNode.physicsBody.categoryBitMask = 1;
        _portalNode.physicsBody.collisionBitMask = SCNPhysicsCollisionCategoryAll;
    }
}

- (void)startCameraTracking
{
    // In a real implementation, this would track the camera position
    // relative to the portal to detect enter/exit events
    dispatch_async(dispatch_get_main_queue(), ^{
        [NSTimer scheduledTimerWithTimeInterval:0.016 repeats:YES block:^(NSTimer * _Nonnull timer) {
            [self checkPortalTransition];
        }];
    });
}

- (void)checkPortalTransition
{
    if (!_cameraNode || _isTransitioning) {
        return;
    }
    
    SCNVector3 cameraPosition = _cameraNode.position;
    SCNVector3 portalPosition = _portalNode.position;
    
    // Calculate if camera has crossed the portal plane
    float lastZ = _lastCameraPosition.z - portalPosition.z;
    float currentZ = cameraPosition.z - portalPosition.z;
    
    BOOL crossedPortal = (lastZ * currentZ < 0);
    
    if (crossedPortal && [_passable isEqualToString:@"true"]) {
        if (currentZ < 0 && !_isInPortal) {
            // Entered portal
            [self enterPortal];
        } else if (currentZ > 0 && _isInPortal) {
            // Exited portal
            [self exitPortal];
        }
    }
    
    _lastCameraPosition = cameraPosition;
}

- (void)enterPortal
{
    if (_isInPortal || _isTransitioning) {
        return;
    }
    
    _isTransitioning = YES;
    
    // Notify enter event
    if (_onPortalEnter) {
        _onPortalEnter(@{
            @"position": @[@(_portalNode.position.x), @(_portalNode.position.y), @(_portalNode.position.z)]
        });
    }
    
    // Perform enter animation/action
    [self performPortalAction:_portalEnterCompletionAction completion:^{
        self->_isInPortal = YES;
        self->_isTransitioning = NO;
    }];
}

- (void)exitPortal
{
    if (!_isInPortal || _isTransitioning) {
        return;
    }
    
    _isTransitioning = YES;
    
    // Notify exit event
    if (_onPortalExit) {
        _onPortalExit(@{
            @"position": @[@(_portalNode.position.x), @(_portalNode.position.y), @(_portalNode.position.z)]
        });
    }
    
    // Perform exit animation/action
    [self performPortalAction:_portalExitCompletionAction completion:^{
        self->_isInPortal = NO;
        self->_isTransitioning = NO;
    }];
}

- (void)performPortalAction:(NSString *)action completion:(void (^)(void))completion
{
    if ([action isEqualToString:@"placePortalOnExitAnimation"]) {
        // Animate portal placement
        [SCNTransaction begin];
        [SCNTransaction setAnimationDuration:0.5];
        [SCNTransaction setCompletionBlock:completion];
        
        _portalNode.opacity = _isInPortal ? 1.0 : 0.0;
        
        [SCNTransaction commit];
    } else if ([action isEqualToString:@"disable"]) {
        // Disable portal
        _portalNode.hidden = YES;
        if (completion) completion();
    } else {
        // No action
        if (completion) completion();
    }
}

#pragma mark - Touch Handling

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
    [super touchesBegan:touches withEvent:event];
    
    if (_onClick) {
        UITouch *touch = touches.anyObject;
        CGPoint location = [touch locationInView:self];
        
        _onClick(@{
            @"position": @[@(location.x), @(location.y)],
            @"source": @"touch"
        });
    }
}

#pragma mark - Public Methods

- (SCNNode *)getPortalNode
{
    return _portalNode;
}

- (SCNNode *)getPortalContentNode
{
    return _portalContentNode;
}

- (BOOL)isInPortal
{
    return _isInPortal;
}

- (void)setCameraNode:(SCNNode *)cameraNode
{
    _cameraNode = cameraNode;
}

- (void)addContentToPortal:(SCNNode *)contentNode
{
    [_portalContentNode addChildNode:contentNode];
}

@end