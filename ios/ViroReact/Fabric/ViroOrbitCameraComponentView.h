//
//  ViroOrbitCameraComponentView.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import <SceneKit/SceneKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface ViroOrbitCameraComponentView : RCTViewComponentView

// Camera properties
@property (nonatomic, assign) SCNVector3 position;
@property (nonatomic, assign) SCNVector3 focalPoint;
@property (nonatomic, assign) BOOL active;
@property (nonatomic, assign) float fieldOfView;

// Orbit properties
@property (nonatomic, assign) float orbitRadius;
@property (nonatomic, assign) float orbitAngleHorizontal;
@property (nonatomic, assign) float orbitAngleVertical;
@property (nonatomic, assign) float orbitSpeed;

// Animation properties
@property (nonatomic, strong, nullable) NSDictionary *animation;

// Camera management
@property (nonatomic, strong, nullable) SCNCamera *scnCamera;
@property (nonatomic, strong, nullable) SCNNode *cameraNode;
@property (nonatomic, strong, nullable) SCNNode *targetNode;

// Camera controls
- (void)activateCamera;
- (void)deactivateCamera;
- (void)updateCameraPosition;
- (void)updateOrbitRadius:(float)radius;
- (void)updateOrbitAngles:(float)horizontal vertical:(float)vertical;
- (void)lookAtTarget;

// Animation methods
- (void)startOrbitAnimation;
- (void)stopOrbitAnimation;
- (void)pauseOrbitAnimation;
- (void)resumeOrbitAnimation;

@end

NS_ASSUME_NONNULL_END