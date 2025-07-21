//
//  ViroLightingEnvironmentComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroLightingEnvironmentComponentView.h"

#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <React/UIView+React.h>

#import <react/renderer/components/ViroReactSpec/ComponentDescriptors.h>
#import <react/renderer/components/ViroReactSpec/EventEmitters.h>
#import <react/renderer/components/ViroReactSpec/Props.h>
#import <react/renderer/components/ViroReactSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface ViroLightingEnvironmentComponentView () <RCTViroLightingEnvironmentViewProtocol>
@end

@implementation ViroLightingEnvironmentComponentView {
    SCNScene *_scene;
    NSString *_currentSourceURI;
    NSURLSessionDataTask *_loadingTask;
    BOOL _needsEnvironmentUpdate;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<ViroLightingEnvironmentComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ViroLightingEnvironmentProps>();
        _props = defaultProps;
        
        [self initializeViroLightingEnvironment];
    }
    
    return self;
}

- (void)initializeViroLightingEnvironment
{
    NSLog(@"Initializing ViroLightingEnvironmentComponentView");
    
    // Initialize default values
    _intensity = 1.0f;
    _rotation = 0.0f;
    _enableImageBasedLighting = YES;
    _diffuseIntensity = 1.0f;
    _specularIntensity = 1.0f;
    _loadingState = ViroLightingEnvironmentLoadingStateNone;
    _needsEnvironmentUpdate = NO;
    
    // Set up default lighting environment property
    _lightingEnvironmentProperty = [SCNMaterialProperty materialProperty];
    _lightingEnvironmentProperty.intensity = _intensity;
    
    // TODO: Get reference to ViroReact scene to apply lighting environment
    // This will need to integrate with the existing ViroReact scene system
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<ViroLightingEnvironmentProps const>(oldProps);
    const auto &newViewProps = *std::static_pointer_cast<ViroLightingEnvironmentProps const>(props);
    
    // Handle source changes
    if (oldViewProps.source != newViewProps.source) {
        NSLog(@"ViroLightingEnvironment source changed");
        // TODO: Handle source update
        _needsEnvironmentUpdate = YES;
    }
    
    // Handle intensity changes
    if (oldViewProps.intensity != newViewProps.intensity) {
        _intensity = newViewProps.intensity;
        NSLog(@"ViroLightingEnvironment intensity: %.2f", _intensity);
        if (_lightingEnvironmentProperty) {
            _lightingEnvironmentProperty.intensity = _intensity;
        }
        _needsEnvironmentUpdate = YES;
    }
    
    // Handle rotation changes
    if (oldViewProps.rotation != newViewProps.rotation) {
        _rotation = newViewProps.rotation;
        NSLog(@"ViroLightingEnvironment rotation: %.2f", _rotation);
        _needsEnvironmentUpdate = YES;
    }
    
    // Apply updates if needed
    if (_needsEnvironmentUpdate) {
        [self applyLightingEnvironment];
        _needsEnvironmentUpdate = NO;
    }
    
    [super updateProps:props oldProps:oldProps];
}

- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter
{
    [super updateEventEmitter:eventEmitter];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
    // Handle lighting environment specific commands
    NSLog(@"ViroLightingEnvironment received command: %@", commandName);
}

#pragma mark - Source Management

- (void)setSource:(NSDictionary *)source
{
    if ([_source isEqualToDictionary:source]) {
        return;
    }
    
    _source = source;
    NSLog(@"Setting ViroLightingEnvironment source: %@", source);
    
    // Cancel any existing loading task
    if (_loadingTask) {
        [_loadingTask cancel];
        _loadingTask = nil;
    }
    
    if (!source) {
        [self clearLightingEnvironment];
        return;
    }
    
    // Determine source type and load accordingly
    NSString *uri = source[@"uri"];
    if (uri) {
        _currentSourceURI = uri;
        
        // Determine file type by extension
        NSString *lowercaseURI = [uri lowercaseString];
        if ([lowercaseURI hasSuffix:@".hdr"] || [lowercaseURI hasSuffix:@".exr"]) {
            [self loadHDREnvironment];
        } else if ([lowercaseURI hasSuffix:@".jpg"] || [lowercaseURI hasSuffix:@".png"]) {
            [self loadEquirectangularEnvironment];
        } else {
            // Try to load as HDR by default
            [self loadHDREnvironment];
        }
    }
}

#pragma mark - Loading Methods

- (void)loadHDREnvironment
{
    NSLog(@"Loading HDR environment from: %@", _currentSourceURI);
    
    _loadingState = ViroLightingEnvironmentLoadingStateLoading;
    
    // Emit load start event
    if (_onLoadStart) {
        _onLoadStart(@{});
    }
    
    NSURL *url = [NSURL URLWithString:_currentSourceURI];
    if (!url) {
        [self handleLoadError:@"Invalid HDR environment URL"];
        return;
    }
    
    // Load HDR environment asynchronously
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSError *error;
        NSData *data = [NSData dataWithContentsOfURL:url options:0 error:&error];
        
        dispatch_async(dispatch_get_main_queue(), ^{
            if (error || !data) {
                [self handleLoadError:error.localizedDescription ?: @"Failed to load HDR data"];
                return;
            }
            
            // Create material property from HDR data
            self->_lightingEnvironmentProperty.contents = data;
            self->_lightingEnvironmentProperty.intensity = self->_intensity;
            
            self->_loadingState = ViroLightingEnvironmentLoadingStateLoaded;
            
            // Apply the lighting environment
            [self applyLightingEnvironment];
            
            // Emit load end event
            if (self->_onLoadEnd) {
                self->_onLoadEnd(@{@"success": @YES});
            }
        });
    });
}

- (void)loadEquirectangularEnvironment
{
    NSLog(@"Loading equirectangular environment from: %@", _currentSourceURI);
    
    _loadingState = ViroLightingEnvironmentLoadingStateLoading;
    
    // Emit load start event
    if (_onLoadStart) {
        _onLoadStart(@{});
    }
    
    NSURL *url = [NSURL URLWithString:_currentSourceURI];
    if (!url) {
        [self handleLoadError:@"Invalid equirectangular environment URL"];
        return;
    }
    
    // Load image asynchronously
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        UIImage *image = [UIImage imageWithData:[NSData dataWithContentsOfURL:url]];
        
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!image) {
                [self handleLoadError:@"Failed to load equirectangular image"];
                return;
            }
            
            // Create material property from image
            self->_lightingEnvironmentProperty.contents = image;
            self->_lightingEnvironmentProperty.intensity = self->_intensity;
            
            self->_loadingState = ViroLightingEnvironmentLoadingStateLoaded;
            
            // Apply the lighting environment
            [self applyLightingEnvironment];
            
            // Emit load end event
            if (self->_onLoadEnd) {
                self->_onLoadEnd(@{@"success": @YES});
            }
        });
    });
}

- (void)loadCubeMapEnvironment
{
    NSLog(@"Loading cube map environment");
    
    // TODO: Implement cube map loading
    // This would involve loading 6 separate images for the cube faces
    
    [self handleLoadError:@"Cube map environments not yet implemented"];
}

#pragma mark - Environment Management

- (void)applyLightingEnvironment
{
    if (!_lightingEnvironmentProperty || _loadingState != ViroLightingEnvironmentLoadingStateLoaded) {
        return;
    }
    
    NSLog(@"Applying lighting environment with intensity: %.2f, rotation: %.2f", _intensity, _rotation);
    
    // TODO: Apply lighting environment to ViroReact scene
    // This will need to integrate with the existing ViroReact scene system
    // For now, we'll just configure the material property
    
    _lightingEnvironmentProperty.intensity = _intensity;
    
    // Apply rotation if specified
    if (_rotation != 0.0f) {
        // Create rotation transform
        CATransform3D transform = CATransform3DMakeRotation(_rotation * M_PI / 180.0f, 0, 1, 0);
        _lightingEnvironmentProperty.contentsTransform = transform;
    }
    
    // Configure IBL settings
    if (_enableImageBasedLighting) {
        // TODO: Configure image-based lighting with diffuse and specular intensities
        NSLog(@"IBL enabled - diffuse: %.2f, specular: %.2f", _diffuseIntensity, _specularIntensity);
    }
}

- (void)clearLightingEnvironment
{
    NSLog(@"Clearing lighting environment");
    
    _lightingEnvironmentProperty.contents = nil;
    _loadingState = ViroLightingEnvironmentLoadingStateNone;
    
    // TODO: Remove lighting environment from ViroReact scene
}

#pragma mark - Error Handling

- (void)handleLoadError:(NSString *)errorMessage
{
    NSLog(@"ViroLightingEnvironment load error: %@", errorMessage);
    
    _loadingState = ViroLightingEnvironmentLoadingStateError;
    
    // Emit error event
    if (_onError) {
        _onError(@{
            @"error": errorMessage ?: @"Unknown lighting environment loading error"
        });
    }
}

#pragma mark - Lifecycle

- (void)prepareForRecycle
{
    [super prepareForRecycle];
    
    // Cancel any loading tasks
    if (_loadingTask) {
        [_loadingTask cancel];
        _loadingTask = nil;
    }
    
    // Clear lighting environment
    [self clearLightingEnvironment];
    
    // Reset properties
    _source = nil;
    _currentSourceURI = nil;
    _intensity = 1.0f;
    _rotation = 0.0f;
    _enableImageBasedLighting = YES;
    _diffuseIntensity = 1.0f;
    _specularIntensity = 1.0f;
    _loadingState = ViroLightingEnvironmentLoadingStateNone;
}

@end

Class<RCTComponentViewProtocol> ViroLightingEnvironmentCls(void)
{
    return ViroLightingEnvironmentComponentView.class;
}