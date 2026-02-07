//
//  VRTNode.m
//  React
//
//  Created by Raj Advani on 8/24/16.
//  Copyright © 2016 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

#import <React/RCTConvert.h>
#import "VRTNode.h"
#import "VRTScene.h"
#import "VRTLight.h"
#import "VRTImage.h"
#import "VRTHUD.h"
#import "VRTNode.h"
#import "VRTFlexView.h"
#import "VRTText.h"
#import "VRTUtils.h"
#import "VRTCamera.h"
#import "VRTPortal.h"
#import "VRT360Image.h"
#import "VRT3DObject.h"
#import "VRTAnimatedComponent.h"
#import "VRTMaterialManager.h"
#import "VRTManagedAnimation.h"
#import "VRTAnimationManager.h"
#import "VRTQuad.h"
#import "VRTVideoSurface.h"

const int k2DPointsPerSpatialUnit = 1000;
const double kTransformDelegateDistanceFilter = 0.01;

#pragma mark - Node Animation Class

@implementation VRTNodeAnimation

- (std::shared_ptr<VROExecutableAnimation>)loadAnimation {
    if (self.animationName != nil) {
        // Lazily fetch animation manager from bridge if not set
        if (self.animationManager == nil && self.bridge != nil) {
            // Use moduleForClass with NSClassFromString - works better with RCTBridgeProxy in new architecture
            Class animManagerClass = NSClassFromString(@"VRTAnimationManager");
            if (animManagerClass) {
                self.animationManager = [self.bridge moduleForClass:animManagerClass];
            }
            // Animation manager loaded lazily from bridge
        }

        if (self.animationManager == nil) {
            return nullptr;
        }
        std::shared_ptr<VROExecutableAnimation> animation = [self.animationManager animationForName:self.animationName];
        if (animation) {
            return animation->copy();
        }
        return nullptr;
    }
    else {
        return nullptr;
    }
}

- (void)setAnimationName:(NSString *)animationName {
    _animationName = [animationName copy];
}

@end

#pragma mark - Node Class

@interface VRTNode () {
    // Store original embedded materials from GLB before any shader overrides
    // This allows us to always start from the true baseline when switching shaders
    std::vector<std::shared_ptr<VROMaterial>> _originalEmbeddedMaterials;
    // Store original materials for child nodes (to preserve skinning modifiers, etc.)
    // Maps node pointer to its original materials vector
    std::unordered_map<VRONode*, std::vector<std::shared_ptr<VROMaterial>>> _childNodeOriginalMaterials;
}
// Track shader override materials and their clones for uniform updates
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableArray *> *shaderOverrideMap;
// Track regular materials with shader modifiers for uniform propagation
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableArray *> *shaderMaterialsMap;
@end

// Static registry to track all nodes with shader overrides (weak references)
static NSHashTable *shaderOverrideNodesRegistry = nil;
// Static registry to track all nodes with shader materials (weak references)
static NSHashTable *shaderMaterialsNodesRegistry = nil;

@implementation VRTNode

+ (void)initialize {
    if (self == [VRTNode class]) {
        // NSHashTable with weak references
        shaderOverrideNodesRegistry = [NSHashTable weakObjectsHashTable];
        shaderMaterialsNodesRegistry = [NSHashTable weakObjectsHashTable];
    }
}

+ (void)updateShaderOverridesForMaterial:(NSString *)materialName {
    // Iterate through all registered nodes and update those using this material
    for (VRTNode *node in shaderOverrideNodesRegistry) {
        if (node.shaderOverrideMap[materialName]) {
            [node updateShaderOverrideUniformsForMaterial:materialName];
        }
    }

    // Also update nodes using this material via the materials prop
    for (VRTNode *node in shaderMaterialsNodesRegistry) {
        if (node.shaderMaterialsMap[materialName]) {
            [node updateShaderMaterialUniformsForMaterial:materialName];
        }
    }
}

- (instancetype)initWithBridge:(RCTBridge *)bridge  {
    self = [super initWithBridge:bridge];
    if(self) {
        _node = [self createVroNode];
        _node->setPosition({0, 0, 0});
        _node->setScale({1, 1, 1});
        _renderingOrder = 0;
        _visible = YES; // default to visible.
        _opacity = 1.0; //default opacity to 1.0
        _highAccuracyEvents = NO;
        _shaderOverrideMap = [[NSMutableDictionary alloc] init];
        _shaderMaterialsMap = [[NSMutableDictionary alloc] init];
        _lightReceivingBitMask = 1;
        _shadowCastingBitMask = 1;
        _shouldIgnoreEventHandling = NO; // default is NO
        _ignoreEventHandling = NO; // default is NO
        
        _nodeAnimation = [[VRTNodeAnimation alloc] init];
        _nodeAnimation.bridge = bridge;  // Store bridge for lazy animation manager lookup
        // Use moduleForClass with NSClassFromString - works better with RCTBridgeProxy in new architecture
        Class animManagerClass = NSClassFromString(@"VRTAnimationManager");
        if (animManagerClass) {
            _nodeAnimation.animationManager = [bridge moduleForClass:animManagerClass];
        }
        // If animMgr is nil, loadAnimation will try to fetch it lazily from bridge
        _nodeAnimation.node = _node;
        
        // Create and attach event delegate
        _eventDelegate = std::make_shared<VROEventDelegateiOS>(self);
        _node->setEventDelegate(_eventDelegate);
        _physicsEnabled = true;
    }
    
    return self;
}

- (std::shared_ptr<VRONode>)createVroNode {
    return std::make_shared<VRONode>();
}

- (void)insertReactSubview:(UIView *)view atIndex:(NSInteger)atIndex {
    VRTView *child = (VRTView *)view;
    
    if ([child isKindOfClass:[VRTLight class]]) {
        VRTLight *light = (VRTLight *)child;
        self.node->addLight([light light]);
    } else if ([child isKindOfClass:[VRTCamera class]]) {
        VRTCamera *cameraView = (VRTCamera *)child;
        if (cameraView.nodeRootTransformCamera) {
            self.node->addChildNode(cameraView.nodeRootTransformCamera);
        }
    } else if ([child isKindOfClass:[VRTPortal class]]) {
        // Ignore, this is only handled by VRTPortal
    } else if ([child isKindOfClass:[VRTNode class]]) {
        VRTNode *nodeView = (VRTNode *)child;
        if (nodeView.node) {
            self.node->addChildNode(nodeView.node);
        }
    } else if ([child isKindOfClass:[VRTAnimatedComponent class]]) {
        /*
         Add all children (the targets of the animation) to the node.
         */
        NSArray *subsubViews = [child reactSubviews];
        BOOL childFound = false;
        
        for(VRTView *subsubview in subsubViews){
            if (![subsubview isKindOfClass:[VRTNode class]]) {
                continue;
            }
            
            VRTNode *subsubNodeView = (VRTNode *)subsubview;
            
            std::vector<std::shared_ptr<VRONode>> subnodeArray = self.node->getChildNodes();
            for(std::shared_ptr<VRONode> node: subnodeArray){
                if(node.get() == subsubNodeView.node.get()){
                    childFound = true;
                    break;
                }
            }
            
            if(!childFound && subsubNodeView.node){
                self.node->addChildNode(subsubNodeView.node);
            }
        }
    }
    
    [super insertReactSubview:view atIndex:atIndex];
}

- (void)removeReactSubview:(UIView *)subview {
    VRTView *vroView = (VRTView *)subview;
    
    if ([vroView isKindOfClass:[VRTLight class]]) {
        VRTLight *light = (VRTLight *)vroView;
        self.node->removeLight([light light]);
    }
    else if ([vroView isKindOfClass:[VRTCamera class]]) {
        VRTCamera *cameraView = (VRTCamera *)vroView;
        cameraView.nodeRootTransformCamera->removeFromParentNode();
    }
    else if ([vroView isKindOfClass:[VRTPortal class]]) {
        // Ignore, this is only handled by VRTPortal
    }
    else if([vroView isKindOfClass:[VRT360Image class]]) {
        VRTNode *nodeView = (VRTNode *)vroView;
        if (nodeView.node && nodeView.node->getParentPortal()) {
            nodeView.node->getParentPortal()->removeBackground();
        }
        if (nodeView.node) {
            nodeView.node->removeFromParentNode();
        }
    }
    else if ([vroView isKindOfClass:[VRTNode class]]) {
        VRTNode *nodeView = (VRTNode *)vroView;
        [nodeView clearPhysicsBody];
        if (nodeView.node) {
            nodeView.node->removeFromParentNode();
        }
    }
    
    else if ([vroView isKindOfClass:[VRTAnimatedComponent class]]) {
        /*
         Remove the child (the target of the animation) from the node.
         */
        for(VRTView *subsubview in [vroView reactSubviews]) {
            if (![subsubview isKindOfClass:[VRTNode class]]) {
                continue;
            }
            
            VRTNode *subsubNodeView = (VRTNode *)subsubview;
            if (subsubNodeView.node) {
                subsubNodeView.node->removeFromParentNode();
            }
        }
    }
    
    [super removeReactSubview:subview];
}

// Override parent shouldAppear function.
- (BOOL)shouldAppear {
    return self.parentHasAppeared && self.visible;
}

/*
 Careful to *NEVER* call parentDidAppear or parentDidDisappear within this
 function because only the parent view should ever call it.
 */
- (void)handleAppearanceChange {
    std::shared_ptr<VROPhysicsBody> body = self.node->getPhysicsBody();
    if (body) {
        body->setIsSimulated([self shouldAppear] && self.physicsEnabled);
    }
    [self node]->setHidden(![self shouldAppear]);
    [super handleAppearanceChange];
}

- (void)setRenderingOrder:(int)renderingOrder {
    if (!self.node) {
        return;
    }
    
    @try {
        _renderingOrder = renderingOrder;
        [self node]->setRenderingOrder(renderingOrder);
    } @catch (NSException *exception) {
        NSLog(@"Error updating renderingOrder property: %@", exception.reason);
    }
}

- (void)setVisible:(BOOL)visible {
    if (!self.node) {
        return;
    }
    
    @try {
        _visible = visible;
        [self handleAppearanceChange];
    } @catch (NSException *exception) {
        NSLog(@"Error updating visible property: %@", exception.reason);
    }
}

- (void)setViroTag:(NSString *)tag {
    if (!self.node) {
        return;
    }
    
    @try {
        std::string nodeTag;
        if (tag) {
            nodeTag = std::string([tag UTF8String]);
        }
        [self node]->setTag(nodeTag);
    } @catch (NSException *exception) {
        NSLog(@"Error updating viroTag property: %@", exception.reason);
    }
}

- (void)setContext:(VRORenderContext *)context {
    [super setContext:context];
    [self updateVideoTextures];
}

- (void)setDriver:(std::shared_ptr<VRODriver>)driver {
    [super setDriver:driver];
    [self updateVideoTextures];
}

- (void)updateVideoTextures {
    if(self.driver != nil && self.context != nil) {
        VRTMaterialManager *materialManager = [self.bridge moduleForClass:[VRTMaterialManager class]];
        std::vector<std::shared_ptr<VROMaterial>>::iterator it;
        if(self.node->getGeometry() == NULL) {
            return;
        }
        std::vector<std::shared_ptr<VROMaterial>> materialsVec = self.node->getGeometry()->getMaterials();

        for(it = materialsVec.begin(); it != materialsVec.end(); it++) {
            std::string name = it->get()->getName();
            NSString *materialNameNSString = [NSString stringWithCString:name.c_str()
                                                                encoding:NSASCIIStringEncoding];
            BOOL isVideoMaterial = [materialManager isVideoMaterial:materialNameNSString];
            if(isVideoMaterial) {
                [materialManager loadVideoTextureForMaterial:materialNameNSString driver:self.driver context:self.context];
            }
        }
    }
}

#pragma mark - Transforms

- (void)setPosition:(NSArray<NSNumber *> *)position {
    if (!self.node) {
        return;
    }
    
    @try {
        _position = [position copy];
        float positionValues[3];
        populateFloatArrayFromNSArray(position, positionValues, 3);
        [self node]->setPosition({positionValues[0], positionValues[1], positionValues[2]});
    } @catch (NSException *exception) {
        NSLog(@"Error updating position property: %@", exception.reason);
    }
}

-(void)setHasTransformDelegate:(BOOL)hasDelegate {
    if (hasDelegate){
        _transformDelegate = std::make_shared<VROTransformDelegateiOS>(self, kTransformDelegateDistanceFilter);
        [self node]->setTransformDelegate(_transformDelegate);
    } else {
        _transformDelegate = nullptr;
    }
}

- (void)onPositionUpdate:(VROVector3f)position{
    NSArray *array = [[NSArray alloc] initWithObjects:
                      [NSNumber numberWithFloat:position.x],
                      [NSNumber numberWithFloat:position.y],
                      [NSNumber numberWithFloat:position.z],
                      nil];
    
    if (self.onNativeTransformDelegateViro){
        self.onNativeTransformDelegateViro(@{@"position":array});
    }
}

- (void)setOpacity:(float)opacity {
    if (!self.node) {
        return;
    }
    
    @try {
        _opacity = opacity;
        [self node]->setOpacity(_opacity);
    } @catch (NSException *exception) {
        NSLog(@"Error updating opacity property: %@", exception.reason);
    }
}

- (void)setRotation:(NSArray<NSNumber *> *)rotation {
    if (!self.node) {
        return;
    }
    
    @try {
        _rotation = [rotation copy];
        float rotationValues[3];
        populateFloatArrayFromNSArray(rotation, rotationValues, 3);
        [self node]->setRotation({toRadians(rotationValues[0]), toRadians(rotationValues[1]), toRadians(rotationValues[2])});
    } @catch (NSException *exception) {
        NSLog(@"Error updating rotation property: %@", exception.reason);
    }
}

- (void)setScale:(NSArray<NSNumber *> *)scale {
    if (!self.node) {
        return;
    }
    
    @try {
        _scale = [scale copy];
        float scaleValues[3];
        populateFloatArrayFromNSArray(scale, scaleValues, 3);
        [self node]->setScale({scaleValues[0], scaleValues[1], scaleValues[2]});
    } @catch (NSException *exception) {
        NSLog(@"Error updating scale property: %@", exception.reason);
    }
}

- (void)setRotationPivot:(NSArray<NSNumber *> *)pivot {
    if (!self.node) {
        return;
    }
    
    @try {
        _rotationPivot = [pivot copy];
        float pivotValues[3];
        populateFloatArrayFromNSArray(pivot, pivotValues, 3);
        
        VROMatrix4f pivotMatrix;
        pivotMatrix.translate(pivotValues[0], pivotValues[1], pivotValues[2]);
        [self node]->setRotationPivot(pivotMatrix);
    } @catch (NSException *exception) {
        NSLog(@"Error updating rotationPivot property: %@", exception.reason);
    }
}

- (void)setScalePivot:(NSArray<NSNumber *> *)pivot {
    if (!self.node) {
        return;
    }
    
    @try {
        _scalePivot = [pivot copy];
        float pivotValues[3];
        populateFloatArrayFromNSArray(pivot, pivotValues, 3);
        
        VROMatrix4f pivotMatrix;
        pivotMatrix.translate(pivotValues[0], pivotValues[1], pivotValues[2]);
        [self node]->setScalePivot(pivotMatrix);
    } @catch (NSException *exception) {
        NSLog(@"Error updating scalePivot property: %@", exception.reason);
    }
}

- (void)setTransformBehaviors:(NSArray<NSString *> *)behaviors {
    if (!self.node) {
        return;
    }
    
    @try {
        [self node]->removeAllConstraints();
        for (NSString *behavior in behaviors) {
            if ([behavior caseInsensitiveCompare:@"billboard"] == NSOrderedSame) {
                [self node]->addConstraint(std::make_shared<VROBillboardConstraint>(VROBillboardAxis::All));
            }
            if ([behavior caseInsensitiveCompare:@"billboardX"] == NSOrderedSame) {
                [self node]->addConstraint(std::make_shared<VROBillboardConstraint>(VROBillboardAxis::X));
            }
            if ([behavior caseInsensitiveCompare:@"billboardY"] == NSOrderedSame) {
                [self node]->addConstraint(std::make_shared<VROBillboardConstraint>(VROBillboardAxis::Y));
            }
        }
    } @catch (NSException *exception) {
        NSLog(@"Error updating transformBehaviors property: %@", exception.reason);
    }
}

#pragma mark - Materials
- (void)setMaterials:(NSArray<NSString *> *)materials {
    _materials = materials;
    [self applyMaterials];
}

- (void)setMaterialUniforms:(NSDictionary *)uniforms {
    _materialUniforms = uniforms;
    std::shared_ptr<VROGeometry> geometry = [self node]->getGeometry();
    if (!geometry || geometry->getMaterials().empty()) {
        return;
    }

    // For now apply to the first material. Ideally we'd have a way to specify which material.
    std::shared_ptr<VROMaterial> material = geometry->getMaterials()[0];

    for (NSString *name in uniforms) {
        id value = uniforms[name];
        if ([value isKindOfClass:[NSNumber class]]) {
            material->setShaderUniform(std::string([name UTF8String]), [value floatValue]);
        } else if ([value isKindOfClass:[NSArray class]]) {
            NSArray *arr = (NSArray *)value;
            if (arr.count == 3) {
                material->setShaderUniform(std::string([name UTF8String]), VROVector3f([arr[0] floatValue], [arr[1] floatValue], [arr[2] floatValue]));
            } else if (arr.count == 4) {
                material->setShaderUniform(std::string([name UTF8String]), VROVector4f([arr[0] floatValue], [arr[1] floatValue], [arr[2] floatValue], [arr[3] floatValue]));
            }
        }
    }
}

- (void)setShaderModifiers:(NSDictionary *)modifiers {
    _shaderModifiers = modifiers;
    std::shared_ptr<VROGeometry> geometry = [self node]->getGeometry();
    if (!geometry || geometry->getMaterials().empty()) {
        return;
    }

    std::shared_ptr<VROMaterial> material = geometry->getMaterials()[0];
    // NOTE: Commenting out to preserve system modifiers (e.g., skinning)
    // material->removeAllShaderModifiers();

    for (id entryPointKey in modifiers) {
        NSString *entryPointName = (NSString *)entryPointKey;
        id modifierValue = modifiers[entryPointKey];

        // Handle both string and dictionary formats
        NSString *modifierCode;
        if ([modifierValue isKindOfClass:[NSString class]]) {
            modifierCode = (NSString *)modifierValue;
        } else if ([modifierValue isKindOfClass:[NSDictionary class]]) {
            NSDictionary *modifierDict = (NSDictionary *)modifierValue;
            NSString *uniforms = modifierDict[@"uniforms"];
            NSString *body = modifierDict[@"body"];
            if (uniforms && uniforms.length > 0) {
                modifierCode = [NSString stringWithFormat:@"%@\n%@", uniforms, body ? body : @""];
            } else {
                modifierCode = body;
            }

            if (!modifierCode) {
                RCTLogError(@"Shader modifier dictionary must contain 'body' or 'uniforms' key");
                continue;
            }
        } else {
            RCTLogError(@"Shader modifier must be string or dictionary with 'body' key");
            continue;
        }

        VROShaderEntryPoint entryPoint = [self convertEntryPoint:entryPointName];
        NSArray *lines = [modifierCode componentsSeparatedByString:@"\n"];
        std::vector<std::string> linesVec;
        for (NSString *line in lines) {
            linesVec.push_back(std::string([line UTF8String]));
        }

        auto modifier = std::make_shared<VROShaderModifier>(entryPoint, linesVec);
        material->addShaderModifier(modifier);
    }

    // Force geometry substrate to reset - critical for geometry shaders that modify vertex data
    geometry->updateSubstrate();
}

- (VROShaderEntryPoint)convertEntryPoint:(NSString *)name {
    if ([@"geometry" caseInsensitiveCompare:name] == NSOrderedSame) {
        return VROShaderEntryPoint::Geometry;
    } else if ([@"vertex" caseInsensitiveCompare:name] == NSOrderedSame) {
        return VROShaderEntryPoint::Vertex;
    } else if ([@"surface" caseInsensitiveCompare:name] == NSOrderedSame) {
        return VROShaderEntryPoint::Surface;
    } else if ([@"fragment" caseInsensitiveCompare:name] == NSOrderedSame) {
        return VROShaderEntryPoint::Fragment;
    } else if ([@"lightingModel" caseInsensitiveCompare:name] == NSOrderedSame) {
        return VROShaderEntryPoint::LightingModel;
    }
    return VROShaderEntryPoint::Fragment;
}

// Apply materials to the underlying geometry if materials were explicitly set
// via the materials prop
- (void)applyMaterials {
    [self applyMaterialsRecursive:NO];
}

// Apply materials recursively to all child nodes in the hierarchy.
// Used for 3D models (Viro3DObject) that have nested geometries.
- (void)applyMaterialsRecursive:(BOOL)recursive {
    if (!self.node) {
        return;
    }

    // Clear existing shader material tracking for this node
    [self.shaderMaterialsMap removeAllObjects];

    std::shared_ptr<VROGeometry> geometry = self.node->getGeometry();
    if (geometry) {
        if (!self.materials) {
            // If materials were removed from object, then reset the materials array.
            // This ensures a clean slate when materials are cleared
            std::vector<std::shared_ptr<VROMaterial>> tempMaterials;
            tempMaterials.push_back(std::make_shared<VROMaterial>());
            geometry->setMaterials(tempMaterials);

            // Remove from tracking registry since no shader materials
            [shaderMaterialsNodesRegistry removeObject:self];
        } else {
            VRTMaterialManager *materialManager = [self.bridge moduleForClass:[VRTMaterialManager class]];

            std::vector<std::shared_ptr<VROMaterial>> tempMaterials;
            BOOL hasShaderMaterials = NO;

            for (int i = 0; i < self.materials.count; i++) {
                NSString *materialName = [self.materials objectAtIndex:i];

                std::shared_ptr<VROMaterial> sourceMaterial = [materialManager getMaterialByName:materialName];
                if (sourceMaterial == NULL) {
                    RCTLogError(@"Unknown Material Name: \"%@\"", materialName);
                    return;
                }

                // ALWAYS copy materials to prevent state persistence bugs
                // This ensures each object has its own independent material instance
                std::shared_ptr<VROMaterial> materialCopy = std::make_shared<VROMaterial>(sourceMaterial);

                // Track materials with shader modifiers for uniform propagation
                if (sourceMaterial->getShaderModifiers().size() > 0) {
                    hasShaderMaterials = YES;

                    // Track this cloned material for uniform updates
                    NSMutableArray *clonedMaterialsArray = self.shaderMaterialsMap[materialName];
                    if (!clonedMaterialsArray) {
                        clonedMaterialsArray = [[NSMutableArray alloc] init];
                        self.shaderMaterialsMap[materialName] = clonedMaterialsArray;
                    } else {
                        // CRITICAL: Clear array from previous runs to prevent accumulation
                        [clonedMaterialsArray removeAllObjects];
                    }

                    // Store raw pointer (material is owned by geometry)
                    [clonedMaterialsArray addObject:[NSValue valueWithPointer:materialCopy.get()]];
                }

                tempMaterials.push_back(materialCopy);
            }
            geometry->setMaterials(tempMaterials);

            // Force geometry substrate to reset when materials change
            // This is critical for geometry shaders that modify vertex data
            geometry->updateSubstrate();

            // Register this node if it has shader materials for uniform propagation
            if (hasShaderMaterials) {
                [shaderMaterialsNodesRegistry addObject:self];
            } else {
                [shaderMaterialsNodesRegistry removeObject:self];
            }
        }
    }

    [self updateVideoTextures];

    // Recursively apply materials to all child nodes if requested
    if (recursive) {
        VRTMaterialManager *materialManager = [self.bridge moduleForClass:[VRTMaterialManager class]];
        std::vector<std::shared_ptr<VROMaterial>> tempMaterials;

        if (self.materials) {
            // Build materials list from material names - always copy
            for (int i = 0; i < self.materials.count; i++) {
                NSString *materialName = [self.materials objectAtIndex:i];
                std::shared_ptr<VROMaterial> sourceMaterial = [materialManager getMaterialByName:materialName];
                if (sourceMaterial) {
                    // Always copy to prevent state persistence
                    tempMaterials.push_back(std::make_shared<VROMaterial>(sourceMaterial));
                }
            }
        } else {
            // No materials - use default empty material for cleanup
            tempMaterials.push_back(std::make_shared<VROMaterial>());
        }

        // Apply to all child nodes recursively
        std::function<void(std::shared_ptr<VRONode>)> applyToChildren = [&](std::shared_ptr<VRONode> node) {
            for (std::shared_ptr<VRONode> child : node->getChildNodes()) {
                std::shared_ptr<VROGeometry> childGeometry = child->getGeometry();
                if (childGeometry) {
                    // Always create fresh copies for each child geometry
                    std::vector<std::shared_ptr<VROMaterial>> childMaterials;
                    for (const auto &mat : tempMaterials) {
                        childMaterials.push_back(std::make_shared<VROMaterial>(mat));
                    }
                    childGeometry->setMaterials(childMaterials);
                    // Force geometry substrate to reset
                    childGeometry->updateSubstrate();
                }
                // Recurse to grandchildren
                applyToChildren(child);
            }
        };

        applyToChildren(self.node);
    }
}

- (void)setShaderOverrides:(NSArray<NSString *> *)shaderOverrides {
    _shaderOverrides = shaderOverrides;

    // If clearing shader overrides, unregister from global registry
    if (!shaderOverrides || shaderOverrides.count == 0) {
        [shaderOverrideNodesRegistry removeObject:self];
        [self.shaderOverrideMap removeAllObjects];

        // Restore original embedded materials when removing all shader overrides
        if (!_originalEmbeddedMaterials.empty() && self.node) {
            std::shared_ptr<VROGeometry> geometry = self.node->getGeometry();
            if (geometry) {
                geometry->setMaterials(_originalEmbeddedMaterials);
                geometry->updateSubstrate();
            }
            // Clear stored materials
            _originalEmbeddedMaterials.clear();
        }

        // Restore original materials for all child nodes
        if (!_childNodeOriginalMaterials.empty() && self.node) {
            [self restoreChildNodeMaterials:self.node];
            _childNodeOriginalMaterials.clear();
        }
    } else {
        [self applyShaderOverrides];
    }
}

- (void)applyShaderOverrides {
    // Don't apply shader overrides if node doesn't exist yet
    // The model loading callback will apply them after the model loads
    if (!self.node) {
        return;
    }

    // CRITICAL: Use recursive=YES because GLB/VRX models have geometry on child nodes
    // Without this, shader changes only affect root node (which has no geometry)
    [self applyShaderOverridesRecursive:YES];
}

// Update uniforms on cloned materials from shader override source materials
- (void)updateShaderOverrideUniforms {
    for (NSString *shaderMaterialName in self.shaderOverrideMap) {
        [self updateShaderOverrideUniformsForMaterial:shaderMaterialName];
    }
}

// Update uniforms for a specific shader override material
- (void)updateShaderOverrideUniformsForMaterial:(NSString *)materialName {
    if (!self.shaderOverrideMap || !self.shaderOverrideMap[materialName]) {
        return;
    }

    VRTMaterialManager *materialManager = [self.bridge moduleForClass:[VRTMaterialManager class]];
    std::shared_ptr<VROMaterial> shaderMaterial = [materialManager getMaterialByName:materialName];
    if (!shaderMaterial) {
        return;
    }

    NSArray *clonedMaterialsArray = self.shaderOverrideMap[materialName];

    for (NSValue *materialPtr in clonedMaterialsArray) {
        VROMaterial *clonedMaterial = (VROMaterial *)[materialPtr pointerValue];

        // Update all uniform types from source material to cloned material
        for (const auto &uniform : shaderMaterial->getShaderUniformFloats()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
        for (const auto &uniform : shaderMaterial->getShaderUniformVec3s()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
        for (const auto &uniform : shaderMaterial->getShaderUniformVec4s()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
        for (const auto &uniform : shaderMaterial->getShaderUniformMat4s()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
    }
}

// Update uniforms for materials applied via the materials prop (not shaderOverrides)
- (void)updateShaderMaterialUniformsForMaterial:(NSString *)materialName {
    if (!self.shaderMaterialsMap || !self.shaderMaterialsMap[materialName]) {
        return;
    }

    VRTMaterialManager *materialManager = [self.bridge moduleForClass:[VRTMaterialManager class]];
    std::shared_ptr<VROMaterial> sourceMaterial = [materialManager getMaterialByName:materialName];
    if (!sourceMaterial) {
        return;
    }

    NSArray *clonedMaterialsArray = self.shaderMaterialsMap[materialName];

    for (NSValue *materialPtr in clonedMaterialsArray) {
        VROMaterial *clonedMaterial = (VROMaterial *)[materialPtr pointerValue];

        // Update all uniform types from source material to cloned material
        for (const auto &uniform : sourceMaterial->getShaderUniformFloats()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
        for (const auto &uniform : sourceMaterial->getShaderUniformVec3s()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
        for (const auto &uniform : sourceMaterial->getShaderUniformVec4s()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
        for (const auto &uniform : sourceMaterial->getShaderUniformMat4s()) {
            clonedMaterial->setShaderUniform(uniform.first, uniform.second);
        }
    }
}

// Apply shader modifiers to existing materials without replacing textures.
// Clones the geometry's current materials and merges shader modifiers from the override materials.
- (void)applyShaderOverridesRecursive:(BOOL)recursive {
    if (!self.node || !self.shaderOverrides) {
        return;
    }

    // Clear existing tracking
    [self.shaderOverrideMap removeAllObjects];

    std::shared_ptr<VROGeometry> geometry = self.node->getGeometry();

    // For 3D models (GLB/FBX/VRX), geometry is often on child nodes, not the root
    // So we need to proceed with recursive application even if root has no geometry
    if (geometry) {
        // Get materials from geometry
        std::vector<std::shared_ptr<VROMaterial>> currentMaterials = geometry->getMaterials();

        NSLog(@"[SHADER OVERRIDE] Current materials count: %zu", currentMaterials.size());
        for (size_t i = 0; i < currentMaterials.size(); i++) {
            auto mat = currentMaterials[i];
            bool hasDiffuseTex = mat->getDiffuse().getTexture() != nullptr;
            NSLog(@"[SHADER OVERRIDE]   Material %zu: has diffuse texture = %@", i, hasDiffuseTex ? @"YES" : @"NO");
        }

        // Check if we have materials to work with
        if (currentMaterials.empty()) {
            // Model hasn't loaded yet or has no materials, skip for now
            NSLog(@"[SHADER OVERRIDE] No materials found, skipping");
            return;
        }

        // Store original embedded materials on first call (only if non-empty!)
        // For VRX/FBX with async textures, we'll update this when textures finish loading
        if (_originalEmbeddedMaterials.empty()) {
            NSLog(@"[SHADER OVERRIDE] Storing %zu original materials", currentMaterials.size());
            _originalEmbeddedMaterials = currentMaterials;
        } else {
            // Check if we should UPDATE stored materials (for VRX with async textures)
            // If current materials have textures but stored ones don't, update
            bool currentHasTextures = false;
            bool storedHasTextures = false;

            for (const auto &mat : currentMaterials) {
                if (mat->getDiffuse().getTexture() != nullptr ||
                    mat->getRoughness().getTexture() != nullptr ||
                    mat->getMetalness().getTexture() != nullptr) {
                    currentHasTextures = true;
                    break;
                }
            }

            for (const auto &mat : _originalEmbeddedMaterials) {
                if (mat->getDiffuse().getTexture() != nullptr ||
                    mat->getRoughness().getTexture() != nullptr ||
                    mat->getMetalness().getTexture() != nullptr) {
                    storedHasTextures = true;
                    break;
                }
            }

            if (currentHasTextures && !storedHasTextures) {
                NSLog(@"[SHADER OVERRIDE] Updating stored materials with textures");
                _originalEmbeddedMaterials = currentMaterials;
            } else {
                NSLog(@"[SHADER OVERRIDE] Using %zu stored original materials", _originalEmbeddedMaterials.size());
            }
        }

        // Always use the stored original embedded materials as the baseline
        std::vector<std::shared_ptr<VROMaterial>> originalMaterials = _originalEmbeddedMaterials;

        VRTMaterialManager *materialManager = [self.bridge moduleForClass:[VRTMaterialManager class]];

        // For each shader override material, extract shader modifiers and uniforms
        for (NSString *shaderMaterialName in self.shaderOverrides) {
            std::shared_ptr<VROMaterial> shaderMaterial = [materialManager getMaterialByName:shaderMaterialName];
            if (!shaderMaterial) {
                RCTLogError(@"Unknown Shader Material: \"%@\"", shaderMaterialName);
                continue;
            }

            // Track cloned materials for this shader override
            NSMutableArray *clonedMaterialsArray = [[NSMutableArray alloc] init];

            // Clone original materials and merge shader modifiers
            std::vector<std::shared_ptr<VROMaterial>> mergedMaterials;
            for (const auto &originalMat : originalMaterials) {
                // Create a new material copying the original (preserves textures)
                std::shared_ptr<VROMaterial> mergedMat = std::make_shared<VROMaterial>(originalMat);

                // CRITICAL: Copy lighting model from shader override to override PBR
                // This allows "Constant" lighting to override the VRX model's "PhysicallyBased" lighting
                mergedMat->setLightingModel(shaderMaterial->getLightingModel());
                NSLog(@"[SHADER OVERRIDE] Set lighting model from shader material");

                // NOTE: We DON'T clear existing shader modifiers because:
                // 1. We always start from a fresh copy of original materials (which have skinning modifiers)
                // 2. Clearing would remove critical system modifiers like skinning
                // 3. No accumulation occurs since each shader change starts from stored originals
                // mergedMat->removeAllShaderModifiers(); // ← REMOVED to preserve skinning modifiers

                // Copy shader modifiers from shader material to merged material
                for (const auto &modifier : shaderMaterial->getShaderModifiers()) {
                    mergedMat->addShaderModifier(modifier);
                }

                // Copy shader uniforms (floats)
                for (const auto &uniform : shaderMaterial->getShaderUniformFloats()) {
                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                }
                // Copy shader uniforms (vec3)
                for (const auto &uniform : shaderMaterial->getShaderUniformVec3s()) {
                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                }
                // Copy shader uniforms (vec4)
                for (const auto &uniform : shaderMaterial->getShaderUniformVec4s()) {
                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                }
                // Copy shader uniforms (mat4)
                for (const auto &uniform : shaderMaterial->getShaderUniformMat4s()) {
                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                }

                mergedMaterials.push_back(mergedMat);

                // Store pointer to track for uniform updates
                [clonedMaterialsArray addObject:[NSValue valueWithPointer:mergedMat.get()]];
            }

            // Store in map for later uniform updates
            self.shaderOverrideMap[shaderMaterialName] = clonedMaterialsArray;

            // Apply merged materials to geometry
            geometry->setMaterials(mergedMaterials);
        }

        // Force geometry substrate to reset after shader override materials are applied
        geometry->updateSubstrate();
    }

    // Recursively apply to child nodes if requested (for 3D models with nested geometries)
    // This is CRITICAL for GLB/VRX models where geometry is on child nodes
    if (recursive) {
        VRTMaterialManager *materialManager = [self.bridge moduleForClass:[VRTMaterialManager class]];

        std::function<void(std::shared_ptr<VRONode>)> applyToChildren = [&](std::shared_ptr<VRONode> node) {
            for (std::shared_ptr<VRONode> child : node->getChildNodes()) {
                std::shared_ptr<VROGeometry> childGeometry = child->getGeometry();
                if (childGeometry) {
                    // Store original materials for this child node on first call
                    std::vector<std::shared_ptr<VROMaterial>> childOriginalMaterials;
                    VRONode* childPtr = child.get();

                    if (_childNodeOriginalMaterials.find(childPtr) == _childNodeOriginalMaterials.end()) {
                        // First time - save original materials (with skinning modifiers, textures, etc.)
                        childOriginalMaterials = childGeometry->getMaterials();
                        if (!childOriginalMaterials.empty()) {
                            _childNodeOriginalMaterials[childPtr] = childOriginalMaterials;
                            NSLog(@"[SHADER OVERRIDE] Stored %zu original materials for child node", childOriginalMaterials.size());
                        }
                    } else {
                        // Use stored original materials as baseline
                        childOriginalMaterials = _childNodeOriginalMaterials[childPtr];
                        NSLog(@"[SHADER OVERRIDE] Using %zu stored original materials for child node", childOriginalMaterials.size());
                    }

                    if (!childOriginalMaterials.empty()) {
                        // Apply shader overrides to child materials
                        for (NSString *shaderMaterialName in self.shaderOverrides) {
                            std::shared_ptr<VROMaterial> shaderMaterial = [materialManager getMaterialByName:shaderMaterialName];
                            if (!shaderMaterial) {
                                continue;
                            }

                            // Get or create tracking array for this shader material
                            NSMutableArray *clonedMaterialsArray = self.shaderOverrideMap[shaderMaterialName];
                            if (!clonedMaterialsArray) {
                                clonedMaterialsArray = [[NSMutableArray alloc] init];
                                self.shaderOverrideMap[shaderMaterialName] = clonedMaterialsArray;
                            } else {
                                // CRITICAL: Clear array from previous scene runs to prevent accumulation
                                // Without this, arrays grow on each rerun, causing "index beyond bounds" crashes
                                [clonedMaterialsArray removeAllObjects];
                            }

                            std::vector<std::shared_ptr<VROMaterial>> mergedChildMaterials;
                            for (const auto &originalMat : childOriginalMaterials) {
                                std::shared_ptr<VROMaterial> mergedMat = std::make_shared<VROMaterial>(originalMat);

                                // CRITICAL: Copy lighting model from shader override to override PBR
                                mergedMat->setLightingModel(shaderMaterial->getLightingModel());

                                // NOTE: We DON'T clear existing shader modifiers because:
                                // 1. We always start from a fresh copy of original materials (which have skinning modifiers)
                                // 2. Clearing would remove critical system modifiers like skinning
                                // 3. No accumulation occurs since each shader change starts from stored originals
                                // mergedMat->removeAllShaderModifiers(); // ← REMOVED to preserve skinning modifiers

                                // Copy shader modifiers
                                for (const auto &modifier : shaderMaterial->getShaderModifiers()) {
                                    mergedMat->addShaderModifier(modifier);
                                }

                                // Copy all uniforms
                                for (const auto &uniform : shaderMaterial->getShaderUniformFloats()) {
                                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                                }
                                for (const auto &uniform : shaderMaterial->getShaderUniformVec3s()) {
                                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                                }
                                for (const auto &uniform : shaderMaterial->getShaderUniformVec4s()) {
                                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                                }
                                for (const auto &uniform : shaderMaterial->getShaderUniformMat4s()) {
                                    mergedMat->setShaderUniform(uniform.first, uniform.second);
                                }

                                mergedChildMaterials.push_back(mergedMat);

                                // Track this cloned material for uniform updates
                                [clonedMaterialsArray addObject:[NSValue valueWithPointer:mergedMat.get()]];
                            }

                            childGeometry->setMaterials(mergedChildMaterials);
                            // Force geometry substrate to reset
                            childGeometry->updateSubstrate();
                        }
                    }
                }
                // Recurse to grandchildren
                applyToChildren(child);
            }
        };

        applyToChildren(self.node);
    }

    // Register this node in the global registry if it has shader overrides
    if (self.shaderOverrideMap.count > 0) {
        [shaderOverrideNodesRegistry addObject:self];
    }
}

- (void)restoreChildNodeMaterials:(std::shared_ptr<VRONode>)node {
    // Recursively restore original materials for all child nodes
    for (std::shared_ptr<VRONode> child : node->getChildNodes()) {
        std::shared_ptr<VROGeometry> childGeometry = child->getGeometry();
        if (childGeometry) {
            VRONode* childPtr = child.get();
            auto it = _childNodeOriginalMaterials.find(childPtr);
            if (it != _childNodeOriginalMaterials.end()) {
                childGeometry->setMaterials(it->second);
                childGeometry->updateSubstrate();
                NSLog(@"[SHADER OVERRIDE] Restored %zu original materials for child node", it->second.size());
            }
        }
        // Recurse to grandchildren
        [self restoreChildNodeMaterials:child];
    }
}

#pragma mark - Animation

- (void)setAnimation:(NSDictionary *)animation {
    [self.nodeAnimation parseFromDictionary:animation];
    self.nodeAnimation.animationName = [animation objectForKey:@"name"];
    [self.nodeAnimation updateAnimation];
}

- (void)setOnAnimationStartViro:(RCTDirectEventBlock)onAnimationStartViro {
    self.nodeAnimation.onStart = onAnimationStartViro;
}

- (void)setOnAnimationFinishViro:(RCTDirectEventBlock)onAnimationFinishViro {
    self.nodeAnimation.onFinish = onAnimationFinishViro;
}

#pragma mark - Flexbox

- (void)reactSetFrame:(CGRect)frame {
    // These frames are in terms of anchorPoint = topLeft, but internally the
    // views are anchorPoint = center for easier scale and rotation animations.
    // Convert the frame so it works with anchorPoint = center.
    CGPoint position = {CGRectGetMidX(frame), CGRectGetMidY(frame)};
    CGRect bounds = {CGPointZero, frame.size};
    
    self.position2DFlex = position;
    self.centerPoint2DFlex = CGPointMake(bounds.size.width/2, bounds.size.height/2);
    self.bounds2DFlex = bounds;

    // Since this function is called after didSetProps, we can't rely on that to call
    // recalcLayout. Also, it looks like this method is called in a random order on the
    // views in the scene, so we need to post calls to recalcLayout to the main thread
    // to ensure all the views have their frame set before calculating the layouts
    dispatch_async(dispatch_get_main_queue(), ^{
        [self recalcLayout];
    });
}

-(CGPoint)fudgeFlexboxScaleX:(float)width3d  Y:(float)height3d {
    return CGPointMake(width3d, height3d);
}

- (BOOL)isRootFlexboxView {
    return NO;
}

// Recalculates the layout based on flexview porps
- (void)recalcLayout {
    // Root flexbox views don't need to run this block.
    if([self isRootFlexboxView]) {
        return;
    }
    
    // Check if this view is in a flexbox container, if not then return
    if(![self isWithinFlexBoxContainer]) {
        return;
    }

    VRTNode *realSuperview;
    
    // Find superview, skipping over animated components.
    if (self.superview && [self.superview isKindOfClass:[VRTNode class]]) {
        realSuperview = (VRTNode *)self.superview;
    } else if(self.superview && [self.superview isKindOfClass:[VRTAnimatedComponent class]]) {
        if([self.superview.superview isKindOfClass:[VRTNode class]]) {
            realSuperview = (VRTNode *) self.superview.superview;
        }
    }
    
    if(!realSuperview) {
        return;
    }
    
    // Avoid crashes due to nan coords
    if (isnan(self.position2DFlex.x) || isnan(self.position2DFlex.y) ||
        isnan(self.bounds2DFlex.origin.x) || isnan(self.bounds2DFlex.origin.y) ||
        isnan(self.bounds2DFlex.size.width) || isnan(self.bounds2DFlex.size.height)) {
        RCTLogError(@"Invalid layout for (%@)%@. position: %@. bounds: %@",
                    self.reactTag, self, NSStringFromCGPoint(self.position2DFlex), NSStringFromCGRect(self.bounds2DFlex));
        return;
    }
    
    // The 2d center of the superview, ie if the parent has a width and height of 5000 points, this is: 2500,2500.
    CGPoint centerPointParent2d = [realSuperview centerPoint2DFlex];
    
    // The 2d bounds, width and height of parent.
    CGRect boundsParent2d = [realSuperview bounds2DFlex];
    
    // Flip y because our y increases as it goes 'up', instead of increasing downward with mobile.
    CGFloat transformedY = boundsParent2d.size.height - self.position2DFlex.y;
    
    // Transform by subtracting from center of superview.
    CGFloat transformedX = self.position2DFlex.x - centerPointParent2d.x;
    transformedY = transformedY - centerPointParent2d.y;
    
    // Multiply by height and width of parent to get correct position
    transformedX /= k2DPointsPerSpatialUnit;
    transformedY /= k2DPointsPerSpatialUnit;
    
    // Always place the children of views .01 meters in front of the parent. This helps with z-fighting and ensures that the child is always in front of the parent for hit detection
    float zIncrementToAvoidZFighting = .01;
    [self node]->setPosition({(float)transformedX, (float)transformedY, zIncrementToAvoidZFighting});
    
    // Since VRTFlexView containers are actual size using width and height, set child components to appopriate width/height. If components don't have width/height attrib, use scale for now.
    if([self isKindOfClass:[VRTImage class]]) {
        VRTImage *image = (VRTImage *)self;
        //NSLog(@"Flex image position(%f, %f), size:(%f, %f)", transformedX, transformedY,node.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit, node.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit );
        [image setWidth:self.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit];
        [image setHeight:self.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit];
        [image didSetProps:nil];
    } else if([self isKindOfClass:[VRTFlexView class]]) {
        VRTFlexView *flexview = (VRTFlexView *)self;
        //NSLog(@"Flex view position(%f, %f), size(%f, %f)", transformedX, transformedY,node.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit,  node.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit);
        [flexview setWidth:self.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit];
        [flexview setHeight:self.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit];
        [flexview didSetProps:nil];
    }
    else if([self isKindOfClass:[VRTQuad class]]) {
        VRTQuad *surface = (VRTQuad *)self;
        //NSLog(@"Flex surface position(%f, %f), size:(%f, %f)", transformedX, transformedY,node.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit, node.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit );
        [surface setWidth:self.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit];
        [surface setHeight:self.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit];
        [surface didSetProps:nil];
    }
    else if([self isKindOfClass:[VRTVideoSurface class]]) {
        VRTVideoSurface *surface = (VRTVideoSurface *)self;
        //NSLog(@"Video surface position(%f, %f), size:(%f, %f)", transformedX, transformedY,node.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit, node.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit );
        [surface setWidth:self.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit];
        [surface setHeight:self.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit];
        [surface didSetProps:nil];
    }
    else if([self isKindOfClass:[VRTText class]]) {
        VRTText *text = (VRTText *)self;
        [text setWidth:self.bounds2DFlex.size.width/ k2DPointsPerSpatialUnit];
        [text setHeight:self.bounds2DFlex.size.height/ k2DPointsPerSpatialUnit];
        [text didSetProps:nil];
    }
    else {
        //VA: TODO, VIRO-742 if we want flex for componenents that don't have width and height property then uncomment below line.
        //[self node]->setScale({(float)scale.x, (float)scale.y, 1.0});
    }
}


// Traverse up the view hierachy to see if the node is under a rootflexview. Return true if it is, false otherwise.
- (BOOL)isWithinFlexBoxContainer {
    if([self isRootFlexboxView]) {
        return YES;
    }
    
    VRTNode *superview = ([self.superview isKindOfClass:[VRTAnimatedComponent class]]) ? self.superview.superview : (VRTNode *)self.superview;
    while(superview) {
        
        if([superview isKindOfClass:[VRTNode class]]) {
            if([superview isRootFlexboxView]) {
                return YES;
            }
        }
        superview = superview.superview;
        //skip checking animated component superview, ignore it when it comes to flexbox
        if([superview isKindOfClass:[VRTAnimatedComponent class]]){
            superview = superview.superview;
        }
    }
    return NO;
}

#pragma mark - Events

- (void)setHighAccuracyEvents:(BOOL)enabled{
    if (!self.node) {
        return;
    }
    
    @try {
        _highAccuracyEvents = enabled;
        [self node]->setHighAccuracyEvents(enabled);
    } @catch (NSException *exception) {
        NSLog(@"Error updating highAccuracyEvents property: %@", exception.reason);
    }
}

- (void)onHoverViro:(RCTDirectEventBlock)block {
    _onHoverViro = block;
}

- (void)onClickViro:(RCTDirectEventBlock)block {
    _onClickViro = block;
}

- (void)setCanCollide:(BOOL)canCollide {
    if (!self.node) {
        return;
    }
    
    @try {
        _canCollide = canCollide;
        
        if (canCollide && !_physicsDelegate) {
            _physicsDelegate = std::make_shared<VROPhysicsBodyDelegateiOS>(self);
        } else if (!canCollide) {
            _physicsDelegate = nil;
        }
        
        // Update the physic body's delegate if possible
        std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
        if (!body) {
            return;
        }
        
        if (canCollide) {
            body->setPhysicsDelegate(_physicsDelegate);
        } else {
            body->setPhysicsDelegate(nullptr);
        }
    } @catch (NSException *exception) {
        NSLog(@"Error updating canCollide property: %@", exception.reason);
    }
}

- (void)setCanPinch:(BOOL)canPinch {
    if (!self.node || !self.eventDelegate) {
        return;
    }
    
    @try {
        _canPinch = canPinch;
        self.eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnPinch, canPinch);
    } @catch (NSException *exception) {
        NSLog(@"Error updating canPinch property: %@", exception.reason);
    }
}

- (void)setCanRotate:(BOOL)canRotate {
    if (!self.node || !self.eventDelegate) {
        return;
    }
    
    @try {
        _canRotate = canRotate;
        self.eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnRotate, canRotate);
    } @catch (NSException *exception) {
        NSLog(@"Error updating canRotate property: %@", exception.reason);
    }
}

- (void)setCanHover:(BOOL)canHover {
    if (!self.node || !self.eventDelegate) {
        return;
    }
    
    @try {
        _canHover = canHover;
        self.eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnHover, canHover);
    } @catch (NSException *exception) {
        NSLog(@"Error updating canHover property: %@", exception.reason);
    }
}

- (void)setCanClick:(BOOL)canClick {
    if (!self.node || !self.eventDelegate) {
        return;
    }
    
    @try {
        _canClick = canClick;
        self.eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnClick, canClick);
    } @catch (NSException *exception) {
        NSLog(@"Error updating canClick property: %@", exception.reason);
    }
}

- (void)setCanFuse:(BOOL)canFuse {
    if (!self.node || !self.eventDelegate) {
        return;
    }
    
    @try {
        _canFuse = canFuse;
        self.eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnFuse, canFuse);
    } @catch (NSException *exception) {
        NSLog(@"Error updating canFuse property: %@", exception.reason);
    }
}

- (void)setCanDrag:(BOOL)canDrag {
    if (!self.node || !self.eventDelegate) {
        return;
    }
    
    @try {
        _canDrag = canDrag;
        self.eventDelegate->setEnabledEvent(VROEventDelegate::EventAction::OnDrag, canDrag);
    } @catch (NSException *exception) {
        NSLog(@"Error updating canDrag property: %@", exception.reason);
    }
}

- (void)setTimeToFuse:(float)durationMillis {
    if (!self.node || !self.eventDelegate) {
        return;
    }
    
    @try {
        _timeToFuse = durationMillis;
        self.eventDelegate->setTimeToFuse(durationMillis);
    } @catch (NSException *exception) {
        NSLog(@"Error updating timeToFuse property: %@", exception.reason);
    }
}

- (void)setDragType:(NSString *)dragType {
    if (!self.node) {
        return;
    }
    
    @try {
        if ([dragType caseInsensitiveCompare:@"FixedDistance"] == NSOrderedSame) {
            _node->setDragType(VRODragType::FixedDistance);
        } else if ([dragType caseInsensitiveCompare:@"FixedToWorld"] == NSOrderedSame) {
            _node->setDragType(VRODragType::FixedToWorld);
        } else if ([dragType caseInsensitiveCompare:@"FixedToPlane"] == NSOrderedSame) {
            _node->setDragType(VRODragType::FixedToPlane);
        } else {
            RCTLogError(@"Received unknown drag type: %@", dragType);
        }
    } @catch (NSException *exception) {
        NSLog(@"Error updating dragType property: %@", exception.reason);
    }
}

- (void)setDragPlane:(NSDictionary *)dict {
    if (!self.node) {
        return;
    }
    
    @try {
        NSArray *planePoint = [dict objectForKey:@"planePoint"];
        NSArray *planeNormal = [dict objectForKey:@"planeNormal"];
        if (planePoint && planeNormal) {
            [self node]->setDragPlanePoint({[[planePoint objectAtIndex:0] floatValue],
                                            [[planePoint objectAtIndex:1] floatValue],
                                            [[planePoint objectAtIndex:2] floatValue]});

            [self node]->setDragPlaneNormal({[[planeNormal objectAtIndex:0] floatValue],
                                             [[planeNormal objectAtIndex:1] floatValue],
                                             [[planeNormal objectAtIndex:2] floatValue]});
        }

        NSNumber *maxDistance = [dict objectForKey:@"maxDistance"];
        if (maxDistance) {
            [self node]->setDragMaxDistance([maxDistance floatValue]);
        }
    } @catch (NSException *exception) {
        NSLog(@"Error updating dragPlane property: %@", exception.reason);
    }
}

- (void)setIgnoreEventHandling:(BOOL)ignoreEventHandling {
    if (!self.node) {
        return;
    }
    
    @try {
        _ignoreEventHandling = ignoreEventHandling;
        [self resolveIgnoreEventHandling];
    } @catch (NSException *exception) {
        NSLog(@"Error updating ignoreEventHandling property: %@", exception.reason);
    }
}

- (void)setShouldIgnoreEventHandling:(BOOL)ignoreEventHandling {
    if (!self.node) {
        return;
    }
    
    @try {
        _shouldIgnoreEventHandling = ignoreEventHandling;
        [self resolveIgnoreEventHandling];
    } @catch (NSException *exception) {
        NSLog(@"Error updating shouldIgnoreEventHandling property: %@", exception.reason);
    }
}

- (void)resolveIgnoreEventHandling {
    if (!self.node) {
        return;
    }
    
    @try {
        BOOL resolvedIgnoreEventHandling = _ignoreEventHandling || _shouldIgnoreEventHandling;
        [self node]->setIgnoreEventHandling(resolvedIgnoreEventHandling);
        for (VRTNode *child : [self reactSubviews]) {
            child.shouldIgnoreEventHandling = resolvedIgnoreEventHandling;
        }
    } @catch (NSException *exception) {
        NSLog(@"Error in resolveIgnoreEventHandling: %@", exception.reason);
    }
}

- (void)setLightReceivingBitMask:(int)lightReceivingBitMask {
    if (!self.node) {
        return;
    }
    
    @try {
        _lightReceivingBitMask = lightReceivingBitMask;
        _node->setLightReceivingBitMask(lightReceivingBitMask);
    } @catch (NSException *exception) {
        NSLog(@"Error updating lightReceivingBitMask property: %@", exception.reason);
    }
}

- (void)setShadowCastingBitMask:(int)shadowCastingBitMask {
    if (!self.node) {
        return;
    }
    
    @try {
        _shadowCastingBitMask = shadowCastingBitMask;
        _node->setShadowCastingBitMask(shadowCastingBitMask);
    } @catch (NSException *exception) {
        NSLog(@"Error updating shadowCastingBitMask property: %@", exception.reason);
    }
}

-(void)onHover:(int)source node:(std::shared_ptr<VRONode>)node
    isHovering:(bool)isHovering
 hoverLocation:(std::vector<float>)location {
    if (self.onHoverViro != nil) {
        NSArray *locationArray;
        if (location.size() == 3) {
            locationArray = @[@(location.at(0)), @(location.at(1)), @(location.at(2))];
        } else {
            locationArray = @[];
        }
        
        self.onHoverViro(@{@"source": @(source),
                           @"isHovering":@(isHovering),
                           @"position": locationArray});
    }
}

-(void)onClick:(int)source node:(std::shared_ptr<VRONode>)node clickState:(VROEventDelegate::ClickState)clickState
 clickLocation:(std::vector<float>)location{
    if (self.onClickViro != nil) {
        NSArray *locationArray;
        if (location.size() == 3) {
            locationArray = @[@(location.at(0)), @(location.at(1)), @(location.at(2))];
        } else {
            locationArray = @[];
        }
        
        self.onClickViro(@{@"source": @(source),
                           @"clickState":@(clickState),
                           @"position": locationArray});
    }
}

- (void)onPinch:(int)source node:(std::shared_ptr<VRONode>)node scaleFactor:(float)scale
     pinchState:(VROEventDelegate::PinchState)pinchState {
    if(self.onPinchViro != nil) {
        self.onPinchViro(@{@"source": @(source), @"pinchState":@(pinchState), @"scaleFactor":@(scale)});
    }
}

- (void)onRotate:(int)source node:(std::shared_ptr<VRONode>)node rotationRadians:(float)rotation
     rotateState:(VROEventDelegate::RotateState)rotateState {
    if(self.onRotateViro != nil) {
        // convert to degrees from radians
        float degreesRotation = toDegrees(rotation);
        self.onRotateViro(@{@"source": @(source), @"rotateState":@(rotateState), @"rotationFactor":@(degreesRotation)});
    }
}

- (void)onFuse:(int)source node:(std::shared_ptr<VRONode>)node {
    if (self.onFuseViro != nil) {
        self.onFuseViro(@{@"source": @(source)});
    }
}

- (void)onDrag:(int)source node:(std::shared_ptr<VRONode>)node posX:(float)x posY:(float)y posZ:(float)z {
    if (self.onDragViro != nil) {
        self.onDragViro(@{@"source": @(source),
                          @"dragToPos" : @[@(x), @(y), @(z)]});
    }
}

- (void)onCameraARHitTest:(std::vector<std::shared_ptr<VROARHitTestResult>>)results {
    //no-op base class for this event.
}

- (void)onARPointCloudUpdated:(std::shared_ptr<VROARPointCloud>)pointCloud {
    //no-op base class for this event.
}

#pragma mark - Physics Implementations

- (void)setScene:(std::shared_ptr<VROScene>)scene {
    [super setScene:scene];
}

- (void)clearPhysicsBody {
    std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
    if (body) {
        [self node]->clearPhysicsBody();
    }
}

- (std::shared_ptr<VROPhysicsBody>)createPhysicsBody:(VROPhysicsBody::VROPhysicsBodyType)bodyType
                                            withMass:(float)mass
                                           withShape:(std::shared_ptr<VROPhysicsShape>) physicsShape {
    std::shared_ptr<VROPhysicsBody> body = [self node]->initPhysicsBody(bodyType, mass, physicsShape);
    if (_physicsDelegate) {
        body->setPhysicsDelegate(_physicsDelegate);
    } else {
        body->setPhysicsDelegate(nullptr);
    }
    return body;
}

- (void)setPhysicsBody:(NSDictionary *)dictionary {
    // If un-setting the physicsBody, clear it from the node.
    if (!dictionary){
        [self clearPhysicsBody];
        self.physicsDictionary = dictionary;
        return;
    }
    
    // Else update the current physicsBody with the new properties, recreating
    // the body if needed. Log and return if an error has occured.
    if (![self recreatePhysicsBodyIfNeeded:dictionary]
        || ![self updatePhysicsBodyProperties:dictionary]
        || ![self applyForcesOnBody:dictionary]){
        return;
    }
    
    // Finally save a copy of the last known set physics properties.
    self.physicsDictionary = dictionary;
}

- (bool)recreatePhysicsBodyIfNeeded:(NSDictionary *)dictionary{
    // Determine if the physics body type has changed
    NSString *nsStringBodyTypeProp = [dictionary objectForKey:@"type"];
    NSString *nsStringBodyTypeCurrent = nullptr;
    if (self.physicsDictionary){
        nsStringBodyTypeCurrent = [self.physicsDictionary objectForKey:@"type"];
    }
    
    bool hasBodyTypeChanged = nsStringBodyTypeProp != nsStringBodyTypeCurrent;
    if (nsStringBodyTypeProp){
        hasBodyTypeChanged = ![nsStringBodyTypeProp isEqualToString:nsStringBodyTypeCurrent];
    }
    std::string stringBodyType = std::string([nsStringBodyTypeProp UTF8String]);
    
    // Check if the provided phsyics body type with the given mass is valid.
    std::string errorMsg;
    float mass = [[dictionary objectForKey:@"mass"] floatValue];
    bool isValid = VROPhysicsBody::isValidType(stringBodyType, mass, errorMsg);
    if (!isValid){
        RCTLogError(@"%@", [NSString stringWithUTF8String:errorMsg.c_str()]);
        return false;
    }
    
    // Determine if the physics shape has changed
    NSDictionary *nsShapeDictionaryProp = [dictionary objectForKey:@"shape"];
    NSDictionary *nsShapeDictionaryCurrent = nullptr;
    if (self.physicsDictionary){
        nsShapeDictionaryCurrent = [self.physicsDictionary objectForKey:@"shape"];
    }
    
    bool hasBodyShapeChanged = nsShapeDictionaryProp != nsShapeDictionaryCurrent;
    if (nsShapeDictionaryProp){
        hasBodyTypeChanged = ![nsShapeDictionaryProp isEqualToDictionary:nsShapeDictionaryCurrent];
    }
    
    // Create or update the VROPhysicsBody only if needed
    std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
    if (!body || hasBodyTypeChanged || hasBodyShapeChanged){
        std::shared_ptr<VROPhysicsShape> propPhysicsShape = nullptr;
        
        // Recreate a physics shape with the latest properties by grabbing
        // the current shapeType (required in JS if providing a physics shape)
        if (nsShapeDictionaryProp){
            NSString *stringShapeName = [nsShapeDictionaryProp objectForKey:@"type"];
            NSArray *shapeParams = [nsShapeDictionaryProp objectForKey:@"params"];
            propPhysicsShape = [VRTNode getPhysicsShape:stringShapeName params:shapeParams];
            if (propPhysicsShape == nullptr){
                return false;
            }
        }
        
        // Re-create the physics body if the type has changed or if one doesn't exists.
        if (!body || hasBodyTypeChanged){
            // Clean up the existing physicsBody if it exists.
            [self clearPhysicsBody];
            
            // Create and attach the Physics body to the scene
            VROPhysicsBody::VROPhysicsBodyType propBodyType
            = VROPhysicsBody::getBodyTypeForString(stringBodyType);
            body = [self createPhysicsBody:propBodyType withMass:mass withShape:propPhysicsShape];
        } else if (hasBodyShapeChanged){
            body->setPhysicsShape(propPhysicsShape);
        }
    }
    return true;
}

- (bool)updatePhysicsBodyProperties:(NSDictionary *)dictionary {
    std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
    float mass = [[dictionary objectForKey:@"mass"] floatValue];
    std::string stringBodyType = std::string([[dictionary objectForKey:@"type"] UTF8String]);
    
    NSArray *inertia = [dictionary objectForKey:@"inertia"];
    if (inertia != nil){
        if ([inertia count] != 3) {
            RCTLogError(@"Incorrect parameters provided for inertia, expected: [x, y, z]!");
            return false;
        }
        
        VROVector3f inertia3f = VROVector3f([[inertia objectAtIndex:1] floatValue],
                                            [[inertia objectAtIndex:2] floatValue],
                                            [[inertia objectAtIndex:3] floatValue]);
        body->setInertia(inertia3f);
    }
    
    if ([dictionary objectForKey:@"mass"]) {
        std::string errorMsg;
        bool isValid = VROPhysicsBody::isValidType(stringBodyType, mass, errorMsg);
        if (!isValid){
            RCTLogError(@"%@", [NSString stringWithUTF8String:errorMsg.c_str()]);
            return false;
        }
        body->setMass(mass);
    }
    
    if ([dictionary objectForKey:@"friction"]) {
        float friction = [[dictionary objectForKey:@"friction"] floatValue];
        body->setFriction(friction);
    }
    
    if ([dictionary objectForKey:@"restitution"]) {
        float restitution = [[dictionary objectForKey:@"restitution"] floatValue];
        body->setRestitution(restitution);
    }
    
    if ([dictionary objectForKey:@"enabled"]) {
        self.physicsEnabled = [[dictionary objectForKey:@"enabled"] boolValue];
    } else {
        self.physicsEnabled = YES;
    }
    body->setIsSimulated([self shouldAppear] && self.physicsEnabled);

    if ([dictionary objectForKey:@"useGravity"]) {
        bool useGravity = [[dictionary objectForKey:@"useGravity"] boolValue];
        VROPhysicsBody::VROPhysicsBodyType propBodyType
        = VROPhysicsBody::getBodyTypeForString(stringBodyType);
        if (propBodyType != VROPhysicsBody::VROPhysicsBodyType::Dynamic && useGravity){
            RCTLogWarn(@"Attempted to set useGravity for non-dynamic phsyics bodies.");
        } else {
            body->setUseGravity(useGravity);
        }
    }
    
    NSArray *velocity = [dictionary objectForKey:@"velocity"];
    if (velocity != nil){
        if ([velocity count] != 3) {
            RCTLogError(@"Incorrect parameters provided for velocity, expected: [x, y, z]!");
            return false;
        }
        
        [self setVelocity:velocity isConstant:YES];
    } else {
        velocity = [NSArray arrayWithObjects:
                    [NSNumber numberWithFloat:0],
                    [NSNumber numberWithFloat:0],
                    [NSNumber numberWithFloat:0],nil];
        
        [self setVelocity:velocity isConstant:YES];
    }
    return true;
}

- (bool)applyForcesOnBody:(NSDictionary *)dictionary{
    NSArray *torqueArray = [dictionary objectForKey:@"torque"];
    NSObject *forceObject = [dictionary objectForKey:@"force"];
    // Check and parse force objects into a dictionary array to iterate over.
    NSArray* forceArray;
    if ([forceObject isKindOfClass:[NSDictionary class]]) {
        forceArray = [[NSArray alloc] initWithObjects:forceObject, nil];
    } else if ([forceObject isKindOfClass:[NSArray class]]) {
        forceArray = (NSArray*)forceObject;
    } else if (forceArray) {
        RCTLogError(@"Invalid force format!");
        return false;
    }
    
    // Deteremine if the applied torque has changed
    NSArray *torqueArrayCurrent = self.physicsDictionary? [self.physicsDictionary objectForKey:@"torque"]: nil;
    bool hasTorqueChanged = torqueArray != torqueArrayCurrent;
    if (torqueArray) {
        hasTorqueChanged = ![torqueArray isEqualToArray:torqueArrayCurrent];
    }

    // Deteremine if the applied force has changed
    NSObject *forceObjectCurrent = self.physicsDictionary? [self.physicsDictionary objectForKey:@"force"]: nil;
    NSArray* forceArrayCurrent = nil;
    if ([forceObjectCurrent isKindOfClass:[NSDictionary class]]) {
        forceArrayCurrent = [[NSArray alloc] initWithObjects:forceObjectCurrent, nil];
    } else if ([forceObjectCurrent isKindOfClass:[NSArray class]]) {
        forceArrayCurrent = (NSArray*)forceObjectCurrent;
    }
    bool hasForceChanged = forceArray != forceArrayCurrent;
    if (forceArray) {
        hasForceChanged = ![forceArray isEqualToArray:forceArrayCurrent];
    }

    // If nothing has changed, return
    if (!hasForceChanged && !hasTorqueChanged) {
        return true;
    }
    
    // Reset forces before applying new ones
    std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
    body->clearForces();
    
    // Apply Toque
    NSArray *torque = [dictionary objectForKey:@"torque"];
    if (torque != nil) {
        if ([torque count] != 3) {
            RCTLogError(@"Incorrect paramters provided for torque, expected: [x, y, z]!");
            return false;
        }
        
        VROVector3f torque3f = VROVector3f([[torque objectAtIndex:0] floatValue],
                                           [[torque objectAtIndex:1] floatValue],
                                           [[torque objectAtIndex:2] floatValue]);
        body->applyTorque(torque3f);
    }
    
    // Iterate over force array and apply forces to the phsyics body.
    for (int i=0; i < [forceArray count]; i++) {
        if (![forceArray[i] isKindOfClass:[NSDictionary class]]) {
            RCTLogError(@"Invalid format, expected a force format of type dictionary!");
            return false;
        }
        
        // Grab the required value of the force.
        VROVector3f force3f;
        NSArray *value = [forceArray[i] objectForKey:@"value"];
        if (value) {
            if ([value count] != 3) {
                RCTLogError(@"Incorrect parameters provided for force's value, expected: [x, y, z]!");
                return false;
            }
            
            force3f = VROVector3f([[value objectAtIndex:0] floatValue],
                                  [[value objectAtIndex:1] floatValue],
                                  [[value objectAtIndex:2] floatValue]);
        } else {
            RCTLogError(@"Incorrect parameters: missing value of format [x, y, z] for force!");
            return false;
        }
        
        // Grab the optional position of the applied force.
        VROVector3f position3f;
        NSArray *position = [forceArray[i] objectForKey:@"position"];
        if (position) {
            if ([position count] != 3) {
                RCTLogError(@"Incorrect parameters provided for force's position, expected: [x, y, z]!");
                return false;
            }
            
            position3f = VROVector3f([[position objectAtIndex:0] floatValue],
                                     [[position objectAtIndex:1] floatValue],
                                     [[position objectAtIndex:2] floatValue]);
        } else {
            position3f = VROVector3f(0,0,0);
        }
        body->applyForce(force3f, position3f);
    }
    
    return true;
}

-(void)setVelocity:(NSArray*)velocity isConstant:(bool)constant{
    std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
    if (!body) {
        RCTLogError(@"Attempted to set a velocity on a non-physics node");
    }
    VROVector3f velocity3f = VROVector3f([[velocity objectAtIndex:0] floatValue],
                                         [[velocity objectAtIndex:1] floatValue],
                                         [[velocity objectAtIndex:2] floatValue]);
    body->setVelocity(velocity3f, constant);
}

+(std::shared_ptr<VROPhysicsShape>)getPhysicsShape:(NSString *)stringShapeName params:(NSArray *)shapeParams {
    if (!stringShapeName) {
        RCTLogError(@"Provided an invalid physics shape name to the physics body!");
        return nullptr;
    }
    
    // Grab the current shapeParams
    std::vector<float> params = {};
    if (shapeParams) {
        for (int i = 0; i < [shapeParams count]; i ++) {
            float value = [[shapeParams objectAtIndex:i] floatValue];
            params.push_back(value);
        }
    }
    
    // Check if an invalid shape and param was provided.
    std::string errorMsg;
    std::string strShapeName = std::string([stringShapeName UTF8String]);
    bool isValid = VROPhysicsShape::isValidShape(strShapeName, params, errorMsg);
    if (!isValid) {
        RCTLogError(@"%@", [NSString stringWithUTF8String:errorMsg.c_str()]);
        return nullptr;
    }
    
    // Create a VROPhysicsShape
    VROPhysicsShape::VROShapeType propShapeType = VROPhysicsShape::getTypeForString(strShapeName);
    return std::make_shared<VROPhysicsShape>(propShapeType, params);
}

-(void)applyImpulse:(VROVector3f)impulse withOffset:(VROVector3f)offset {
    std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
    if (!body) {
        RCTLogError(@"Attempted to set an impulse force on a non-physics node");
        return;
    }
    body->applyImpulse(impulse, offset);
}


-(void)applyTorqueImpulse:(VROVector3f)torque {
    std::shared_ptr<VROPhysicsBody> body = [self node]->getPhysicsBody();
    if (!body) {
        RCTLogError(@"Attempted to set an impulse force on a non-physics node");
        return;
    }
    body->applyTorqueImpulse(torque);
}

- (void)onCollided:(std::string) bodyKey
         collision:(VROPhysicsBody::VROCollision)collision {

    NSMutableArray *coordinate = [NSMutableArray array];
    [coordinate addObject:[NSNumber numberWithFloat:collision.collidedPoint.x]];
    [coordinate addObject:[NSNumber numberWithFloat:collision.collidedPoint.y]];
    [coordinate addObject:[NSNumber numberWithFloat:collision.collidedPoint.z]];

    NSMutableArray *normal = [NSMutableArray array];
    [normal addObject:[NSNumber numberWithFloat:collision.collidedNormal.x]];
    [normal addObject:[NSNumber numberWithFloat:collision.collidedNormal.y]];
    [normal addObject:[NSNumber numberWithFloat:collision.collidedNormal.z]];

    self.onCollisionViro(@{@"viroTag": @(collision.collidedBodyTag.c_str()), @"collidedPoint":coordinate, @"collidedNormal":normal});
}

#pragma mark - Memory Management

- (void)dealloc {
    // Clear all delegates to prevent retain cycles
    if (_node) {
        _node->setEventDelegate(nullptr);
        _node->setTransformDelegate(nullptr);

        // Clear physics delegate from physics body if it exists
        std::shared_ptr<VROPhysicsBody> body = _node->getPhysicsBody();
        if (body) {
            body->setPhysicsDelegate(nullptr);
        }
    }

    // Clear C++ shared_ptr delegates
    _eventDelegate = nullptr;
    _transformDelegate = nullptr;
    _physicsDelegate = nullptr;

    // Clear node reference
    _node = nullptr;

    // Clear animation references
    _nodeAnimation = nil;

    // Unregister from shader registries
    [shaderOverrideNodesRegistry removeObject:self];
    [shaderMaterialsNodesRegistry removeObject:self];
}

@end
