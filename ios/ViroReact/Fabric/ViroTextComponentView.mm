//
//  ViroTextComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroTextComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTMaterialManager.h"

@interface ViroTextComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROText> vroText;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Text content
@property (nonatomic, strong, nullable) NSString *text;

// Text styling
@property (nonatomic, strong, nullable) NSString *fontFamily;
@property (nonatomic, assign) CGFloat fontSize;
@property (nonatomic, strong, nullable) NSString *fontWeight;
@property (nonatomic, strong, nullable) NSString *fontStyle;
@property (nonatomic, strong, nullable) NSString *color;

// Text layout
@property (nonatomic, assign) CGFloat width;
@property (nonatomic, assign) CGFloat height;
@property (nonatomic, strong, nullable) NSString *textAlign;
@property (nonatomic, strong, nullable) NSString *textAlignVertical;
@property (nonatomic, strong, nullable) NSString *textLineBreakMode;
@property (nonatomic, strong, nullable) NSString *textClipMode;
@property (nonatomic, assign) NSInteger maxLines;

// 3D text properties
@property (nonatomic, assign) CGFloat extrusionDepth;
@property (nonatomic, strong, nullable) NSDictionary *outerStroke;
@property (nonatomic, strong, nullable) NSArray<NSString *> *materials;

@end

@implementation ViroTextComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroTextComponentDescriptor>();
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
    RCTLogInfo(@"[ViroTextComponentView] Initializing");
    
    // Set default values
    _fontSize = 12.0;
    _width = 1.0;
    _height = 1.0;
    _textAlign = @"left";
    _textAlignVertical = @"top";
    _textLineBreakMode = @"wordWrap";
    _textClipMode = @"clipToBounds";
    _maxLines = 0; // 0 = unlimited
    _extrusionDepth = 0.0;
    _color = @"#FFFFFF";
    
    // Initialize ViroReact text renderer
    [self initializeVROText];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D text to extend beyond bounds
}

- (void)initializeVROText
{
    RCTLogInfo(@"[ViroTextComponentView] Creating VROText renderer");
    
    // Create VROText with default content
    NSString *initialText = _text ?: @"";
    _vroText = std::make_shared<VROText>(std::string([initialText UTF8String]), 
                                        std::string([_fontFamily ?: @"Helvetica" UTF8String]),
                                        _fontSize,
                                        VROFontStyle::Normal,
                                        VROFontWeight::Regular,
                                        VROColor::colorWithHexString([_color UTF8String]),
                                        _width, _height,
                                        VROTextHorizontalAlignment::Left,
                                        VROTextVerticalAlignment::Top,
                                        VROLineBreakMode::WordWrap,
                                        VROTextClipMode::ClipToBounds,
                                        0); // maxLines
    
    // Create VRONode to hold the text
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vroText);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    // Apply extrusion if specified
    if (_extrusionDepth > 0) {
        _vroText->setExtrusionDepth(_extrusionDepth);
    }
    
    RCTLogInfo(@"[ViroTextComponentView] VROText created successfully");
}

- (void)updateTextContent
{
    if (!_vroText || !_text) {
        return;
    }
    
    RCTLogInfo(@"[ViroTextComponentView] Updating text content");
    _vroText->setText(std::string([_text UTF8String]));
}

#pragma mark - Text Content

- (void)setText:(nullable NSString *)text
{
    RCTLogInfo(@"[ViroTextComponentView] Setting text: %@", text);
    _text = text;
    
    // Update text content in ViroReact renderer
    [self updateTextContent];
}

#pragma mark - Text Styling

- (void)setFontFamily:(nullable NSString *)fontFamily
{
    RCTLogInfo(@"[ViroTextComponentView] Setting font family: %@", fontFamily);
    _fontFamily = fontFamily;
    
    // TODO: Update font family in ViroReact renderer
    [self updateTextStyle];
}

- (void)setFontSize:(CGFloat)fontSize
{
    RCTLogInfo(@"[ViroTextComponentView] Setting font size: %f", fontSize);
    _fontSize = fontSize;
    
    // TODO: Update font size in ViroReact renderer
    [self updateTextStyle];
}

- (void)setFontWeight:(nullable NSString *)fontWeight
{
    RCTLogInfo(@"[ViroTextComponentView] Setting font weight: %@", fontWeight);
    _fontWeight = fontWeight;
    
    // TODO: Update font weight in ViroReact renderer
    [self updateTextStyle];
}

- (void)setFontStyle:(nullable NSString *)fontStyle
{
    RCTLogInfo(@"[ViroTextComponentView] Setting font style: %@", fontStyle);
    _fontStyle = fontStyle;
    
    // TODO: Update font style in ViroReact renderer
    [self updateTextStyle];
}

- (void)setColor:(nullable NSString *)color
{
    RCTLogInfo(@"[ViroTextComponentView] Setting color: %@", color);
    _color = color ?: @"#FFFFFF";
    
    // TODO: Update text color in ViroReact renderer
    [self updateTextStyle];
}

#pragma mark - Text Layout

- (void)setWidth:(CGFloat)width
{
    RCTLogInfo(@"[ViroTextComponentView] Setting width: %f", width);
    _width = width;
    
    // TODO: Update text layout in ViroReact renderer
    [self updateTextLayout];
}

- (void)setHeight:(CGFloat)height
{
    RCTLogInfo(@"[ViroTextComponentView] Setting height: %f", height);
    _height = height;
    
    // TODO: Update text layout in ViroReact renderer
    [self updateTextLayout];
}

- (void)setTextAlign:(nullable NSString *)textAlign
{
    RCTLogInfo(@"[ViroTextComponentView] Setting text align: %@", textAlign);
    _textAlign = textAlign ?: @"left";
    
    // TODO: Update text alignment in ViroReact renderer
    [self updateTextLayout];
}

- (void)setTextAlignVertical:(nullable NSString *)textAlignVertical
{
    RCTLogInfo(@"[ViroTextComponentView] Setting text align vertical: %@", textAlignVertical);
    _textAlignVertical = textAlignVertical ?: @"top";
    
    // TODO: Update vertical text alignment in ViroReact renderer
    [self updateTextLayout];
}

- (void)setTextLineBreakMode:(nullable NSString *)textLineBreakMode
{
    RCTLogInfo(@"[ViroTextComponentView] Setting text line break mode: %@", textLineBreakMode);
    _textLineBreakMode = textLineBreakMode ?: @"wordWrap";
    
    // TODO: Update line break mode in ViroReact renderer
    [self updateTextLayout];
}

- (void)setTextClipMode:(nullable NSString *)textClipMode
{
    RCTLogInfo(@"[ViroTextComponentView] Setting text clip mode: %@", textClipMode);
    _textClipMode = textClipMode ?: @"clipToBounds";
    
    // TODO: Update text clipping in ViroReact renderer
    [self updateTextLayout];
}

- (void)setMaxLines:(NSInteger)maxLines
{
    RCTLogInfo(@"[ViroTextComponentView] Setting max lines: %ld", (long)maxLines);
    _maxLines = maxLines;
    
    // TODO: Update max lines in ViroReact renderer
    [self updateTextLayout];
}

#pragma mark - 3D Text Properties

- (void)setExtrusionDepth:(CGFloat)extrusionDepth
{
    RCTLogInfo(@"[ViroTextComponentView] Setting extrusion depth: %f", extrusionDepth);
    _extrusionDepth = extrusionDepth;
    
    // TODO: Update 3D extrusion in ViroReact renderer
    [self updateText3D];
}

- (void)setOuterStroke:(nullable NSDictionary *)outerStroke
{
    RCTLogInfo(@"[ViroTextComponentView] Setting outer stroke: %@", outerStroke);
    _outerStroke = outerStroke;
    
    // TODO: Update text stroke in ViroReact renderer
    [self updateText3D];
}

- (void)setMaterials:(nullable NSArray<NSString *> *)materials
{
    RCTLogInfo(@"[ViroTextComponentView] Setting materials: %@", materials);
    _materials = materials;
    
    // TODO: Apply materials to ViroReact text
    [self updateText3D];
}

#pragma mark - Update Methods

- (void)updateTextDisplay
{
    RCTLogInfo(@"[ViroTextComponentView] Updating text display");
    
    // TODO: Update the complete text display in ViroReact renderer
    // This should refresh the text content with current styling and layout
}

- (void)updateTextStyle
{
    RCTLogInfo(@"[ViroTextComponentView] Updating text style");
    
    // TODO: Update text styling (font, color, weight, etc.) in ViroReact renderer
}

- (void)updateTextLayout
{
    RCTLogInfo(@"[ViroTextComponentView] Updating text layout");
    
    // TODO: Update text layout (alignment, wrapping, clipping) in ViroReact renderer
}

- (void)updateText3D
{
    RCTLogInfo(@"[ViroTextComponentView] Updating 3D text properties");
    
    // TODO: Update 3D text properties (extrusion, materials, stroke) in ViroReact renderer
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact text
    RCTLogInfo(@"[ViroTextComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // For 3D text, layout is handled by text properties, not 2D layout
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroTextComponentView] Text added to window");
        // TODO: Add text to ViroReact scene when added to window
        [self updateTextDisplay];
    } else {
        RCTLogInfo(@"[ViroTextComponentView] Text removed from window");
        // TODO: Remove text from ViroReact scene when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroTextComponentView] Deallocating");
    // TODO: Clean up ViroReact text resources
}

@end

Class<RCTComponentViewProtocol> ViroTextCls(void)
{
    return ViroTextComponentView.class;
}