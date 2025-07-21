//
//  ViroSphereComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroSphereComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTMaterialManager.h"

@interface ViroSphereComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROSphere> vroSphere;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Sphere geometry properties
@property (nonatomic, assign) CGFloat radius;
@property (nonatomic, assign) NSInteger widthSegmentCount;
@property (nonatomic, assign) NSInteger heightSegmentCount;
@property (nonatomic, assign) CGFloat phiStart;
@property (nonatomic, assign) CGFloat phiLength;
@property (nonatomic, assign) CGFloat thetaStart;
@property (nonatomic, assign) CGFloat thetaLength;

// Material properties
@property (nonatomic, strong, nullable) NSArray<NSString *> *materials;

@end

@implementation ViroSphereComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroSphereComponentDescriptor>();
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
    RCTLogInfo(@"[ViroSphereComponentView] Initializing");
    
    // Set default sphere parameters
    _radius = 1.0;
    _widthSegmentCount = 20;
    _heightSegmentCount = 20;
    _phiStart = 0.0;
    _phiLength = 2 * M_PI; // Full circle
    _thetaStart = 0.0;
    _thetaLength = M_PI; // Half circle (full sphere)
    
    // Initialize ViroReact sphere geometry
    [self initializeVROSphere];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D content to extend beyond bounds
}

- (void)initializeVROSphere
{
    RCTLogInfo(@"[ViroSphereComponentView] Creating VROSphere geometry");
    
    // Create VROSphere geometry with default parameters
    _vroSphere = VROSphere::createSphere(_radius, _widthSegmentCount, _heightSegmentCount, true, _phiStart, _phiLength, _thetaStart, _thetaLength);
    
    // Create VRONode to hold the geometry
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vroSphere);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    RCTLogInfo(@"[ViroSphereComponentView] VROSphere created successfully with radius: %.2f", _radius);
}

#pragma mark - Sphere Geometry Properties

- (void)setRadius:(CGFloat)radius
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting radius: %f", radius);
    _radius = radius;
    
    // TODO: Update sphere geometry in ViroReact renderer
    [self updateSphereGeometry];
}

- (void)setWidthSegmentCount:(NSInteger)widthSegmentCount
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting width segment count: %ld", (long)widthSegmentCount);
    _widthSegmentCount = widthSegmentCount;
    
    // TODO: Update sphere geometry in ViroReact renderer
    [self updateSphereGeometry];
}

- (void)setHeightSegmentCount:(NSInteger)heightSegmentCount
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting height segment count: %ld", (long)heightSegmentCount);
    _heightSegmentCount = heightSegmentCount;
    
    // TODO: Update sphere geometry in ViroReact renderer
    [self updateSphereGeometry];
}

- (void)setPhiStart:(CGFloat)phiStart
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting phi start: %f", phiStart);
    _phiStart = phiStart;
    
    // TODO: Update sphere geometry in ViroReact renderer
    [self updateSphereGeometry];
}

- (void)setPhiLength:(CGFloat)phiLength
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting phi length: %f", phiLength);
    _phiLength = phiLength;
    
    // TODO: Update sphere geometry in ViroReact renderer
    [self updateSphereGeometry];
}

- (void)setThetaStart:(CGFloat)thetaStart
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting theta start: %f", thetaStart);
    _thetaStart = thetaStart;
    
    // TODO: Update sphere geometry in ViroReact renderer
    [self updateSphereGeometry];
}

- (void)setThetaLength:(CGFloat)thetaLength
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting theta length: %f", thetaLength);
    _thetaLength = thetaLength;
    
    // TODO: Update sphere geometry in ViroReact renderer
    [self updateSphereGeometry];
}

- (void)updateSphereGeometry
{
    RCTLogInfo(@"[ViroSphereComponentView] Updating sphere geometry: radius=%.2f, segments=%ldx%ld, phi=[%.2f,%.2f], theta=[%.2f,%.2f]", 
               _radius, (long)_widthSegmentCount, (long)_heightSegmentCount, 
               _phiStart, _phiLength, _thetaStart, _thetaLength);
    
    // TODO: Apply sphere parameters to ViroReact renderer
    // This should update the underlying 3D sphere mesh with new parameters
    // - radius: size of the sphere
    // - widthSegmentCount/heightSegmentCount: mesh resolution
    // - phi/theta parameters: for creating partial spheres (like domes or wedges)
}

#pragma mark - Material Properties

- (void)setMaterials:(nullable NSArray<NSString *> *)materials
{
    RCTLogInfo(@"[ViroSphereComponentView] Setting materials: %@", materials);
    _materials = materials;
    
    // TODO: Apply materials to ViroReact sphere
    // Materials can be applied to different sections of the sphere
    // If only one material is provided, it applies to the entire sphere
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact sphere
    RCTLogInfo(@"[ViroSphereComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // For 3D geometry, layout is handled by 3D transforms and geometry properties
    // The 2D bounds don't directly affect the 3D sphere dimensions
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroSphereComponentView] Sphere added to window");
        // TODO: Add sphere to ViroReact scene when added to window
        [self updateSphereGeometry];
    } else {
        RCTLogInfo(@"[ViroSphereComponentView] Sphere removed from window");
        // TODO: Remove sphere from ViroReact scene when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroSphereComponentView] Deallocating");
    // TODO: Clean up ViroReact sphere resources
}

@end

Class<RCTComponentViewProtocol> ViroSphereCls(void)
{
    return ViroSphereComponentView.class;
}