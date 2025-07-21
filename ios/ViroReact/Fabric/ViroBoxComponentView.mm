//
//  ViroBoxComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroBoxComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTMaterialManager.h"

@interface ViroBoxComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROBox> vroBox;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Box geometry properties
@property (nonatomic, assign) CGFloat width;
@property (nonatomic, assign) CGFloat height;
@property (nonatomic, assign) CGFloat length;

// Material properties
@property (nonatomic, strong, nullable) NSArray<NSString *> *materials;

@end

@implementation ViroBoxComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroBoxComponentDescriptor>();
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
    RCTLogInfo(@"[ViroBoxComponentView] Initializing");
    
    // Set default box dimensions
    _width = 1.0;
    _height = 1.0;
    _length = 1.0;
    
    // Initialize ViroReact box geometry
    [self initializeVROBox];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D content to extend beyond bounds
}

- (void)initializeVROBox
{
    RCTLogInfo(@"[ViroBoxComponentView] Creating VROBox geometry");
    
    // Create VROBox geometry with default dimensions
    _vroBox = VROBox::createBox(_width, _height, _length);
    
    // Create VRONode to hold the geometry
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vroBox);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    RCTLogInfo(@"[ViroBoxComponentView] VROBox created successfully with dimensions: %.2f x %.2f x %.2f", _width, _height, _length);
}

#pragma mark - Box Geometry Properties

- (void)setWidth:(CGFloat)width
{
    RCTLogInfo(@"[ViroBoxComponentView] Setting width: %f", width);
    _width = width;
    
    // Update box geometry in ViroReact renderer
    if (_vroBox) {
        _vroBox->setWidth(width);
    }
}

- (void)setHeight:(CGFloat)height
{
    RCTLogInfo(@"[ViroBoxComponentView] Setting height: %f", height);
    _height = height;
    
    // Update box geometry in ViroReact renderer
    if (_vroBox) {
        _vroBox->setHeight(height);
    }
}

- (void)setLength:(CGFloat)length
{
    RCTLogInfo(@"[ViroBoxComponentView] Setting length: %f", length);
    _length = length;
    
    // Update box geometry in ViroReact renderer
    if (_vroBox) {
        _vroBox->setLength(length);
    }
}

- (void)updateBoxGeometry
{
    RCTLogInfo(@"[ViroBoxComponentView] Updating box geometry: %.2f x %.2f x %.2f", _width, _height, _length);
    
    // TODO: Apply box dimensions to ViroReact renderer
    // This should update the underlying 3D box mesh with new dimensions
}

#pragma mark - Material Properties

- (void)setMaterials:(nullable NSArray<NSString *> *)materials
{
    RCTLogInfo(@"[ViroBoxComponentView] Setting materials: %@", materials);
    _materials = materials;
    
    // TODO: Apply materials to ViroReact box
    // Materials can be applied to different faces of the box
    // If only one material is provided, it applies to all faces
    // If 6 materials are provided, they apply to each face in order:
    // [front, right, back, left, top, bottom]
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact box
    RCTLogInfo(@"[ViroBoxComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // For 3D geometry, layout is handled by 3D transforms and geometry properties
    // The 2D bounds don't directly affect the 3D box dimensions
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroBoxComponentView] Box added to window");
        // TODO: Add box to ViroReact scene when added to window
        [self updateBoxGeometry];
    } else {
        RCTLogInfo(@"[ViroBoxComponentView] Box removed from window");
        // TODO: Remove box from ViroReact scene when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroBoxComponentView] Deallocating");
    // TODO: Clean up ViroReact box resources
}

@end

Class<RCTComponentViewProtocol> ViroBoxCls(void)
{
    return ViroBoxComponentView.class;
}