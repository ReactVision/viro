//
//  ViroSpotLightComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroSpotLightComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ViroKit/ViroKit.h>

@interface ViroSpotLightComponentView ()

// ViroReact Integration
@property (nonatomic, strong) std::shared_ptr<VROLight> vroLight;
@property (nonatomic, strong) std::shared_ptr<VRONode> vroNode;

// Light color and intensity
@property (nonatomic, strong, nullable) NSString *color;
@property (nonatomic, assign) CGFloat intensity;
@property (nonatomic, assign) CGFloat temperature;

// Light position and direction
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *position;
@property (nonatomic, strong, nullable) NSArray<NSNumber *> *direction;

// Spotlight cone properties
@property (nonatomic, assign) CGFloat innerAngle;
@property (nonatomic, assign) CGFloat outerAngle;

// Light attenuation
@property (nonatomic, assign) CGFloat attenuationStartDistance;
@property (nonatomic, assign) CGFloat attenuationEndDistance;

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

@implementation ViroSpotLightComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroSpotLightComponentDescriptor>();
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
    RCTLogInfo(@"[ViroSpotLightComponentView] Initializing");
    
    // Set default spot light values
    _color = @"#FFFFFF";
    _intensity = 1000.0; // Lumens
    _temperature = 6500.0; // Kelvin (daylight)
    _position = @[@0, @2, @0]; // Light source position (above origin)
    _direction = @[@0, @-1, @0]; // Pointing downward
    
    // Default spotlight cone settings
    _innerAngle = 30.0; // Degrees - full intensity cone
    _outerAngle = 45.0; // Degrees - falloff cone
    
    // Default attenuation settings
    _attenuationStartDistance = 2.0; // Distance where attenuation begins
    _attenuationEndDistance = 10.0; // Distance where light has no effect
    
    // Default shadow settings
    _castsShadow = YES;
    _shadowOpacity = 0.3;
    _shadowMapSize = 1024;
    _shadowBias = 0.001;
    _shadowNearZ = 1.0;
    _shadowFarZ = 100.0;
    
    _influenceBitMask = 1; // Default influence mask
    
    // Initialize ViroReact spot light integration
    [self initializeVROSpotLight];
    
    self.backgroundColor = [UIColor clearColor];
    self.clipsToBounds = NO; // Lights don't have visual bounds
}

#pragma mark - Light Color and Intensity

- (void)setColor:(nullable NSString *)color
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting color: %@", color);
    _color = color ?: @"#FFFFFF";
    
    if (_vroLight) {
        VROColor lightColor = VROColor::colorWithHexString([_color UTF8String]);
        _vroLight->setColor(lightColor);
    }
}

- (void)setIntensity:(CGFloat)intensity
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting intensity: %f", intensity);
    _intensity = intensity;
    
    if (_vroLight) {
        _vroLight->setIntensity(intensity);
    }
}

- (void)setTemperature:(CGFloat)temperature
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting temperature: %f", temperature);
    _temperature = temperature;
    
    if (_vroLight) {
        _vroLight->setTemperature(temperature);
    }
}

#pragma mark - Light Position and Direction

- (void)setPosition:(nullable NSArray<NSNumber *> *)position
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting position: %@", position);
    _position = position ?: @[@0, @2, @0];
    
    if (_vroLight && _position.count >= 3) {
        VROVector3f pos([_position[0] floatValue], [_position[1] floatValue], [_position[2] floatValue]);
        _vroLight->setPosition(pos);
    }
}

- (void)setDirection:(nullable NSArray<NSNumber *> *)direction
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting direction: %@", direction);
    _direction = direction ?: @[@0, @-1, @0];
    
    if (_vroLight && _direction.count >= 3) {
        VROVector3f dir([_direction[0] floatValue], [_direction[1] floatValue], [_direction[2] floatValue]);
        _vroLight->setDirection(dir);
    }
}

#pragma mark - Spotlight Cone Properties

- (void)setInnerAngle:(CGFloat)innerAngle
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting inner angle: %f", innerAngle);
    _innerAngle = innerAngle;
    
    if (_vroLight) {
        _vroLight->setSpotInnerAngle(innerAngle * M_PI / 180.0); // Convert degrees to radians
    }
}

- (void)setOuterAngle:(CGFloat)outerAngle
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting outer angle: %f", outerAngle);
    _outerAngle = outerAngle;
    
    if (_vroLight) {
        _vroLight->setSpotOuterAngle(outerAngle * M_PI / 180.0); // Convert degrees to radians
    }
}

#pragma mark - Light Attenuation

- (void)setAttenuationStartDistance:(CGFloat)attenuationStartDistance
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting attenuation start distance: %f", attenuationStartDistance);
    _attenuationStartDistance = attenuationStartDistance;
    
    if (_vroLight) {
        _vroLight->setAttenuationStartDistance(attenuationStartDistance);
    }
}

- (void)setAttenuationEndDistance:(CGFloat)attenuationEndDistance
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting attenuation end distance: %f", attenuationEndDistance);
    _attenuationEndDistance = attenuationEndDistance;
    
    if (_vroLight) {
        _vroLight->setAttenuationEndDistance(attenuationEndDistance);
    }
}

#pragma mark - Shadow Properties

- (void)setCastsShadow:(BOOL)castsShadow
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting casts shadow: %@", castsShadow ? @"YES" : @"NO");
    _castsShadow = castsShadow;
    
    if (_vroLight) {
        _vroLight->setCastsShadow(castsShadow);
    }
}

- (void)setShadowOpacity:(CGFloat)shadowOpacity
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting shadow opacity: %f", shadowOpacity);
    _shadowOpacity = shadowOpacity;
    
    if (_vroLight) {
        _vroLight->setShadowOpacity(shadowOpacity);
    }
}

- (void)setShadowMapSize:(NSInteger)shadowMapSize
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting shadow map size: %ld", (long)shadowMapSize);
    _shadowMapSize = shadowMapSize;
    
    if (_vroLight) {
        _vroLight->setShadowMapSize((int)shadowMapSize);
    }
}

- (void)setShadowBias:(CGFloat)shadowBias
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting shadow bias: %f", shadowBias);
    _shadowBias = shadowBias;
    
    if (_vroLight) {
        _vroLight->setShadowBias(shadowBias);
    }
}

- (void)setShadowNearZ:(CGFloat)shadowNearZ
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting shadow near Z: %f", shadowNearZ);
    _shadowNearZ = shadowNearZ;
    
    if (_vroLight) {
        _vroLight->setShadowNearZ(shadowNearZ);
    }
}

- (void)setShadowFarZ:(CGFloat)shadowFarZ
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting shadow far Z: %f", shadowFarZ);
    _shadowFarZ = shadowFarZ;
    
    if (_vroLight) {
        _vroLight->setShadowFarZ(shadowFarZ);
    }
}

#pragma mark - Light Influence

- (void)setInfluenceBitMask:(NSInteger)influenceBitMask
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Setting influence bit mask: %ld", (long)influenceBitMask);
    _influenceBitMask = influenceBitMask;
    
    if (_vroLight) {
        _vroLight->setInfluenceBitMask((int)influenceBitMask);
    }
}

#pragma mark - Light Update

- (void)updateSpotLight
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Updating spot light - Color: %@, Intensity: %.1f, Position: %@, Direction: %@, Angles: %.1f°-%.1f°, Shadows: %@", 
               _color, _intensity, _position, _direction, _innerAngle, _outerAngle, _castsShadow ? @"YES" : @"NO");
    
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
    
    if (_direction && _direction.count >= 3) {
        VROVector3f dir([_direction[0] floatValue], [_direction[1] floatValue], [_direction[2] floatValue]);
        _vroLight->setDirection(dir);
    }
    
    // Set spotlight cone angles (convert degrees to radians)
    _vroLight->setSpotInnerAngle(_innerAngle * M_PI / 180.0);
    _vroLight->setSpotOuterAngle(_outerAngle * M_PI / 180.0);
    
    _vroLight->setAttenuationStartDistance(_attenuationStartDistance);
    _vroLight->setAttenuationEndDistance(_attenuationEndDistance);
    
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

- (CGFloat)calculateConeAttenuationForAngle:(CGFloat)angle
{
    // Calculate light attenuation based on angle from spotlight direction
    if (angle <= _innerAngle) {
        return 1.0; // Full intensity within inner cone
    } else if (angle >= _outerAngle) {
        return 0.0; // No light beyond outer cone
    } else {
        // Smooth falloff between inner and outer cones
        CGFloat range = _outerAngle - _innerAngle;
        CGFloat relativeAngle = angle - _innerAngle;
        return 1.0 - (relativeAngle / range);
    }
}

#pragma mark - Layout

- (void)layoutSubviews
{
    [super layoutSubviews];
    
    // Spot lights don't have visual layout, but we can log for debugging
    RCTLogInfo(@"[ViroSpotLightComponentView] layoutSubviews: %@", NSStringFromCGRect(self.bounds));
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
    [super didMoveToWindow];
    
    if (self.window) {
        RCTLogInfo(@"[ViroSpotLightComponentView] Spot light added to window");
        [self updateSpotLight];
        // Parent ViroNodeComponentView will handle adding _vroNode to scene
    } else {
        RCTLogInfo(@"[ViroSpotLightComponentView] Spot light removed from window");
        // Parent ViroNodeComponentView will handle removing _vroNode from scene
    }
}

- (void)dealloc
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Deallocating");
    _vroLight = nullptr;
    _vroNode = nullptr;
}

#pragma mark - ViroReact Integration

- (void)initializeVROSpotLight
{
    RCTLogInfo(@"[ViroSpotLightComponentView] Creating VROLight (Spot)");
    
    // Create spot light
    _vroLight = std::make_shared<VROLight>(VROLightType::Spot);
    
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
    
    // Set direction
    if (_direction && _direction.count >= 3) {
        VROVector3f dir([_direction[0] floatValue], [_direction[1] floatValue], [_direction[2] floatValue]);
        _vroLight->setDirection(dir);
    }
    
    // Set spotlight cone angles (convert degrees to radians)
    _vroLight->setSpotInnerAngle(_innerAngle * M_PI / 180.0);
    _vroLight->setSpotOuterAngle(_outerAngle * M_PI / 180.0);
    
    // Set attenuation
    _vroLight->setAttenuationStartDistance(_attenuationStartDistance);
    _vroLight->setAttenuationEndDistance(_attenuationEndDistance);
    
    // Configure shadows
    _vroLight->setCastsShadow(_castsShadow);
    _vroLight->setShadowOpacity(_shadowOpacity);
    _vroLight->setShadowMapSize((int)_shadowMapSize);
    _vroLight->setShadowBias(_shadowBias);
    _vroLight->setShadowNearZ(_shadowNearZ);
    _vroLight->setShadowFarZ(_shadowFarZ);
    
    // Set influence mask
    _vroLight->setInfluenceBitMask((int)_influenceBitMask);
    
    // Create VRONode to hold the light
    _vroNode = std::make_shared<VRONode>();
    _vroNode->addLight(_vroLight);
    
    RCTLogInfo(@"[ViroSpotLightComponentView] VROLight created successfully");
}


@end

Class<RCTComponentViewProtocol> ViroSpotLightCls(void)
{
    return ViroSpotLightComponentView.class;
}