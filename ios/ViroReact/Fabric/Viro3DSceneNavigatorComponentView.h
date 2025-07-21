//
//  Viro3DSceneNavigatorComponentView.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import <SceneKit/SceneKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface Viro3DSceneNavigatorComponentView : RCTViewComponentView

// 3D scene navigation properties
@property (nonatomic, assign) BOOL debug;
@property (nonatomic, strong, nullable) NSString *initialSceneKey;
@property (nonatomic, assign) NSInteger currentSceneIndex;

// Renderer settings
@property (nonatomic, assign) BOOL hdrEnabled;
@property (nonatomic, assign) BOOL pbrEnabled;
@property (nonatomic, assign) BOOL bloomEnabled;
@property (nonatomic, assign) BOOL shadowsEnabled;
@property (nonatomic, assign) BOOL multisamplingEnabled;

// 3D app properties
@property (nonatomic, strong, nullable) NSDictionary *viroAppProps;

// Event callbacks
@property (nonatomic, copy, nullable) RCTDirectEventBlock onExitViro;
@property (nonatomic, assign) BOOL hasOnExitViroCallback;

// 3D scene management
@property (nonatomic, strong, nullable) SCNView *sceneView;
@property (nonatomic, strong, nullable) SCNScene *scene;
@property (nonatomic, strong, nullable) SCNCamera *camera;
@property (nonatomic, strong, nullable) SCNNode *cameraNode;

// 3D mode management
- (void)configure3DRenderer;
- (void)update3DSettings;

// Scene navigation
- (void)navigateToSceneAtIndex:(NSInteger)index;
- (void)updateCurrentScene;

// 3D utilities
- (void)recenter3DTracking;
- (SCNVector3)projectPoint:(SCNVector3)point;
- (SCNVector3)unprojectPoint:(SCNVector3)point;

@end

NS_ASSUME_NONNULL_END