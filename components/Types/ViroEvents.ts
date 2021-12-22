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

import {
  ViroARTrackingReasonConstants,
  ViroTrackingStateConstants,
} from "../ViroConstants";
import { Viro3DPoint, ViroRotation, ViroSource } from "./ViroUtils";

export type ViroHoverEvent = {
  isHovering: boolean;
  position: Viro3DPoint;
  source: ViroSource;
};

export type ViroClickEvent = {
  position: Viro3DPoint;
  source: ViroSource;
};

export type ViroClickStateEvent = {
  clickState: ViroClickState;
  position: Viro3DPoint;
  source: ViroSource;
};

export type ViroClickState =
  | ViroClickStateTypes.CLICK_DOWN
  | ViroClickStateTypes.CLICK_UP
  | ViroClickStateTypes.CLICKED;

export enum ViroClickStateTypes {
  CLICK_DOWN = 1, // Click Down: Triggered when the user has performed a click down action while hovering on this control.|
  CLICK_UP = 2, // Click Up: Triggered when the user has performed a click up action while hovering on this control.|
  CLICKED = 3, // Clicked: Triggered when the user has performed both a click down and click up action on this control sequentially, thereby having "Clicked" the object.|
}

export type ViroTouchEvent = {
  touchState: any; // TODO: is there a better type for this?
  touchPos: Viro3DPoint;
  source: ViroSource;
};

export type ViroScrollEvent = {
  scrollPos: Viro3DPoint;
  source: ViroSource;
};

export type ViroSwipeEvent = {
  swipeState: any; // TODO: is there a better type for this?
  source: ViroSource;
};

export type ViroFuseEvent = {
  source: ViroSource;
};

export type ViroPinchEvent = {
  pinchState: ViroPinchState;
  scaleFactor: number;
  source: ViroSource;
};

export type ViroPinchState =
  | ViroPinchStateTypes.PINCH_START
  | ViroPinchStateTypes.PINCH_MOVE
  | ViroPinchStateTypes.PINCH_END;

export enum ViroPinchStateTypes {
  PINCH_START = 1, // Triggered when the user has started a pinch gesture.
  PINCH_MOVE = 2, // Triggered when the user has adjusted the pinch, moving both fingers.
  PINCH_END = 3, //  When the user has finishes the pinch gesture and released both touch points.
}

export type ViroRotateEvent = {
  rotateState: ViroRotateState;
  rotationFactor: number; // TODO: confirm this type is correct
  source: ViroSource;
};

export type ViroRotateState =
  | ViroRotateStateTypes.ROTATE_START
  | ViroRotateStateTypes.ROTATE_MOVE
  | ViroRotateStateTypes.ROTATE_END;

export enum ViroRotateStateTypes {
  ROTATE_START = 1, // Triggered when the user has started a rotation gesture.
  ROTATE_MOVE = 2, // Triggered when the user has adjusted the rotation, moving both fingers.
  ROTATE_END = 3, //  When the user has finishes the rotation gesture and released both touch points.
}

export type ViroDragEvent = {
  dragToPos: Viro3DPoint;
  source: ViroSource;
};

export type ViroPlatformEvent = {
  platformInfoViro: ViroPlatformInfo;
};

export type ViroCollisionEvent = {
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
export type ViroPlatformInfo = {
  platform: ViroPlatformTypes;
  /** @deprecated */
  vrPlatform: ViroPlatformTypes;
  headset: ViroHeadsetTypes;
  controller: ViroControllerTypes;
};

export enum ViroPlatformTypes {
  GVR = "gvr",
  GEAR_VR = "ovr-mobile",
}

export enum ViroHeadsetTypes {
  CARDBOARD = "cardboard",
  DAYDREAM = "daydream",
  GEARVR = "gearvr",
}

export enum ViroControllerTypes {
  CARDBOARD = "cardboard",
  DAYDREAM = "daydream",
  GEARVR = "gearvr",
}

export type ViroCameraTransformEvent = {
  cameraTransform: number[];
};

export type ViroPlatformUpdateEvent = {
  platformInfoViro: ViroPlatformInfo;
};

export type ViroCameraTransform = {
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

export type ViroExitViroEvent = {};

export type ViroErrorEvent = {
  error: Error;
};

/** ===========================================================================
 * Viro Animation Events
 * ============================================================================ */
export type ViroAnimationStartEvent = {};
export type ViroAnimationFinishEvent = {};

/** ===========================================================================
 * Viro Loading Events
 * ============================================================================ */
export type ViroLoadStartEvent = {};
export type ViroLoadEndEvent = {
  success: boolean;
};
export type ViroLoadErrorEvent = ViroErrorEvent;

/** ===========================================================================
 * Viro 360 Video Events
 * ============================================================================ */
export type ViroVideoBufferStartEvent = {};
export type ViroVideoBufferEndEvent = {};
export type ViroVideoUpdateTimeEvent = {
  currentTime: number;
  totalTime: number;
};
export type ViroVideoErrorEvent = ViroErrorEvent;
export type ViroVideoFinishEvent = ViroErrorEvent;

/** ===========================================================================
 * Viro Animated Component Events
 * ============================================================================ */
export type ViroAnimatedComponentStartEvent = {};
export type ViroAnimatedComponentFinishEvent = {};

/** ===========================================================================
 * Viro AR Anchor Events
 * ============================================================================ */
export type ViroARAnchorRemovedEvent = {
  anchor: ViroAnchor;
};
export type ViroARAnchorUpdatedEvent = {
  anchorUpdatedMap: ViroAnchorUpdatedMap;
  anchor: ViroAnchor;
};
export type ViroARAnchorFoundEvent = {
  anchorFoundMap: ViroAnchorFoundMap;
  anchor: ViroAnchor;
};
export type ViroAnchor = any;

export type ViroAnchorFoundMap = any;
export type ViroAnchorUpdatedMap = any;

/** ===========================================================================
 * Viro AR Plane Events
 * ============================================================================ */
export type ViroPlaneUpdatedMap = any;
export type ViroPlaneUpdatedEvent = any;
export type ViroARPlaneSizes = any;

/** ===========================================================================
 * Viro AR Hit Test
 * ============================================================================ */
export type ViroCameraARHitTestEvent = {
  hitTestResults: ViroARHitTestResult[];
  cameraOrientation: number[];
};
export type ViroCameraARHitTest = {
  hitTestResults: ViroARHitTestResult[];
  cameraOrientation: {
    position: Viro3DPoint;
    rotation: ViroRotation;
    forward: Viro3DPoint;
    up: Viro3DPoint;
  };
};

export type ViroARHitTestResult = any;

export type ViroARPointCloudUpdateEvent = {
  pointCloud: ViroARPointCloud;
};

export type ViroARPointCloud = any;

export type ViroTrackingUpdatedEvent = {
  state: ViroTrackingState;
  reason: ViroTrackingReason;
};

export type ViroTrackingState =
  | ViroTrackingStateConstants.TRACKING_NORMAL
  | ViroTrackingStateConstants.TRACKING_LIMITED
  | ViroTrackingStateConstants.TRACKING_UNAVAILABLE;

export type ViroTrackingReason =
  | ViroARTrackingReasonConstants.TRACKING_REASON_NONE
  | ViroARTrackingReasonConstants.TRACKING_REASON_EXCESSIVE_MOTION
  | ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_FEATURES;

export type ViroAmbientLightUpdateEvent = {
  ambientLightInfo: ViroAmbientLightInfo;
};

export type ViroAmbientLightInfo = {
  intensity: number; // TODO: This might not be right
  color: string;
};

export type ViroWorldOrigin = {
  position: Viro3DPoint;
  rotation: ViroRotation;
};

export type ViroNativeTransformUpdateEvent = {
  position: Viro3DPoint;
};

export type ViroControllerStatusEvent = {
  controllerStatus: ViroControllerStatus;
  source: ViroSource;
};

export type ViroControllerStatus = any;

/** ===========================================================================
 * Viro AR Portal Events
 * ============================================================================ */
export type ViroPortalEnterEvent = any;
export type ViroPortalExitEvent = any;

/** ===========================================================================
 * Viro Sound Events
 * ============================================================================ */
export type ViroSoundFinishEvent = any;
