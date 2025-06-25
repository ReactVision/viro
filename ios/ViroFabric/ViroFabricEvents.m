//
//  ViroFabricEvents.m
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricEvents.h"

@implementation ViroFabricEvents

// Core interaction events
NSString * const ViroFabricEventOnHover = @"onHoverViro";
NSString * const ViroFabricEventOnClick = @"onClickViro";
NSString * const ViroFabricEventOnTouch = @"onTouchViro";
NSString * const ViroFabricEventOnSwipe = @"onSwipeViro";
NSString * const ViroFabricEventOnScroll = @"onScrollViro";
NSString * const ViroFabricEventOnDrag = @"onDragViro";
NSString * const ViroFabricEventOnFuse = @"onFuseViro";
NSString * const ViroFabricEventOnPinch = @"onPinchViro";
NSString * const ViroFabricEventOnRotate = @"onRotateViro";

// Animation events
NSString * const ViroFabricEventOnAnimationStart = @"onAnimationStartViro";
NSString * const ViroFabricEventOnAnimationFinish = @"onAnimationFinishViro";

// Loading events
NSString * const ViroFabricEventOnLoadStart = @"onLoadStartViro";
NSString * const ViroFabricEventOnLoadEnd = @"onLoadEndViro";
NSString * const ViroFabricEventOnError = @"onErrorViro";

// Video events
NSString * const ViroFabricEventOnUpdateTime = @"onUpdateTimeViro";
NSString * const ViroFabricEventOnBufferStart = @"onBufferStartViro";
NSString * const ViroFabricEventOnBufferEnd = @"onBufferEndViro";

// Physics events
NSString * const ViroFabricEventOnCollided = @"onCollisionViro";
NSString * const ViroFabricEventOnTransformDelegate = @"onNativeTransformDelegateViro";

// AR events
NSString * const ViroFabricEventOnTrackingUpdated = @"onTrackingUpdatedViro";
NSString * const ViroFabricEventOnAmbientLightUpdate = @"onAmbientLightUpdateViro";
NSString * const ViroFabricEventOnAnchorFound = @"onAnchorFoundViro";
NSString * const ViroFabricEventOnAnchorUpdated = @"onAnchorUpdatedViro";
NSString * const ViroFabricEventOnAnchorRemoved = @"onAnchorRemovedViro";
NSString * const ViroFabricEventOnCameraARHitTest = @"onCameraARHitTestViro";
NSString * const ViroFabricEventOnARPointCloudUpdate = @"onARPointCloudUpdateViro";
NSString * const ViroFabricEventOnCameraTransformUpdate = @"onCameraTransformUpdateViro";

// Portal events
NSString * const ViroFabricEventOnPortalEnter = @"onPortalEnterViro";
NSString * const ViroFabricEventOnPortalExit = @"onPortalExitViro";

// Platform events
NSString * const ViroFabricEventOnPlatformUpdate = @"onPlatformUpdateViro";
NSString * const ViroFabricEventOnControllerStatus = @"onControllerStatusViro";
NSString * const ViroFabricEventOnExitViro = @"onExitViro";

// Container-specific events
NSString * const ViroFabricEventOnInitialized = @"onInitialized";
NSString * const ViroFabricEventOnTrackingUpdatedFabric = @"onTrackingUpdated";
NSString * const ViroFabricEventOnCameraTransformUpdateFabric = @"onCameraTransformUpdate";

@end
