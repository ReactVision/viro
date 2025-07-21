//
//  ViroControllerComponentView.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import <SceneKit/SceneKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, ViroControllerStatus) {
    ViroControllerStatusConnected,
    ViroControllerStatusDisconnected,
    ViroControllerStatusError
};

typedef NS_ENUM(NSInteger, ViroControllerType) {
    ViroControllerTypeGearVR,
    ViroControllerTypeOculusGo,
    ViroControllerTypeOculusTouch,
    ViroControllerTypeCardboard,
    ViroControllerTypeGeneric
};

@interface ViroControllerComponentView : RCTViewComponentView

// Controller properties
@property (nonatomic, assign) BOOL reticleVisibility;
@property (nonatomic, assign) BOOL controllerVisibility;

// Input capabilities
@property (nonatomic, assign) BOOL canClick;
@property (nonatomic, assign) BOOL canTouch;
@property (nonatomic, assign) BOOL canScroll;
@property (nonatomic, assign) BOOL canSwipe;
@property (nonatomic, assign) BOOL canDrag;
@property (nonatomic, assign) BOOL canPinch;
@property (nonatomic, assign) BOOL canRotate;
@property (nonatomic, assign) BOOL canFuse;
@property (nonatomic, assign) BOOL canGetControllerStatus;

// Fuse properties
@property (nonatomic, assign) float timeToFuse;

// Controller state
@property (nonatomic, assign) ViroControllerStatus controllerStatus;
@property (nonatomic, assign) ViroControllerType controllerType;
@property (nonatomic, strong) SCNVector3 controllerPosition;
@property (nonatomic, strong) SCNVector4 controllerRotation;
@property (nonatomic, strong) SCNVector3 controllerForward;

// Event callbacks
@property (nonatomic, copy, nullable) RCTDirectEventBlock onClickViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onTouchViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onScrollViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onSwipeViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onDragViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onPinchViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onRotateViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onFuseViro;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onControllerStatusViro;

// Controller management
- (void)startController;
- (void)stopController;
- (void)updateControllerVisibility;
- (void)updateReticleVisibility;

// Input handling
- (void)handleControllerInput:(NSDictionary *)inputData;
- (void)handleTouchInput:(CGPoint)touchPoint state:(NSString *)state;
- (void)handleScrollInput:(CGPoint)scrollDelta;
- (void)handleSwipeInput:(NSString *)direction;
- (void)handleDragInput:(SCNVector3)dragPosition;
- (void)handlePinchInput:(float)scaleFactor state:(NSString *)state;
- (void)handleRotateInput:(float)rotationFactor state:(NSString *)state;
- (void)handleFuseInput;

// Status management
- (void)updateControllerStatus:(ViroControllerStatus)status;
- (NSString *)getControllerStatusString:(ViroControllerStatus)status;
- (SCNVector3)getControllerForward;

@end

NS_ASSUME_NONNULL_END