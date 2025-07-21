//
//  ViroFlexViewComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFlexViewComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>

@interface ViroFlexViewComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROFlexView> vroFlexView;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// FlexView layout properties
@property (nonatomic, assign) CGFloat width;
@property (nonatomic, assign) CGFloat height;
@property (nonatomic, strong, nullable) NSString *flexDirection;
@property (nonatomic, strong, nullable) NSString *justifyContent;
@property (nonatomic, strong, nullable) NSString *alignItems;
@property (nonatomic, strong, nullable) NSString *alignContent;
@property (nonatomic, strong, nullable) NSString *flexWrap;

// Individual flex item properties
@property (nonatomic, assign) CGFloat flex;
@property (nonatomic, assign) CGFloat flexGrow;
@property (nonatomic, assign) CGFloat flexShrink;
@property (nonatomic, assign) CGFloat flexBasis;
@property (nonatomic, strong, nullable) NSString *alignSelf;

// Margin and padding
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *margin;
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *padding;

// Material properties
@property (nonatomic, strong, nullable) NSArray<NSString *> *materials;

@end

@implementation ViroFlexViewComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroFlexViewComponentDescriptor>();
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
    RCTLogInfo(@"[ViroFlexViewComponentView] Initializing");
    
    // Set default flex layout values
    _width = 1.0;
    _height = 1.0;
    _flexDirection = @"column";
    _justifyContent = @"flex-start";
    _alignItems = @"stretch";
    _alignContent = @"stretch";
    _flexWrap = @"nowrap";
    _flex = 0.0;
    _flexGrow = 0.0;
    _flexShrink = 1.0;
    _flexBasis = 0.0;
    _alignSelf = @"auto";
    
    // Initialize ViroReact flex view
    [self initializeVROFlexView];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D content to extend beyond bounds
}

#pragma mark - FlexView Layout Properties

- (void)initializeVROFlexView
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Creating VROFlexView");
    
    // Create flex view with default dimensions
    _vroFlexView = VROFlexView::create(_width, _height);
    
    // Set default flex properties
    _vroFlexView->setFlexDirection(VROFlexDirection::Column);
    _vroFlexView->setJustifyContent(VROJustifyContent::FlexStart);
    _vroFlexView->setAlignItems(VROAlignItems::Stretch);
    _vroFlexView->setAlignContent(VROAlignContent::Stretch);
    _vroFlexView->setFlexWrap(VROFlexWrap::NoWrap);
    
    // Create VRONode to hold the flex view
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setFlexView(_vroFlexView);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    RCTLogInfo(@"[ViroFlexViewComponentView] VROFlexView created successfully");
}

- (void)setWidth:(CGFloat)width
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting width: %f", width);
    _width = width;
    
    if (_vroFlexView) {
        _vroFlexView->setWidth(width);
    }
    
    [self updateFlexLayout];
}

- (void)setHeight:(CGFloat)height
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting height: %f", height);
    _height = height;
    
    if (_vroFlexView) {
        _vroFlexView->setHeight(height);
    }
    
    [self updateFlexLayout];
}

- (void)setFlexDirection:(nullable NSString *)flexDirection
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting flex direction: %@", flexDirection);
    _flexDirection = flexDirection ?: @"column";
    
    if (_vroFlexView) {
        if ([_flexDirection isEqualToString:@"row"]) {
            _vroFlexView->setFlexDirection(VROFlexDirection::Row);
        } else if ([_flexDirection isEqualToString:@"row-reverse"]) {
            _vroFlexView->setFlexDirection(VROFlexDirection::RowReverse);
        } else if ([_flexDirection isEqualToString:@"column-reverse"]) {
            _vroFlexView->setFlexDirection(VROFlexDirection::ColumnReverse);
        } else {
            _vroFlexView->setFlexDirection(VROFlexDirection::Column);
        }
    }
    
    [self updateFlexLayout];
}

- (void)setJustifyContent:(nullable NSString *)justifyContent
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting justify content: %@", justifyContent);
    _justifyContent = justifyContent ?: @"flex-start";
    
    // TODO: Update justify content in ViroReact renderer
    // Values: "flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"
    [self updateFlexLayout];
}

- (void)setAlignItems:(nullable NSString *)alignItems
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting align items: %@", alignItems);
    _alignItems = alignItems ?: @"stretch";
    
    // TODO: Update align items in ViroReact renderer
    // Values: "flex-start", "flex-end", "center", "stretch", "baseline"
    [self updateFlexLayout];
}

- (void)setAlignContent:(nullable NSString *)alignContent
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting align content: %@", alignContent);
    _alignContent = alignContent ?: @"stretch";
    
    // TODO: Update align content in ViroReact renderer
    [self updateFlexLayout];
}

- (void)setFlexWrap:(nullable NSString *)flexWrap
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting flex wrap: %@", flexWrap);
    _flexWrap = flexWrap ?: @"nowrap";
    
    // TODO: Update flex wrap in ViroReact renderer
    // Values: "nowrap", "wrap", "wrap-reverse"
    [self updateFlexLayout];
}

#pragma mark - Individual Flex Item Properties

- (void)setFlex:(CGFloat)flex
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting flex: %f", flex);
    _flex = flex;
    
    // TODO: Update flex property in ViroReact renderer
    [self updateFlexLayout];
}

- (void)setFlexGrow:(CGFloat)flexGrow
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting flex grow: %f", flexGrow);
    _flexGrow = flexGrow;
    
    // TODO: Update flex grow in ViroReact renderer
    [self updateFlexLayout];
}

- (void)setFlexShrink:(CGFloat)flexShrink
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting flex shrink: %f", flexShrink);
    _flexShrink = flexShrink;
    
    // TODO: Update flex shrink in ViroReact renderer
    [self updateFlexLayout];
}

- (void)setFlexBasis:(CGFloat)flexBasis
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting flex basis: %f", flexBasis);
    _flexBasis = flexBasis;
    
    // TODO: Update flex basis in ViroReact renderer
    [self updateFlexLayout];
}

- (void)setAlignSelf:(nullable NSString *)alignSelf
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting align self: %@", alignSelf);
    _alignSelf = alignSelf ?: @"auto";
    
    // TODO: Update align self in ViroReact renderer
    [self updateFlexLayout];
}

#pragma mark - Margin and Padding

- (void)setMargin:(nullable NSArray<NSNumber *> *)margin
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting margin: %@", margin);
    _margin = margin;
    
    // TODO: Update margin in ViroReact renderer
    // Array format: [top, right, bottom, left] or [all] or [vertical, horizontal]
    [self updateFlexLayout];
}

- (void)setPadding:(nullable NSArray<NSNumber *> *)padding
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting padding: %@", padding);
    _padding = padding;
    
    // TODO: Update padding in ViroReact renderer
    [self updateFlexLayout];
}

#pragma mark - Material Properties

- (void)setMaterials:(nullable NSArray<NSString *> *)materials
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Setting materials: %@", materials);
    _materials = materials;
    
    // TODO: Apply materials to ViroReact flex view
    // FlexView can have a background material
}

#pragma mark - Layout Update

- (void)updateFlexLayout
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Updating flex layout - Size: %.2fx%.2f, Direction: %@, Justify: %@, Align: %@", 
               _width, _height, _flexDirection, _justifyContent, _alignItems);
    
    // TODO: Apply flex layout properties to ViroReact renderer
    // This should trigger a layout pass for all child components
    // FlexView uses Yoga layout engine for 3D space layout
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact flex view
    RCTLogInfo(@"[ViroFlexViewComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // FlexView handles 3D layout of child components using flexbox rules
    [self updateFlexLayout];
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroFlexViewComponentView] FlexView added to window");
        // TODO: Add flex view to ViroReact scene when added to window
        [self updateFlexLayout];
    } else {
        RCTLogInfo(@"[ViroFlexViewComponentView] FlexView removed from window");
        // TODO: Remove flex view from ViroReact scene when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroFlexViewComponentView] Deallocating");
    // TODO: Clean up ViroReact flex view resources
}

@end

Class<RCTComponentViewProtocol> ViroFlexViewCls(void)
{
    return ViroFlexViewComponentView.class;
}