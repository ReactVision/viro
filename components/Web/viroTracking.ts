/**
 * The web tracker's state and reason in native's constants, for
 * ViroARScene's and ViroARSceneNavigator's onTrackingUpdated.
 */
import { TrackingReason, ViroTrackingState } from "@reactvision/viro-web-renderer";
import { ViroARTrackingReasonConstants, ViroTrackingStateConstants } from "../ViroConstants";

export function trackingStateToConstant(state: ViroTrackingState): number {
  switch (state) {
    case ViroTrackingState.Normal:
      return ViroTrackingStateConstants.TRACKING_NORMAL;
    case ViroTrackingState.Limited:
      return ViroTrackingStateConstants.TRACKING_LIMITED;
    default:
      return ViroTrackingStateConstants.TRACKING_UNAVAILABLE;
  }
}

/**
 * tinyvio's other reasons (no gravity yet, too little parallax, a failed solve)
 * have no native constant; ARKit's initializing and ARCore's bad state report
 * NONE as well.
 */
export function trackingReasonToConstant(reason: TrackingReason | undefined): number {
  switch (reason) {
    case TrackingReason.ExcessiveMotion:
      return ViroARTrackingReasonConstants.TRACKING_REASON_EXCESSIVE_MOTION;
    case TrackingReason.InsufficientFeatures:
      return ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_FEATURES;
    case TrackingReason.InsufficientLight:
      return ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_LIGHT;
    default:
      return ViroARTrackingReasonConstants.TRACKING_REASON_NONE;
  }
}
