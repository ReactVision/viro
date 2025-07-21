//
//  ViroOmniLightComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroOmniLightComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>

@interface ViroOmniLightComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROLight> vroLight;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Light color and intensity
@property (nonatomic, strong, nullable) NSString *color;
@property (nonatomic, assign) CGFloat intensity;
@property (nonatomic, assign) CGFloat temperature;

// Light position
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *position;

// Light attenuation
@property (nonatomic, assign) CGFloat attenuationStartDistance;
@property (nonatomic, assign) CGFloat attenuationEndDistance;

// Light influence
@property (nonatomic, assign) NSInteger influenceBitMask;

@end

@implementation ViroOmniLightComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroOmniLightComponentDescriptor>();
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
    RCTLogInfo(@"[ViroOmniLightComponentView] Initializing");
    
    // Set default omni light values
    _color = @"#FFFFFF";
    _intensity = 1000.0; // Lumens
    _temperature = 6500.0; // Kelvin (daylight)
    _position = @[@0, @0, @0]; // Light source position
    
    // Default attenuation settings
    _attenuationStartDistance = 2.0; // Distance where attenuation begins
    _attenuationEndDistance = 10.0; // Distance where light has no effect
    
    _influenceBitMask = 1; // Default influence mask
    
    // Initialize ViroReact omni light
    [self initializeVROOmniLight];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Lights don't have visual bounds
}

#pragma mark - Light Color and Intensity

- (void)initializeVROOmniLight
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Creating VROLight (Omni)");
    
    // Create omni (point) light
    _vroLight = std::make_shared<VROLight>(VROLightType::Omni);
    
    // Set default properties
    VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
    _vroLight->setColor(lightColor);
    _vroLight->setIntensity(_intensity);
    _vroLight->setTemperature(_temperature);
    
    // Set position
    if (_position && _position.count >= 3) {
        VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
        _vroLight->setPosition(pos);
    }
    
    // Set attenuation
    _vroLight->setAttenuationStartDistance(_attenuationStartDistance);
    _vroLight->setAttenuationEndDistance(_attenuationEndDistance);
    
    // Set influence mask
    _vroLight->setInfluenceBitMask(_influenceBitMask);
    
    // Create VRONode to hold the light
    _vroNode = std::make_shared<VRONode>();
    _vroNode->addLight(_vroLight);
    
    RCTLogInfo(@"[ViroOmniLightComponentView] VROLight created successfully");
}

#pragma mark - Light Color and Intensity

- (void)setColor:(nullable NSString *)color
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Setting color: %@", color);
    _color = color ?: @"#FFFFFF";
    
    if (_vroLight) {
        VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
        _vroLight->setColor(lightColor);
    }
}

- (void)setIntensity:(CGFloat)intensity
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Setting intensity: %f", intensity);
    _intensity = intensity;
    
    if (_vroLight) {
        _vroLight->setIntensity(intensity);
    }
}

- (void)setTemperature:(CGFloat)temperature
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Setting temperature: %f", temperature);
    _temperature = temperature;
    
    if (_vroLight) {
        _vroLight->setTemperature(temperature);
    }
}

#pragma mark - Light Position

- (void)setPosition:(nullable NSArray<NSNumber *> *)position
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Setting position: %@", position);
    _position = position ?: @[@0, @0, @0];
    
    if (_vroLight && _position.count >= 3) {
        VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
        _vroLight->setPosition(pos);
    }
}

#pragma mark - Light Attenuation

- (void)setAttenuationStartDistance:(CGFloat)attenuationStartDistance
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Setting attenuation start distance: %f", attenuationStartDistance);
    _attenuationStartDistance = attenuationStartDistance;
    
    if (_vroLight) {
        _vroLight->setAttenuationStartDistance(attenuationStartDistance);
    }
}

- (void)setAttenuationEndDistance:(CGFloat)attenuationEndDistance
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Setting attenuation end distance: %f", attenuationEndDistance);
    _attenuationEndDistance = attenuationEndDistance;
    
    if (_vroLight) {
        _vroLight->setAttenuationEndDistance(attenuationEndDistance);
    }
}

#pragma mark - Light Influence

- (void)setInfluenceBitMask:(NSInteger)influenceBitMask
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Setting influence bit mask: %ld", (long)influenceBitMask);
    _influenceBitMask = influenceBitMask;
    
    if (_vroLight) {
        _vroLight->setInfluenceBitMask((int)influenceBitMask);
    }
}

#pragma mark - Light Update

- (void)updateOmniLight
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Updating omni light - Color: %@, Intensity: %.1f, Position: %@, Attenuation: %.1f-%.1f", 
               _color, _intensity, _position, _attenuationStartDistance, _attenuationEndDistance);
    
    if (!_vroLight) {
        return;
    }
    
    // Apply all current settings to the light
    VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
    _vroLight->setColor(lightColor);
    _vroLight->setIntensity(_intensity);
    _vroLight->setTemperature(_temperature);
    
    if (_position && _position.count >= 3) {
        VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
        _vroLight->setPosition(pos);
    }
    
    _vroLight->setAttenuationStartDistance(_attenuationStartDistance);
    _vroLight->setAttenuationEndDistance(_attenuationEndDistance);
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

- (CGFloat)calculateAttenuationAtDistance:(CGFloat)distance
{
    // Calculate light attenuation based on distance
    if (distance <= _attenuationStartDistance) {
        return 1.0; // Full intensity within start distance
    } else if (distance >= _attenuationEndDistance) {
        return 0.0; // No light beyond end distance
    } else {
        // Linear attenuation between start and end distances
        CGFloat range = _attenuationEndDistance - _attenuationStartDistance;
        CGFloat relativeDistance = distance - _attenuationStartDistance;
        return 1.0 - (relativeDistance / range);
    }
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // Omni lights don't have visual layout, but we can log for debugging
    RCTLogInfo(@"[ViroOmniLightComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroOmniLightComponentView] Omni light added to window");
        [self updateOmniLight];
        // Parent ViroNodeComponentView will handle adding _vroNode to scene
    } else {
        RCTLogInfo(@"[ViroOmniLightComponentView] Omni light removed from window");
        // Parent ViroNodeComponentView will handle removing _vroNode from scene
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroOmniLightComponentView] Deallocating");
    _vroLight = nullptr;
    _vroNode = nullptr;
}

@end

Class<RCTComponentViewProtocol> ViroOmniLightCls(void)
{
    return ViroOmniLightComponentView.class;
}