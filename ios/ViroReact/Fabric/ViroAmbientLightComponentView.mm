//
//  ViroAmbientLightComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroAmbientLightComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>

@interface ViroAmbientLightComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROLight> vroLight;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Light color and intensity
@property (nonatomic, strong, nullable) NSString *color;
@property (nonatomic, assign) CGFloat intensity;
@property (nonatomic, assign) CGFloat temperature;

// Light influence
@property (nonatomic, assign) NSInteger influenceBitMask;

@end

@implementation ViroAmbientLightComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroAmbientLightComponentDescriptor>();
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
    RCTLogInfo(@"[ViroAmbientLightComponentView] Initializing");
    
    // Set default light values
    _color = @"#FFFFFF";
    _intensity = 1000.0; // Lux
    _temperature = 6500.0; // Kelvin (daylight)
    _influenceBitMask = 1; // Default influence mask
    
    // Initialize ViroReact ambient light
    [self initializeVROAmbientLight];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Lights don't have visual bounds
}

#pragma mark - Light Color and Intensity

- (void)initializeVROAmbientLight
{
    RCTLogInfo(@"[ViroAmbientLightComponentView] Creating VROLight (Ambient)");
    
    // Create ambient light
    _vroLight = std::make_shared<VROLight>(VROLightType::Ambient);
    
    // Set default properties
    VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
    _vroLight->setColor(lightColor);
    _vroLight->setIntensity(_intensity);
    _vroLight->setTemperature(_temperature);
    
    // Set influence mask
    _vroLight->setInfluenceBitMask(_influenceBitMask);
    
    // Create VRONode to hold the light
    _vroNode = std::make_shared<VRONode>();
    _vroNode->addLight(_vroLight);
    
    RCTLogInfo(@"[ViroAmbientLightComponentView] VROLight created successfully");
}

#pragma mark - Light Color and Intensity

- (void)setColor:(nullable NSString *)color
{
    RCTLogInfo(@"[ViroAmbientLightComponentView] Setting color: %@", color);
    _color = color ?: @"#FFFFFF";
    
    if (_vroLight) {
        VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
        _vroLight->setColor(lightColor);
    }
}

- (void)setIntensity:(CGFloat)intensity
{
    RCTLogInfo(@"[ViroAmbientLightComponentView] Setting intensity: %f", intensity);
    _intensity = intensity;
    
    if (_vroLight) {
        _vroLight->setIntensity(intensity);
    }
}

- (void)setTemperature:(CGFloat)temperature
{
    RCTLogInfo(@"[ViroAmbientLightComponentView] Setting temperature: %f", temperature);
    _temperature = temperature;
    
    if (_vroLight) {
        _vroLight->setTemperature(temperature);
    }
}

#pragma mark - Light Influence

- (void)setInfluenceBitMask:(NSInteger)influenceBitMask
{
    RCTLogInfo(@"[ViroAmbientLightComponentView] Setting influence bit mask: %ld", (long)influenceBitMask);
    _influenceBitMask = influenceBitMask;
    
    if (_vroLight) {
        _vroLight->setInfluenceBitMask((int)influenceBitMask);
    }
}

#pragma mark - Light Update

- (void)updateAmbientLight
{
    RCTLogInfo(@"[ViroAmbientLightComponentView] Updating ambient light - Color: %@, Intensity: %.1f, Temperature: %.1f, Influence: %ld", 
               _color, _intensity, _temperature, (long)_influenceBitMask);
    
    if (!_vroLight) {
        return;
    }
    
    // Apply all current settings to the light
    VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
    _vroLight->setColor(lightColor);
    _vroLight->setIntensity(_intensity);
    _vroLight->setTemperature(_temperature);
    _vroLight->setInfluenceBitMask((int)_influenceBitMask);
}

#pragma mark - Helper Methods

- (UIColor *)colorFromHexString:(NSString *)hexString
{
    // Convert hex color string to UIColor
    NSString *cleanString = [hexString stringByReplacingOccurrencesOfString:@"#" withString:@""];
    if ([cleanString length] == 6) {
        unsigned int rgb;
        NSScanner *scanner = [NSScanner scannerWithString:cleanString];
        [scanner scanHexInt:&rgb];
        
        CGFloat red = ((rgb & 0xFF0000) >> 16) / 255.0;
        CGFloat green = ((rgb & 0x00FF00) >> 8) / 255.0;
        CGFloat blue = (rgb & 0x0000FF) / 255.0;
        
        return [UIColor colorWithRed:red green:green blue:blue alpha:1.0];
    }
    
    return [UIColor whiteColor]; // Default fallback
}

- (NSArray<NSNumber *> *)rgbComponentsFromColor:(UIColor *)color
{
    CGFloat red, green, blue, alpha;
    if ([color getRed:&red green:&green blue:&blue alpha:&alpha]) {
        return @[@(red), @(green), @(blue)];
    }
    
    return @[@1.0, @1.0, @1.0]; // Default white
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // Ambient lights don't have visual layout, but we can log for debugging
    RCTLogInfo(@"[ViroAmbientLightComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroAmbientLightComponentView] Ambient light added to window");
        [self updateAmbientLight];
        // Parent ViroNodeComponentView will handle adding _vroNode to scene
    } else {
        RCTLogInfo(@"[ViroAmbientLightComponentView] Ambient light removed from window");
        // Parent ViroNodeComponentView will handle removing _vroNode from scene
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroAmbientLightComponentView] Deallocating");
    _vroLight = nullptr;
    _vroNode = nullptr;
}

@end

Class<RCTComponentViewProtocol> ViroAmbientLightCls(void)
{
    return ViroAmbientLightComponentView.class;
}