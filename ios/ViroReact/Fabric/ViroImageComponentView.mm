//
//  ViroImageComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroImageComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTMaterialManager.h"
#import "VRTImageAsyncLoader.h"

@interface ViroImageComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROQuad> vroQuad;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;
@property (nonatomic, strong, nullable) VRTImageAsyncLoader *imageLoader;

// Image source and content
@property (nonatomic, strong, nullable) NSDictionary *source;
@property (nonatomic, strong, nullable) NSDictionary *placeholderSource;

// Image dimensions
@property (nonatomic, assign) CGFloat width;
@property (nonatomic, assign) CGFloat height;

// Image display properties
@property (nonatomic, strong, nullable) NSString *format;
@property (nonatomic, assign) BOOL mipmap;
@property (nonatomic, strong, nullable) NSString *wrapS;
@property (nonatomic, strong, nullable) NSString *wrapT;
@property (nonatomic, strong, nullable) NSString *minificationFilter;
@property (nonatomic, strong, nullable) NSString *magnificationFilter;
@property (nonatomic, strong, nullable) NSString *resizeMode;
@property (nonatomic, strong, nullable) NSString *imageClipMode;

// Stereo image properties
@property (nonatomic, strong, nullable) NSString *stereoMode;

// Material properties
@property (nonatomic, strong, nullable) NSArray<NSString *> *materials;

// Event blocks
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onLoadStart;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onLoadEnd;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onError;

@end

@implementation ViroImageComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroImageComponentDescriptor>();
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
    RCTLogInfo(@"[ViroImageComponentView] Initializing");
    
    // Set default values
    _width = 1.0;
    _height = 1.0;
    _format = @"RGBA8";
    _mipmap = YES;
    _wrapS = @"clamp";
    _wrapT = @"clamp";
    _minificationFilter = @"linear";
    _magnificationFilter = @"linear";
    _resizeMode = @"scaleToFill";
    _imageClipMode = @"none";
    _stereoMode = @"none";
    
    // Initialize ViroReact image renderer
    [self initializeVROImage];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Allow 3D content to extend beyond bounds
}

- (void)initializeVROImage
{
    RCTLogInfo(@"[ViroImageComponentView] Creating VROImage geometry");
    
    // Create VROQuad to display the image
    _vroQuad = VROQuad::createQuad(_width, _height);
    
    // Create VRONode to hold the geometry
    _vroNode = std::make_shared<VRONode>();
    _vroNode->setGeometry(_vroQuad);
    
    // Set default properties
    _vroNode->setVisible(true);
    _vroNode->setOpacity(1.0);
    
    // Initialize image loader for async loading
    _imageLoader = [[VRTImageAsyncLoader alloc] init];
    
    RCTLogInfo(@"[ViroImageComponentView] VROImage quad created successfully with dimensions: %.2f x %.2f", _width, _height);
}

- (void)loadImageFromSource
{
    if (!_source || !_imageLoader || !_vroQuad) {
        return;
    }
    
    RCTLogInfo(@"[ViroImageComponentView] Loading image from source: %@", _source);
    
    // Use VRTImageAsyncLoader to load the image
    // This would typically involve:
    // 1. Parsing the source dictionary for URI
    // 2. Loading the image asynchronously
    // 3. Creating a texture from the loaded image
    // 4. Applying the texture to the quad's material
    
    // For now, we'll log the action
    NSString *uri = _source[@"uri"];
    if (uri) {
        RCTLogInfo(@"[ViroImageComponentView] Would load image from URI: %@", uri);
        // In full implementation, this would trigger async image loading
    }
}

#pragma mark - Image Source and Content

- (void)setSource:(nullable NSDictionary *)source
{
    RCTLogInfo(@"[ViroImageComponentView] Setting source: %@", source);
    _source = source;
    
    // TODO: Load image from source in ViroReact renderer
    [self loadImageFromSource];
}

- (void)setPlaceholderSource:(nullable NSDictionary *)placeholderSource
{
    RCTLogInfo(@"[ViroImageComponentView] Setting placeholder source: %@", placeholderSource);
    _placeholderSource = placeholderSource;
    
    // TODO: Load placeholder image in ViroReact renderer
}

- (void)loadImageFromSource
{
    if (!_source) {
        return;
    }
    
    // Emit load start event
    if (_onLoadStart) {
        _onLoadStart(@{
            @"source": _source
        });
    }
    
    // TODO: Implement actual image loading
    // This should handle various source types:
    // - { uri: "https://..." } - Network image
    // - { uri: "file://..." } - Local file
    // - require('./image.png') - Bundle resource
    
    RCTLogInfo(@"[ViroImageComponentView] Loading image from source: %@", _source);
    
    // For now, simulate successful load
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.onLoadEnd) {
            self.onLoadEnd(@{
                @"source": self.source,
                @"success": @YES
            });
        }
    });
}

#pragma mark - Image Dimensions

- (void)setWidth:(CGFloat)width
{
    RCTLogInfo(@"[ViroImageComponentView] Setting width: %f", width);
    _width = width;
    
    // TODO: Update image dimensions in ViroReact renderer
    [self updateImageGeometry];
}

- (void)setHeight:(CGFloat)height
{
    RCTLogInfo(@"[ViroImageComponentView] Setting height: %f", height);
    _height = height;
    
    // TODO: Update image dimensions in ViroReact renderer
    [self updateImageGeometry];
}

- (void)updateImageGeometry
{
    RCTLogInfo(@"[ViroImageComponentView] Updating image geometry: %.2f x %.2f", _width, _height);
    
    // TODO: Apply image dimensions to ViroReact renderer
    // This should update the image quad size
}

#pragma mark - Image Display Properties

- (void)setFormat:(nullable NSString *)format
{
    RCTLogInfo(@"[ViroImageComponentView] Setting format: %@", format);
    _format = format ?: @"RGBA8";
    
    // TODO: Apply image format to ViroReact renderer
    // Formats: RGBA8, RGB565, etc.
}

- (void)setMipmap:(BOOL)mipmap
{
    RCTLogInfo(@"[ViroImageComponentView] Setting mipmap: %@", mipmap ? @"YES" : @"NO");
    _mipmap = mipmap;
    
    // TODO: Apply mipmap setting to ViroReact renderer
}

- (void)setWrapS:(nullable NSString *)wrapS
{
    RCTLogInfo(@"[ViroImageComponentView] Setting wrapS: %@", wrapS);
    _wrapS = wrapS ?: @"clamp";
    
    // TODO: Apply texture wrap mode to ViroReact renderer
    // Modes: clamp, repeat, mirror
}

- (void)setWrapT:(nullable NSString *)wrapT
{
    RCTLogInfo(@"[ViroImageComponentView] Setting wrapT: %@", wrapT);
    _wrapT = wrapT ?: @"clamp";
    
    // TODO: Apply texture wrap mode to ViroReact renderer
}

- (void)setMinificationFilter:(nullable NSString *)minificationFilter
{
    RCTLogInfo(@"[ViroImageComponentView] Setting minification filter: %@", minificationFilter);
    _minificationFilter = minificationFilter ?: @"linear";
    
    // TODO: Apply texture filtering to ViroReact renderer
    // Filters: nearest, linear
}

- (void)setMagnificationFilter:(nullable NSString *)magnificationFilter
{
    RCTLogInfo(@"[ViroImageComponentView] Setting magnification filter: %@", magnificationFilter);
    _magnificationFilter = magnificationFilter ?: @"linear";
    
    // TODO: Apply texture filtering to ViroReact renderer
}

- (void)setResizeMode:(nullable NSString *)resizeMode
{
    RCTLogInfo(@"[ViroImageComponentView] Setting resize mode: %@", resizeMode);
    _resizeMode = resizeMode ?: @"scaleToFill";
    
    // TODO: Apply resize mode to ViroReact renderer
    // Modes: scaleToFill, scaleAspectFit, scaleAspectFill
}

- (void)setImageClipMode:(nullable NSString *)imageClipMode
{
    RCTLogInfo(@"[ViroImageComponentView] Setting image clip mode: %@", imageClipMode);
    _imageClipMode = imageClipMode ?: @"none";
    
    // TODO: Apply image clipping to ViroReact renderer
}

#pragma mark - Stereo Image Properties

- (void)setStereoMode:(nullable NSString *)stereoMode
{
    RCTLogInfo(@"[ViroImageComponentView] Setting stereo mode: %@", stereoMode);
    _stereoMode = stereoMode ?: @"none";
    
    // TODO: Apply stereo mode to ViroReact renderer
    // Modes: none, leftRight, rightLeft, topBottom, bottomTop
}

#pragma mark - Material Properties

- (void)setMaterials:(nullable NSArray<NSString *> *)materials
{
    RCTLogInfo(@"[ViroImageComponentView] Setting materials: %@", materials);
    _materials = materials;
    
    // TODO: Apply materials to ViroReact image
}

#pragma mark - Event Callbacks

- (void)setOnLoadStart:(nullable RCTBubblingEventBlock)onLoadStart
{
    _onLoadStart = onLoadStart;
}

- (void)setOnLoadEnd:(nullable RCTBubblingEventBlock)onLoadEnd
{
    _onLoadEnd = onLoadEnd;
}

- (void)setOnError:(nullable RCTBubblingEventBlock)onError
{
    _onError = onError;
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // TODO: Layout ViroReact image
    RCTLogInfo(@"[ViroImageComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
    
    // For 3D images, layout is handled by image dimensions and 3D transforms
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroImageComponentView] Image added to window");
        // TODO: Add image to ViroReact scene when added to window
        [self loadImageFromSource];
    } else {
        RCTLogInfo(@"[ViroImageComponentView] Image removed from window");
        // TODO: Remove image from ViroReact scene when removed from window
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroImageComponentView] Deallocating");
    // TODO: Clean up ViroReact image resources
}

@end

Class<RCTComponentViewProtocol> ViroImageCls(void)
{
    return ViroImageComponentView.class;
}