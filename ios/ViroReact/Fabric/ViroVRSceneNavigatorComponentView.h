//
//  ViroVRSceneNavigatorComponentView.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import <SceneKit/SceneKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface ViroVRSceneNavigatorComponentView : RCTViewComponentView

// VR-specific properties
@property (nonatomic, assign) BOOL vrModeEnabled;
@property (nonatomic, assign) BOOL autofocus;
@property (nonatomic, assign) BOOL debug;

// Scene navigation properties
@property (nonatomic, strong, nullable) NSString *initialSceneKey;
@property (nonatomic, assign) NSInteger currentSceneIndex;

// Renderer settings
@property (nonatomic, assign) BOOL hdrEnabled;
@property (nonatomic, assign) BOOL pbrEnabled;
@property (nonatomic, assign) BOOL bloomEnabled;
@property (nonatomic, assign) BOOL shadowsEnabled;
@property (nonatomic, assign) BOOL multisamplingEnabled;

// VR app properties
@property (nonatomic, strong, nullable) NSDictionary *viroAppProps;

// Event callbacks
@property (nonatomic, copy, nullable) RCTDirectEventBlock onExitViro;
@property (nonatomic, assign) BOOL hasOnExitViroCallback;

// VR scene management
@property (nonatomic, strong, nullable) SCNView *vrSceneView;
@property (nonatomic, strong, nullable) SCNScene *vrScene;
@property (nonatomic, strong, nullable) SCNCamera *vrCamera;
@property (nonatomic, strong, nullable) SCNNode *vrCameraNode;

// VR mode management
- (void)enableVRMode;
- (void)disableVRMode;
- (void)updateVRSettings;
- (void)configureVRRenderer;

// Scene navigation
- (void)navigateToSceneAtIndex:(NSInteger)index;
- (void)updateCurrentScene;

// VR utilities
- (void)recenterVRTracking;
- (SCNVector3)projectPoint:(SCNVector3)point;
- (SCNVector3)unprojectPoint:(SCNVector3)point;

@end

NS_ASSUME_NONNULL_END