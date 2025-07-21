//
//  ViroLightingEnvironmentComponentView.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import <SceneKit/SceneKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, ViroLightingEnvironmentLoadingState) {
    ViroLightingEnvironmentLoadingStateNone,
    ViroLightingEnvironmentLoadingStateLoading,
    ViroLightingEnvironmentLoadingStateLoaded,
    ViroLightingEnvironmentLoadingStateError
};

@interface ViroLightingEnvironmentComponentView : RCTViewComponentView

// Lighting environment properties
@property (nonatomic, strong, nullable) NSDictionary *source;
@property (nonatomic, assign) float intensity;
@property (nonatomic, assign) float rotation;

// IBL (Image-Based Lighting) properties
@property (nonatomic, assign) BOOL enableImageBasedLighting;
@property (nonatomic, assign) float diffuseIntensity;
@property (nonatomic, assign) float specularIntensity;

// State management
@property (nonatomic, assign) ViroLightingEnvironmentLoadingState loadingState;
@property (nonatomic, strong, nullable) SCNMaterialProperty *lightingEnvironmentProperty;

// Event callbacks
@property (nonatomic, copy, nullable) RCTDirectEventBlock onLoadStart;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onLoadEnd;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onError;

// Loading methods
- (void)loadHDREnvironment;
- (void)loadEquirectangularEnvironment;
- (void)loadCubeMapEnvironment;

// Environment management
- (void)applyLightingEnvironment;
- (void)clearLightingEnvironment;

@end

NS_ASSUME_NONNULL_END