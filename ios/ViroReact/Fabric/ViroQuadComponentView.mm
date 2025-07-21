//
//  ViroQuadComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroQuadComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTMaterialManager.h"

@interface ViroQuadComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROQuad> vroQuad;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Quad geometry properties
@property (nonatomic, assign) CGFloat width;
@property (nonatomic, assign) CGFloat height;
@property (nonatomic, assign) NSInteger widthSegmentCount;
@property (nonatomic, assign) NSInteger heightSegmentCount;

// UV mapping
@property (nonatomic, strong, nullable) NSArray<NSArray<NSNumber *> *> *uvCoordinates;

// Material properties
@property (nonatomic, strong, nullable) NSArray<NSString *> *materials;

@end

@implementation ViroQuadComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroQuadComponentDescriptor>();
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
    RCTLogInfo(@"[ViroQuadComponentView] Initializing");
    
    // Set default quad parameters
    _width = 1.0;
    _height = 1.0;
    _widthSegmentCount = 1;
    _heightSegmentCount = 1;
    
    // Default UV coordinates for a simple quad (covering entire texture)
    _uvCoordinates = @[
        @[@0, @1], // Bottom-left
        @[@1, @1], // Bottom-right
        @[@1, @0], // Top-right
        @[@0, @0]  // Top-left
    ];
    
    // Initialize ViroReact quad geometry
    [self initializeVROQuad];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D content to extend beyond bounds
}

- (void)initializeVROQuad
{
    RCTLogInfo(@"[ViroQuadComponentView] Creating VROQuad geometry");
    
    // Create VROQuad with default dimensions
    _vroQuad = VROQuad::createQuad(_width, _height);
    
    // Create VRONode to hold the geometry
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vroQuad);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    // Apply UV coordinates if custom mapping is provided
    [self updateUVCoordinates];
    
    RCTLogInfo(@"[ViroQuadComponentView] VROQuad created successfully with dimensions: %.2f x %.2f", _width, _height);
}

- (void)updateUVCoordinates
{
    if (!_vroQuad || !_uvCoordinates || _uvCoordinates.count != 4) {
        return;
    }
    
    // Convert NSArray UV coordinates to ViroKit format
    // Note: In a full implementation, this would set the UV coordinates on the quad's geometry
    RCTLogInfo(@"[ViroQuadComponentView] Updating UV coordinates");
}

#pragma mark - Quad Geometry Properties

- (void)setWidth:(CGFloat)width
{
    RCTLogInfo(@"[ViroQuadComponentView] Setting width: %f", width);
    _width = width;
    
    // TODO: Update quad geometry in ViroReact renderer
    [self updateQuadGeometry];
}

- (void)setHeight:(CGFloat)height
{
    RCTLogInfo(@"[ViroQuadComponentView] Setting height: %f", height);
    _height = height;
    
    // TODO: Update quad geometry in ViroReact renderer
    [self updateQuadGeometry];
}

- (void)setWidthSegmentCount:(NSInteger)widthSegmentCount
{
    RCTLogInfo(@"[ViroQuadComponentView] Setting width segment count: %ld", (long)widthSegmentCount);
    _widthSegmentCount = widthSegmentCount;
    
    // TODO: Update quad geometry in ViroReact renderer
    [self updateQuadGeometry];
}

- (void)setHeightSegmentCount:(NSInteger)heightSegmentCount
{
    RCTLogInfo(@"[ViroQuadComponentView] Setting height segment count: %ld", (long)heightSegmentCount);
    _heightSegmentCount = heightSegmentCount;
    
    // TODO: Update quad geometry in ViroReact renderer
    [self updateQuadGeometry];
}

- (void)updateQuadGeometry
{
    RCTLogInfo(@"[ViroQuadComponentView] Updating quad geometry: %.2f x %.2f, segments: %ldx%ld", 
               _width, _height, (long)_widthSegmentCount, (long)_heightSegmentCount);
    
    // TODO: Apply quad parameters to ViroReact renderer
    // This should update the underlying 3D quad mesh with new dimensions and segments
    // - width/height: size of the quad
    // - widthSegmentCount/heightSegmentCount: mesh resolution for displacement/normal mapping
}

#pragma mark - UV Mapping

- (void)setUvCoordinates:(nullable NSArray<NSArray<NSNumber *> *> *)uvCoordinates
{
    RCTLogInfo(@"[ViroQuadComponentView] Setting UV coordinates: %@", uvCoordinates);
    _uvCoordinates = uvCoordinates;
    
    // TODO: Update UV coordinates in ViroReact renderer
    // UV coordinates define how textures are mapped to the quad
    // Format: [[u1, v1], [u2, v2], [u3, v3], [u4, v4]] for the four corners
    [self updateQuadUVMapping];
}

- (void)updateQuadUVMapping
{
    RCTLogInfo(@"[ViroQuadComponentView] Updating quad UV mapping");
    
    // TODO: Apply UV coordinates to ViroReact renderer
    // This affects how textures and materials are applied to the quad surface
}

#pragma mark - Material Properties

- (void)setMaterials:(nullable NSArray<NSString *> *)materials
{
    RCTLogInfo(@"[ViroQuadComponentView] Setting materials: %@", materials);
    _materials = materials;
    
    // TODO: Apply materials to ViroReact quad
    // Quads typically use a single material, but can support front/back materials
}

#pragma mark - Helper Methods

- (NSArray<NSNumber *> *)defaultUVCoordinatesFlattened
{
    // Convert 2D UV array to flat array for renderer
    NSMutableArray<NSNumber *> *flattened = [[NSMutableArray alloc] init];
    for (NSArray<NSNumber *> *uvPair in _uvCoordinates) {
        if (uvPair.count >= 2) {
            [flattened addObject:uvPair[0]]; // U coordinate
            [flattened addObject:uvPair[1]]; // V coordinate
        }
    }
    return [flattened copy];
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact quad
    RCTLogInfo(@"[ViroQuadComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // For 3D geometry, layout is handled by 3D transforms and geometry properties
    // The 2D bounds don't directly affect the 3D quad dimensions
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroQuadComponentView] Quad added to window");
        // TODO: Add quad to ViroReact scene when added to window
        [self updateQuadGeometry];
        [self updateQuadUVMapping];
    } else {
        RCTLogInfo(@"[ViroQuadComponentView] Quad removed from window");
        // TODO: Remove quad from ViroReact scene when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroQuadComponentView] Deallocating");
    // TODO: Clean up ViroReact quad resources
}

@end

Class<RCTComponentViewProtocol> ViroQuadCls(void)
{
    return ViroQuadComponentView.class;
}