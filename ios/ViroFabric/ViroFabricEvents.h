//
//  ViroFabricEvents.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <Foundation/Foundation.h>

/**
 * Event constants for the Viro Fabric interop layer.
 * These events are compatible with the existing ViroEvents but use the Fabric naming convention.
 */
@interface ViroFabricEvents : NSObject

// Core interaction events
extern NSString * const ViroFabricEventOnHover;
extern NSString * const ViroFabricEventOnClick;
extern NSString * const ViroFabricEventOnTouch;
extern NSString * const ViroFabricEventOnSwipe;
extern NSString * const ViroFabricEventOnScroll;
extern NSString * const ViroFabricEventOnDrag;
extern NSString * const ViroFabricEventOnFuse;
extern NSString * const ViroFabricEventOnPinch;
extern NSString * const ViroFabricEventOnRotate;

// Animation events
extern NSString * const ViroFabricEventOnAnimationStart;
extern NSString * const ViroFabricEventOnAnimationFinish;

// Loading events
extern NSString * const ViroFabricEventOnLoadStart;
extern NSString * const ViroFabricEventOnLoadEnd;
extern NSString * const ViroFabricEventOnError;

// Video events
extern NSString * const ViroFabricEventOnUpdateTime;
extern NSString * const ViroFabricEventOnBufferStart;
extern NSString * const ViroFabricEventOnBufferEnd;

// Physics events
extern NSString * const ViroFabricEventOnCollided;
extern NSString * const ViroFabricEventOnTransformDelegate;

// AR events
extern NSString * const ViroFabricEventOnTrackingUpdated;
extern NSString * const ViroFabricEventOnAmbientLightUpdate;
extern NSString * const ViroFabricEventOnAnchorFound;
extern NSString * const ViroFabricEventOnAnchorUpdated;
extern NSString * const ViroFabricEventOnAnchorRemoved;
extern NSString * const ViroFabricEventOnCameraARHitTest;
extern NSString * const ViroFabricEventOnARPointCloudUpdate;
extern NSString * const ViroFabricEventOnCameraTransformUpdate;

// Portal events
extern NSString * const ViroFabricEventOnPortalEnter;
extern NSString * const ViroFabricEventOnPortalExit;

// Platform events
extern NSString * const ViroFabricEventOnPlatformUpdate;
extern NSString * const ViroFabricEventOnControllerStatus;
extern NSString * const ViroFabricEventOnExitViro;

// Container-specific events
extern NSString * const ViroFabricEventOnInitialized;
extern NSString * const ViroFabricEventOnTrackingUpdatedFabric;
extern NSString * const ViroFabricEventOnCameraTransformUpdateFabric;

@end
