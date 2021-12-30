/**
 * Copyright (c) 2021-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * To do
 * - source types
 * - clickState types
 */
import { ViroARTrackingReasonConstants, ViroTrackingStateConstants } from "../ViroConstants";
import { Viro3DPoint, ViroRotation, ViroSource } from "./ViroUtils";
export declare type ViroHoverEvent = {
    isHovering: boolean;
    position: Viro3DPoint;
    source: ViroSource;
};
export declare type ViroClickEvent = {
    position: Viro3DPoint;
    source: ViroSource;
};
export declare type ViroClickStateEvent = {
    clickState: ViroClickState;
    position: Viro3DPoint;
    source: ViroSource;
};
export declare type ViroClickState = ViroClickStateTypes.CLICK_DOWN | ViroClickStateTypes.CLICK_UP | ViroClickStateTypes.CLICKED;
export declare enum ViroClickStateTypes {
    CLICK_DOWN = 1,
    CLICK_UP = 2,
    CLICKED = 3
}
export declare type ViroTouchEvent = {
    touchState: any;
    touchPos: Viro3DPoint;
    source: ViroSource;
};
export declare type ViroScrollEvent = {
    scrollPos: Viro3DPoint;
    source: ViroSource;
};
export declare type ViroSwipeEvent = {
    swipeState: any;
    source: ViroSource;
};
export declare type ViroFuseEvent = {
    source: ViroSource;
};
export declare type ViroPinchEvent = {
    pinchState: ViroPinchState;
    scaleFactor: number;
    source: ViroSource;
};
export declare type ViroPinchState = ViroPinchStateTypes.PINCH_START | ViroPinchStateTypes.PINCH_MOVE | ViroPinchStateTypes.PINCH_END;
export declare enum ViroPinchStateTypes {
    PINCH_START = 1,
    PINCH_MOVE = 2,
    PINCH_END = 3
}
export declare type ViroRotateEvent = {
    rotateState: ViroRotateState;
    rotationFactor: number;
    source: ViroSource;
};
export declare type ViroRotateState = ViroRotateStateTypes.ROTATE_START | ViroRotateStateTypes.ROTATE_MOVE | ViroRotateStateTypes.ROTATE_END;
export declare enum ViroRotateStateTypes {
    ROTATE_START = 1,
    ROTATE_MOVE = 2,
    ROTATE_END = 3
}
export declare type ViroDragEvent = {
    dragToPos: Viro3DPoint;
    source: ViroSource;
};
export declare type ViroPlatformEvent = {
    platformInfoViro: ViroPlatformInfo;
};
export declare type ViroCollisionEvent = {
    viroTag: string;
    collidedPoint: Viro3DPoint;
    collidedNormal: Viro3DPoint;
};
/**
 * Platform information for the current device.
 *
 * | |iOS Cardboard|Android Cardboard| Daydream | GearVR
 * |-------------------|---------------|---------------|---------------|---------------|
 * |Platform|gvr|gvr|gvr|ovr-mobile|
 * |Headset|cardboard|cardboard|daydream|gearvr|
 * |Controller|cardboard|cardboard|daydream|gearvr|
 */
export declare type ViroPlatformInfo = {
    platform: ViroPlatformTypes;
    /** @deprecated */
    vrPlatform: ViroPlatformTypes;
    headset: ViroHeadsetTypes;
    controller: ViroControllerTypes;
};
export declare enum ViroPlatformTypes {
    GVR = "gvr",
    GEAR_VR = "ovr-mobile"
}
export declare enum ViroHeadsetTypes {
    CARDBOARD = "cardboard",
    DAYDREAM = "daydream",
    GEARVR = "gearvr"
}
export declare enum ViroControllerTypes {
    CARDBOARD = "cardboard",
    DAYDREAM = "daydream",
    GEARVR = "gearvr"
}
export declare type ViroCameraTransformEvent = {
    cameraTransform: number[];
};
export declare type ViroPlatformUpdateEvent = {
    platformInfoViro: ViroPlatformInfo;
};
export declare type ViroCameraTransform = {
    /** @deprecated The cameraTransform key will be deprecated in a future release */
    cameraTransform: {
        position: Viro3DPoint;
        rotation: ViroRotation;
        forward: Viro3DPoint;
        up: Viro3DPoint;
    };
    position: Viro3DPoint;
    rotation: ViroRotation;
    forward: Viro3DPoint;
    up: Viro3DPoint;
};
export declare type ViroExitViroEvent = {};
export declare type ViroErrorEvent = {
    error: Error;
};
/** ===========================================================================
 * Viro Animation Events
 * ============================================================================ */
export declare type ViroAnimationStartEvent = {};
export declare type ViroAnimationFinishEvent = {};
/** ===========================================================================
 * Viro Loading Events
 * ============================================================================ */
export declare type ViroLoadStartEvent = {};
export declare type ViroLoadEndEvent = {
    success: boolean;
};
export declare type ViroLoadErrorEvent = ViroErrorEvent;
/** ===========================================================================
 * Viro 360 Video Events
 * ============================================================================ */
export declare type ViroVideoBufferStartEvent = {};
export declare type ViroVideoBufferEndEvent = {};
export declare type ViroVideoUpdateTimeEvent = {
    currentTime: number;
    totalTime: number;
};
export declare type ViroVideoErrorEvent = ViroErrorEvent;
export declare type ViroVideoFinishEvent = ViroErrorEvent;
/** ===========================================================================
 * Viro Animated Component Events
 * ============================================================================ */
export declare type ViroAnimatedComponentStartEvent = {};
export declare type ViroAnimatedComponentFinishEvent = {};
/** ===========================================================================
 * Viro AR Anchor Events
 * ============================================================================ */
export declare type ViroARAnchorRemovedEvent = {
    anchor: ViroAnchor;
};
export declare type ViroARAnchorUpdatedEvent = {
    anchorUpdatedMap: ViroAnchorUpdatedMap;
    anchor: ViroAnchor;
};
export declare type ViroARAnchorFoundEvent = {
    anchorFoundMap: ViroAnchorFoundMap;
    anchor: ViroAnchor;
};
export declare type ViroAnchor = any;
export declare type ViroAnchorFoundMap = any;
export declare type ViroAnchorUpdatedMap = any;
/** ===========================================================================
 * Viro AR Plane Events
 * ============================================================================ */
export declare type ViroPlaneUpdatedMap = any;
export declare type ViroPlaneUpdatedEvent = any;
export declare type ViroARPlaneSizes = any;
/** ===========================================================================
 * Viro AR Hit Test
 * ============================================================================ */
export declare type ViroCameraARHitTestEvent = {
    hitTestResults: ViroARHitTestResult[];
    cameraOrientation: number[];
};
export declare type ViroCameraARHitTest = {
    hitTestResults: ViroARHitTestResult[];
    cameraOrientation: {
        position: Viro3DPoint;
        rotation: ViroRotation;
        forward: Viro3DPoint;
        up: Viro3DPoint;
    };
};
export declare type ViroARHitTestResult = any;
export declare type ViroARPointCloudUpdateEvent = {
    pointCloud: ViroARPointCloud;
};
export declare type ViroARPointCloud = any;
export declare type ViroTrackingUpdatedEvent = {
    state: ViroTrackingState;
    reason: ViroTrackingReason;
};
export declare type ViroTrackingState = ViroTrackingStateConstants.TRACKING_NORMAL | ViroTrackingStateConstants.TRACKING_LIMITED | ViroTrackingStateConstants.TRACKING_UNAVAILABLE;
export declare type ViroTrackingReason = ViroARTrackingReasonConstants.TRACKING_REASON_NONE | ViroARTrackingReasonConstants.TRACKING_REASON_EXCESSIVE_MOTION | ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_FEATURES;
export declare type ViroAmbientLightUpdateEvent = {
    ambientLightInfo: ViroAmbientLightInfo;
};
export declare type ViroAmbientLightInfo = {
    intensity: number;
    color: string;
};
export declare type ViroWorldOrigin = {
    position: Viro3DPoint;
    rotation: ViroRotation;
};
export declare type ViroNativeTransformUpdateEvent = {
    position: Viro3DPoint;
};
export declare type ViroControllerStatusEvent = {
    controllerStatus: ViroControllerStatus;
    source: ViroSource;
};
export declare type ViroControllerStatus = any;
/** ===========================================================================
 * Viro AR Portal Events
 * ============================================================================ */
export declare type ViroPortalEnterEvent = any;
export declare type ViroPortalExitEvent = any;
/** ===========================================================================
 * Viro Sound Events
 * ============================================================================ */
export declare type ViroSoundFinishEvent = any;
