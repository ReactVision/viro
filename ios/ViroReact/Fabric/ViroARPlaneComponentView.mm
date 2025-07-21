//
//  ViroARPlaneComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroARPlaneComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>
#import <ViroKit/ViroKit.h>
#import <ARKit/ARKit.h>

@interface ViroARPlaneComponentView ()

// ViroReact AR Plane Integration
@property (nonatomic, strong) std::shared_ptr<VROARPlane> vroARPlane;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroPlaneNode;
@property (nonatomic, strong) std::shared_ptr<VROGeometry> vroPlaneGeometry;
@property (nonatomic, strong) std::shared_ptr<VROPlaneAnchor> vroPlaneAnchor;

// AR Plane Configuration
@property (nonatomic, assign) BOOL visible;
@property (nonatomic, assign) NSString *alignment;
@property (nonatomic, assign) NSString *classification;
@property (nonatomic, assign) CGFloat minWidth;
@property (nonatomic, assign) CGFloat minHeight;

// Plane Visualization Properties
@property (nonatomic, strong) NSArray<NSNumber *> *width;
@property (nonatomic, strong) NSArray<NSNumber *> *height;
@property (nonatomic, strong) NSArray<NSNumber *> *center;
@property (nonatomic, strong) NSArray<NSNumber *> *extent;

// Plane Material Properties
@property (nonatomic, strong) NSString *material;
@property (nonatomic, strong) NSArray<NSNumber *> *color;
@property (nonatomic, assign) CGFloat opacity;

// Plane Detection Properties
@property (nonatomic, assign) BOOL automaticDetection;
@property (nonatomic, assign) BOOL trackingEnabled;
@property (nonatomic, assign) BOOL boundaryEnabled;

@end

@implementation ViroARPlaneComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroARPlaneComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        RCTLogInfo(@"[ViroARPlaneComponentView] Initializing AR Plane");
        
        // Initialize default AR plane configuration
        _visible = YES;
        _alignment = @"horizontal";
        _classification = @"none";
        _minWidth = 0.1f;
        _minHeight = 0.1f;
        _opacity = 1.0f;
        _automaticDetection = YES;
        _trackingEnabled = YES;
        _boundaryEnabled = NO;
        
        [self initializeViroReactARPlane];
    }
    return self;
}

- (void)initializeViroReactARPlane
{
    RCTLogInfo(@"[ViroARPlaneComponentView] Initializing ViroReact AR plane");
    
    // Create ViroReact AR plane
    _vroARPlane = VROARPlane::create();
    
    // Create plane node
    _vroPlaneNode = std::make_shared<VRONode>();
    
    // Create plane geometry
    _vroPlaneGeometry = VROPlaneGeometry::create(1.0f, 1.0f, 1, 1);
    _vroPlaneNode->setGeometry(_vroPlaneGeometry);
    
    // Configure AR plane properties
    _vroARPlane->setVisible(_visible);
    _vroARPlane->setMinimumSize(VROVector2f(_minWidth, _minHeight));
    _vroARPlane->setAutomaticDetection(_automaticDetection);
    _vroARPlane->setTrackingEnabled(_trackingEnabled);
    _vroARPlane->setBoundaryEnabled(_boundaryEnabled);
    
    // Configure plane alignment
    [self updatePlaneAlignment];
    
    // Set default plane color
    if (!_color) {
        _color = @[@1.0f, @1.0f, @1.0f, @1.0f]; // White with full opacity
    }
    [self updatePlaneMaterial];
    
    RCTLogInfo(@"[ViroARPlaneComponentView] ViroReact AR plane initialized successfully");
}

#pragma mark - AR Plane Configuration Methods

- (void)setVisible:(BOOL)visible
{
    _visible = visible;
    if (_vroARPlane) {
        _vroARPlane->setVisible(visible);
    }
    if (_vroPlaneNode) {
        _vroPlaneNode->setVisible(visible);
    }
}

- (void)setAlignment:(NSString *)alignment
{
    _alignment = alignment;
    [self updatePlaneAlignment];
}

- (void)updatePlaneAlignment
{
    if (!_vroARPlane) {
        return;
    }
    
    if ([_alignment isEqualToString:@"horizontal"]) {
        _vroARPlane->setAlignment(VROARPlaneAlignment::Horizontal);
    } else if ([_alignment isEqualToString:@"vertical"]) {
        _vroARPlane->setAlignment(VROARPlaneAlignment::Vertical);
    } else if ([_alignment isEqualToString:@"horizontalUpward"]) {
        _vroARPlane->setAlignment(VROARPlaneAlignment::HorizontalUpward);
    } else if ([_alignment isEqualToString:@"horizontalDownward"]) {
        _vroARPlane->setAlignment(VROARPlaneAlignment::HorizontalDownward);
    } else {
        _vroARPlane->setAlignment(VROARPlaneAlignment::Horizontal);
    }
}

- (void)setClassification:(NSString *)classification
{
    _classification = classification;
    if (_vroARPlane) {
        if ([classification isEqualToString:@"none"]) {
            _vroARPlane->setClassification(VROARPlaneClassification::None);
        } else if ([classification isEqualToString:@"wall"]) {
            _vroARPlane->setClassification(VROARPlaneClassification::Wall);
        } else if ([classification isEqualToString:@"floor"]) {
            _vroARPlane->setClassification(VROARPlaneClassification::Floor);
        } else if ([classification isEqualToString:@"ceiling"]) {
            _vroARPlane->setClassification(VROARPlaneClassification::Ceiling);
        } else if ([classification isEqualToString:@"table"]) {
            _vroARPlane->setClassification(VROARPlaneClassification::Table);
        } else if ([classification isEqualToString:@"seat"]) {
            _vroARPlane->setClassification(VROARPlaneClassification::Seat);
        } else {
            _vroARPlane->setClassification(VROARPlaneClassification::None);
        }
    }
}

- (void)setMinWidth:(CGFloat)minWidth
{
    _minWidth = minWidth;
    [self updateMinimumSize];
}

- (void)setMinHeight:(CGFloat)minHeight
{
    _minHeight = minHeight;
    [self updateMinimumSize];
}

- (void)updateMinimumSize
{
    if (_vroARPlane) {
        _vroARPlane->setMinimumSize(VROVector2f(_minWidth, _minHeight));
    }
}

- (void)setAutomaticDetection:(BOOL)automaticDetection
{
    _automaticDetection = automaticDetection;
    if (_vroARPlane) {
        _vroARPlane->setAutomaticDetection(automaticDetection);
    }
}

- (void)setTrackingEnabled:(BOOL)trackingEnabled
{
    _trackingEnabled = trackingEnabled;
    if (_vroARPlane) {
        _vroARPlane->setTrackingEnabled(trackingEnabled);
    }
}

- (void)setBoundaryEnabled:(BOOL)boundaryEnabled
{
    _boundaryEnabled = boundaryEnabled;
    if (_vroARPlane) {
        _vroARPlane->setBoundaryEnabled(boundaryEnabled);
    }
}

#pragma mark - Plane Visualization Methods

- (void)setWidth:(NSArray<NSNumber *> *)width
{
    _width = width;
    [self updatePlaneGeometry];
}

- (void)setHeight:(NSArray<NSNumber *> *)height
{
    _height = height;
    [self updatePlaneGeometry];
}

- (void)updatePlaneGeometry
{
    if (!_vroPlaneGeometry) {
        return;
    }
    
    float planeWidth = 1.0f;
    float planeHeight = 1.0f;
    
    if (_width && _width.count > 0) {
        planeWidth = [_width[0] floatValue];
    }
    if (_height && _height.count > 0) {
        planeHeight = [_height[0] floatValue];
    }
    
    // Update plane geometry with new dimensions
    _vroPlaneGeometry = VROPlaneGeometry::create(planeWidth, planeHeight, 1, 1);
    _vroPlaneNode->setGeometry(_vroPlaneGeometry);
}

- (void)setCenter:(NSArray<NSNumber *> *)center
{
    _center = center;
    [self updatePlanePosition];
}

- (void)updatePlanePosition
{
    if (!_vroPlaneNode || !_center || _center.count < 3) {
        return;
    }
    
    VROVector3f position([_center[0] floatValue], [_center[1] floatValue], [_center[2] floatValue]);
    _vroPlaneNode->setPosition(position);
}

#pragma mark - Plane Material Methods

- (void)setMaterial:(NSString *)material
{
    _material = material;
    [self updatePlaneMaterial];
}

- (void)setColor:(NSArray<NSNumber *> *)color
{
    _color = color;
    [self updatePlaneMaterial];
}

- (void)setOpacity:(CGFloat)opacity
{
    _opacity = opacity;
    [self updatePlaneMaterial];
}

- (void)updatePlaneMaterial
{
    if (!_vroPlaneNode) {
        return;
    }
    
    // Create material for the plane
    auto material = VROMaterial::create();
    
    // Set diffuse color
    if (_color && _color.count >= 3) {
        float r = [_color[0] floatValue];
        float g = [_color[1] floatValue];
        float b = [_color[2] floatValue];
        float a = _color.count > 3 ? [_color[3] floatValue] : _opacity;
        
        material->getDiffuse().setColor(VROVector4f(r, g, b, a));
    }
    
    // Set transparency
    material->setTransparency(_opacity);
    
    // Apply material to plane geometry
    if (_vroPlaneGeometry) {
        _vroPlaneGeometry->setMaterial(material);
    }
}

#pragma mark - AR Plane Detection Methods

- (void)attachToPlaneAnchor:(ARPlaneAnchor *)planeAnchor
{
    RCTLogInfo(@"[ViroARPlaneComponentView] Attaching to plane anchor: %@", planeAnchor.identifier.UUIDString);
    
    if (_vroARPlane) {
        // Create VROPlaneAnchor from ARPlaneAnchor
        _vroPlaneAnchor = VROPlaneAnchor::createFromARPlaneAnchor(planeAnchor);
        _vroARPlane->setPlaneAnchor(_vroPlaneAnchor);
        
        // Update plane geometry based on detected plane
        [self updatePlaneFromAnchor:planeAnchor];
    }
}

- (void)updatePlaneFromAnchor:(ARPlaneAnchor *)planeAnchor
{
    if (!planeAnchor || !_vroPlaneGeometry) {
        return;
    }
    
    // Update plane geometry to match detected plane
    float width = planeAnchor.extent.x;
    float height = planeAnchor.extent.z;
    
    _vroPlaneGeometry = VROPlaneGeometry::create(width, height, 1, 1);
    _vroPlaneNode->setGeometry(_vroPlaneGeometry);
    
    // Update plane position
    simd_float4x4 transform = planeAnchor.transform;
    VROVector3f position(transform.columns[3].x, transform.columns[3].y, transform.columns[3].z);
    _vroPlaneNode->setPosition(position);
    
    // Update material
    [self updatePlaneMaterial];
    
    RCTLogInfo(@"[ViroARPlaneComponentView] Updated plane geometry: %.2fx%.2f at (%.2f, %.2f, %.2f)", 
               width, height, position.x, position.y, position.z);
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroARPlaneComponentView] Deallocating");
    
    // Clean up ViroReact AR plane resources
    _vroARPlane = nullptr;
    _vroPlaneNode = nullptr;
    _vroPlaneGeometry = nullptr;
    _vroPlaneAnchor = nullptr;
}

@end