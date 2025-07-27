/**
 * ViroEvents
 *
 * Type definitions for Viro event handling.
 */

import { ViroPosition, ViroRotation } from "../ViroUtils";

// Click state types
export enum ViroClickStateTypes {
  CLICK_DOWN = 1,
  CLICK_UP = 2,
  CLICKED = 3,
}

export type ViroClickState =
  | ViroClickStateTypes.CLICK_DOWN
  | ViroClickStateTypes.CLICK_UP
  | ViroClickStateTypes.CLICKED;

// Pinch state types
export enum ViroPinchStateTypes {
  PINCH_START = 1,
  PINCH_MOVE = 2,
  PINCH_END = 3,
}

export type ViroPinchState =
  | ViroPinchStateTypes.PINCH_START
  | ViroPinchStateTypes.PINCH_MOVE
  | ViroPinchStateTypes.PINCH_END;

// Rotate state types
export enum ViroRotateStateTypes {
  ROTATE_START = 1,
  ROTATE_MOVE = 2,
  ROTATE_END = 3,
}

export type ViroRotateState =
  | ViroRotateStateTypes.ROTATE_START
  | ViroRotateStateTypes.ROTATE_MOVE
  | ViroRotateStateTypes.ROTATE_END;

// Basic event types
export type ViroSource = any;
export type Viro3DPoint = [number, number, number];

export type ViroClickEvent = {
  position: Viro3DPoint;
  source: ViroSource;
};

export type ViroClickStateEvent = {
  clickState: ViroClickState;
  position: Viro3DPoint;
  source: ViroSource;
};

export type ViroHoverEvent = {
  isHovering: boolean;
  position: Viro3DPoint;
  source: ViroSource;
};

export type ViroTouchEvent = {
  touchState: any;
  touchPos: Viro3DPoint;
  source: ViroSource;
};

export type ViroScrollEvent = {
  scrollPos: Viro3DPoint;
  source: ViroSource;
};

export type ViroSwipeEvent = {
  swipeState: any;
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

export type ViroRotateEvent = {
  rotateState: ViroRotateState;
  rotationFactor: number;
  source: ViroSource;
};

export type ViroDragEvent = {
  dragToPos: Viro3DPoint;
  source: ViroSource;
};

// AR specific event types
export type ViroAnchor = any;
export type ViroAnchorFoundMap = any;
export type ViroAnchorUpdatedMap = any;
export type ViroPlaneUpdatedMap = any;
export type ViroPlaneUpdatedEvent = any;
export type ViroARPlaneSizes = any;
export type ViroARHitTestResult = any;
export type ViroARPointCloud = any;

export type ViroARAnchorFoundEvent = {
  anchorFoundMap: ViroAnchorFoundMap;
  anchor: ViroAnchor;
};

export type ViroARAnchorUpdatedEvent = {
  anchorUpdatedMap: ViroAnchorUpdatedMap;
  anchor: ViroAnchor;
};

export type ViroARAnchorRemovedEvent = {
  anchor: ViroAnchor;
};

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

export type ViroARPointCloudUpdateEvent = {
  pointCloud: ViroARPointCloud;
};

// Tracking state constants
export enum ViroTrackingStateConstants {
  TRACKING_NORMAL = 0,
  TRACKING_LIMITED = 1,
  TRACKING_UNAVAILABLE = 2,
}

export enum ViroARTrackingReasonConstants {
  TRACKING_REASON_NONE = 0,
  TRACKING_REASON_EXCESSIVE_MOTION = 1,
  TRACKING_REASON_INSUFFICIENT_FEATURES = 2,
}

export type ViroTrackingState =
  | ViroTrackingStateConstants.TRACKING_NORMAL
  | ViroTrackingStateConstants.TRACKING_LIMITED
  | ViroTrackingStateConstants.TRACKING_UNAVAILABLE;

export type ViroTrackingReason =
  | ViroARTrackingReasonConstants.TRACKING_REASON_NONE
  | ViroARTrackingReasonConstants.TRACKING_REASON_EXCESSIVE_MOTION
  | ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_FEATURES;

export type ViroTrackingUpdatedEvent = {
  state: ViroTrackingState;
  reason: ViroTrackingReason;
};

// Recording constants
export enum ViroRecordingErrorConstants {
  RECORD_ERROR_NONE = 0,
  RECORD_ERROR_UNKNOWN = 1,
  RECORD_ERROR_NO_PERMISSION = 2,
  RECORD_ERROR_INITIALIZATION = 3,
  RECORD_ERROR_WRITE_TO_FILE = 4,
  RECORD_ERROR_ALREADY_RUNNING = 5,
  RECORD_ERROR_ALREADY_STOPPED = 6,
}

// Other event types
export type ViroErrorEvent = {
  error: Error;
};

export type ViroCollisionEvent = {
  viroTag: string;
  collidedPoint: Viro3DPoint;
  collidedNormal: Viro3DPoint;
};

export type ViroPlatformInfo = {
  platform: string;
  headset: string;
  controller: string;
};

export type ViroPlatformEvent = {
  platformInfoViro: ViroPlatformInfo;
};

export type ViroPlatformUpdateEvent = {
  platformInfoViro: ViroPlatformInfo;
};

export type ViroCameraTransform = {
  position: Viro3DPoint;
  rotation: ViroRotation;
  forward: Viro3DPoint;
  up: Viro3DPoint;
};

export type ViroCameraTransformEvent = {
  cameraTransform: number[];
};

export type ViroWorldOrigin = {
  position: Viro3DPoint;
  rotation: ViroRotation;
};

export type ViroNativeTransformUpdateEvent = {
  position: Viro3DPoint;
};

export type ViroControllerStatus = any;

export type ViroControllerStatusEvent = {
  controllerStatus: ViroControllerStatus;
  source: ViroSource;
};

export type ViroExitViroEvent = {};

// Animation events
export type ViroAnimationStartEvent = {};
export type ViroAnimationFinishEvent = {};

// Loading events
export type ViroLoadStartEvent = {};
export type ViroLoadEndEvent = {
  success: boolean;
};
export type ViroLoadErrorEvent = ViroErrorEvent;

// Video events
export type ViroVideoBufferStartEvent = {};
export type ViroVideoBufferEndEvent = {};
export type ViroVideoUpdateTimeEvent = {
  currentTime: number;
  totalTime: number;
};
export type ViroVideoErrorEvent = ViroErrorEvent;
export type ViroVideoFinishEvent = ViroErrorEvent;

// Animated component events
export type ViroAnimatedComponentStartEvent = {};
export type ViroAnimatedComponentFinishEvent = {};

// Portal events
export type ViroPortalEnterEvent = any;
export type ViroPortalExitEvent = any;

// Sound events
export type ViroSoundFinishEvent = any;

// Ambient light events
export type ViroAmbientLightInfo = {
  intensity: number;
  color: string;
};

export type ViroAmbientLightUpdateEvent = {
  ambientLightInfo: ViroAmbientLightInfo;
};

// AR support response
export type ViroARSupportResponse = {
  supported: boolean;
  reason?: string;
};
