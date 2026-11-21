/**
 * ViroARScene.web's tracking reasons and anchorDetectionTypes, in native's terms.
 */
// Jest maps the renderer to sceneApi.js, which does not carry TrackingReason
// (arSession.js does not parse under jest): the renderer's values.
jest.mock("@reactvision/viro-web-renderer", () => ({
  ...jest.requireActual("../../viro-web-renderer/dist/sceneApi.js"),
  TrackingReason: {
    None: 0,
    NoGravity: 1,
    InsufficientParallax: 2,
    InsufficientFeatures: 3,
    InsufficientLight: 4,
    ExcessiveMotion: 5,
    PoseSolveFailed: 6,
  },
}));

import { TrackingReason, ViroTrackingState, type ArPlaneAnchor } from "@reactvision/viro-web-renderer";
import { detectsPlane } from "../components/AR/ViroARScene.web";
import { ViroARTrackingReasonConstants as R, ViroTrackingStateConstants as S } from "../components/ViroConstants";
import { trackingReasonToConstant, trackingStateToConstant } from "../components/Web/viroTracking";

const plane = (alignment: ArPlaneAnchor["alignment"]) => ({ alignment }) as ArPlaneAnchor;

describe("tracking reasons", () => {
  it("maps the tracker's reasons that native has, and the rest to NONE", () => {
    expect(trackingReasonToConstant(TrackingReason.ExcessiveMotion)).toBe(R.TRACKING_REASON_EXCESSIVE_MOTION);
    expect(trackingReasonToConstant(TrackingReason.InsufficientFeatures)).toBe(R.TRACKING_REASON_INSUFFICIENT_FEATURES);
    expect(trackingReasonToConstant(TrackingReason.InsufficientLight)).toBe(R.TRACKING_REASON_INSUFFICIENT_LIGHT);
    for (const r of [TrackingReason.None, TrackingReason.NoGravity, TrackingReason.InsufficientParallax, TrackingReason.PoseSolveFailed, undefined]) {
      expect(trackingReasonToConstant(r)).toBe(R.TRACKING_REASON_NONE);
    }
  });

  it("maps the tracking states", () => {
    expect(trackingStateToConstant(ViroTrackingState.Normal)).toBe(S.TRACKING_NORMAL);
    expect(trackingStateToConstant(ViroTrackingState.Limited)).toBe(S.TRACKING_LIMITED);
    expect(trackingStateToConstant(ViroTrackingState.Unavailable)).toBe(S.TRACKING_UNAVAILABLE);
  });
});

describe("anchorDetectionTypes", () => {
  it("detects both kinds by default", () => {
    expect(detectsPlane(undefined, plane("HorizontalUpward"))).toBe(true);
    expect(detectsPlane(undefined, plane("Vertical"))).toBe(true);
  });

  it("takes one type as a string or a list, in any case", () => {
    expect(detectsPlane("planesVertical", plane("Vertical"))).toBe(true);
    expect(detectsPlane("planesVertical", plane("HorizontalDownward"))).toBe(false);
    expect(detectsPlane(["PLANESHORIZONTAL"], plane("Horizontal"))).toBe(true);
  });

  it("detects nothing for an empty list or unknown names, as on iOS", () => {
    expect(detectsPlane([], plane("HorizontalUpward"))).toBe(false);
    expect(detectsPlane(["images"], plane("Vertical"))).toBe(false);
  });
});
