//
//  ViroDirectionalLightComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroDirectionalLightComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>

@interface ViroDirectionalLightComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROLight> vroLight;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Light color and intensity
@property (nonatomic, strong, nullable) NSString *color;
@property (nonatomic, assign) CGFloat intensity;
@property (nonatomic, assign) CGFloat temperature;

// Light direction
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *direction;

// Shadow properties
@property (nonatomic, assign) BOOL castsShadow;
@property (nonatomic, assign) CGFloat shadowOpacity;
@property (nonatomic, assign) NSInteger shadowMapSize;
@property (nonatomic, assign) CGFloat shadowBias;
@property (nonatomic, assign) CGFloat shadowNearZ;
@property (nonatomic, assign) CGFloat shadowFarZ;

// Light influence
@property (nonatomic, assign) NSInteger influenceBitMask;

@end

@implementation ViroDirectionalLightComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroDirectionalLightComponentDescriptor>();
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
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Initializing");
    
    // Set default directional light values
    _color = @"#FFFFFF";
    _intensity = 1000.0; // Lux
    _temperature = 6500.0; // Kelvin (daylight)
    _direction = @[@0, @-1, @0]; // Pointing downward (like sunlight)
    
    // Default shadow settings
    _castsShadow = YES;
    _shadowOpacity = 0.3;
    _shadowMapSize = 1024;
    _shadowBias = 0.001;
    _shadowNearZ = 1.0;
    _shadowFarZ = 100.0;
    
    _influenceBitMask = 1; // Default influence mask
    
    // Initialize ViroReact directional light
    [self initializeVRODirectionalLight];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Lights don't have visual bounds
}

- (void)initializeVRODirectionalLight
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Creating VROLight (Directional)");
    
    // Create directional light
    _vroLight = std::make_shared<VROLight>(VROLightType::Directional);
    
    // Set default properties
    VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
    _vroLight->setColor(lightColor);
    _vroLight->setIntensity(_intensity);
    _vroLight->setTemperature(_temperature);
    
    // Set direction
    if (_direction && _direction.count >= 3) {
        VROVector3f dir([_direction[0] floatValue], [_direction[1] floatValue], [_direction[2] floatValue]);
        _vroLight->setDirection(dir);
    }
    
    // Configure shadows
    _vroLight->setCastsShadow(_castsShadow);
    _vroLight->setShadowOpacity(_shadowOpacity);
    _vroLight->setShadowMapSize(_shadowMapSize);
    _vroLight->setShadowBias(_shadowBias);
    _vroLight->setShadowNearZ(_shadowNearZ);
    _vroLight->setShadowFarZ(_shadowFarZ);
    
    // Set influence mask
    _vroLight->setInfluenceBitMask(_influenceBitMask);
    
    // Create VRONode to hold the light
    _vroNode = std::make_shared<VRONode>();
    _vroNode->addLight(_vroLight);
    
    RCTLogInfo(@"[ViroDirectionalLightComponentView] VROLight created successfully");
}

#pragma mark - Light Color and Intensity

- (void)setColor:(nullable NSString *)color
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting color: %@", color);
    _color = color ?: @"#FFFFFF";
    
    if (_vroLight) {
        VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
        _vroLight->setColor(lightColor);
    }
}

- (void)setIntensity:(CGFloat)intensity
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting intensity: %f", intensity);
    _intensity = intensity;
    
    if (_vroLight) {
        _vroLight->setIntensity(intensity);
    }
}

- (void)setTemperature:(CGFloat)temperature
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting temperature: %f", temperature);
    _temperature = temperature;
    
    if (_vroLight) {
        _vroLight->setTemperature(temperature);
    }
}

#pragma mark - Light Direction

- (void)setDirection:(nullable NSArray<NSNumber *> *)direction
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting direction: %@", direction);
    _direction = direction ?: @[@0, @-1, @0];
    
    if (_vroLight && _direction.count >= 3) {
        VROVector3f dir([_direction[0] floatValue], [_direction[1] floatValue], [_direction[2] floatValue]);
        _vroLight->setDirection(dir);
    }
}

#pragma mark - Shadow Properties

- (void)setCastsShadow:(BOOL)castsShadow
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting casts shadow: %@", castsShadow ? @"YES" : @"NO");
    _castsShadow = castsShadow;
    
    if (_vroLight) {
        _vroLight->setCastsShadow(castsShadow);
    }
}

- (void)setShadowOpacity:(CGFloat)shadowOpacity
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting shadow opacity: %f", shadowOpacity);
    _shadowOpacity = shadowOpacity;
    
    if (_vroLight) {
        _vroLight->setShadowOpacity(shadowOpacity);
    }
}

- (void)setShadowMapSize:(NSInteger)shadowMapSize
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting shadow map size: %ld", (long)shadowMapSize);
    _shadowMapSize = shadowMapSize;
    
    if (_vroLight) {
        _vroLight->setShadowMapSize((int)shadowMapSize);
    }
}

- (void)setShadowBias:(CGFloat)shadowBias
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting shadow bias: %f", shadowBias);
    _shadowBias = shadowBias;
    
    if (_vroLight) {
        _vroLight->setShadowBias(shadowBias);
    }
}

- (void)setShadowNearZ:(CGFloat)shadowNearZ
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting shadow near Z: %f", shadowNearZ);
    _shadowNearZ = shadowNearZ;
    
    if (_vroLight) {
        _vroLight->setShadowNearZ(shadowNearZ);
    }
}

- (void)setShadowFarZ:(CGFloat)shadowFarZ
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting shadow far Z: %f", shadowFarZ);
    _shadowFarZ = shadowFarZ;
    
    if (_vroLight) {
        _vroLight->setShadowFarZ(shadowFarZ);
    }
}

#pragma mark - Light Influence

- (void)setInfluenceBitMask:(NSInteger)influenceBitMask
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Setting influence bit mask: %ld", (long)influenceBitMask);
    _influenceBitMask = influenceBitMask;
    
    if (_vroLight) {
        _vroLight->setInfluenceBitMask((int)influenceBitMask);
    }
}

#pragma mark - Light Update

- (void)updateDirectionalLight
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Updating directional light - Color: %@, Intensity: %.1f, Direction: %@, Shadows: %@", 
               _color, _intensity, _direction, _castsShadow ? @"YES" : @"NO");
    
    if (!_vroLight) {
        return;
    }
    
    // Apply all current settings to the light
    VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
    _vroLight->setColor(lightColor);
    _vroLight->setIntensity(_intensity);
    _vroLight->setTemperature(_temperature);
    
    if (_direction && _direction.count >= 3) {
        VROVector3f dir([_direction[0] floatValue], [_direction[1] floatValue], [_direction[2] floatValue]);
        _vroLight->setDirection(dir);
    }
    
    _vroLight->setCastsShadow(_castsShadow);
    _vroLight->setShadowOpacity(_shadowOpacity);
    _vroLight->setShadowMapSize((int)_shadowMapSize);
    _vroLight->setShadowBias(_shadowBias);
    _vroLight->setShadowNearZ(_shadowNearZ);
    _vroLight->setShadowFarZ(_shadowFarZ);
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

- (NSArray<NSNumber *> *)normalizedDirection
{
    // Ensure direction vector is normalized
    if (_direction.count >= 3) {
        CGFloat x = [_direction[0] doubleValue];
        CGFloat y = [_direction[1] doubleValue];
        CGFloat z = [_direction[2] doubleValue];
        
        CGFloat length = sqrt(x*x + y*y + z*z);
        if (length > 0) {
            return @[@(x/length), @(y/length), @(z/length)];
        }
    }
    
    return @[@0, @-1, @0]; // Default downward direction
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // Directional lights don't have visual layout, but we can log for debugging
    RCTLogInfo(@"[ViroDirectionalLightComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroDirectionalLightComponentView] Directional light added to window");
        [self updateDirectionalLight];
        // Parent ViroNodeComponentView will handle adding _vroNode to scene
    } else {
        RCTLogInfo(@"[ViroDirectionalLightComponentView] Directional light removed from window");
        // Parent ViroNodeComponentView will handle removing _vroNode from scene
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroDirectionalLightComponentView] Deallocating");
    _vroLight = nullptr;
    _vroNode = nullptr;
}

@end

Class<RCTComponentViewProtocol> ViroDirectionalLightCls(void)
{
    return ViroDirectionalLightComponentView.class;
}