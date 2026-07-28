/**
 * Web implementation of ViroARScene. Renders its children under the scene root
 * (provided by ViroARSceneNavigator.web) and bridges the AR session's plane
 * stream + tracking state to the declarative callbacks:
 *   - onTrackingUpdated       when the tracking state changes
 *   - onAnchorFound/Updated/Removed  as slam planes appear/move/disappear
 *
 * It also provides a claim registry so multiple auto-matching <ViroARPlane>s
 * don't bind to the same detected plane, and exposes performARHitTestWithPoint
 * via ref (ray-vs-plane in the session).
 *
 * MVP scope: plane anchors only (slam has no image/object anchors).
 */
import * as React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  ViroTrackingState,
  type ArPlaneAnchor,
  type ArHitResult,
} from "@reactvision/viro-web-renderer";
import {
  useViroAR,
  useViroRenderer,
  ViroARPlaneClaimsContext,
  type ViroARPlaneClaims,
} from "../Web/ViroWebContext";
import {
  ViroTrackingStateConstants,
  ViroARTrackingReasonConstants,
} from "../ViroConstants";

/** The declarative anchor shape passed to onAnchor* (mirrors ViroAnchor). */
export type ViroWebAnchor = {
  anchorId: string;
  type: "plane";
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  center: [number, number, number];
  width: number;
  height: number;
  alignment: ArPlaneAnchor["alignment"];
};

type Props = {
  onTrackingUpdated?: (state: number, reason: number) => void;
  onAnchorFound?: (anchor: ViroWebAnchor) => void;
  onAnchorUpdated?: (anchor: ViroWebAnchor) => void;
  onAnchorRemoved?: (anchor: ViroWebAnchor) => void;
  children?: React.ReactNode;
  [key: string]: any;
};

export type ViroARSceneHandle = {
  /** Ray-vs-plane hit test from a screen point (device pixels, top-left origin). */
  performARHitTestWithPoint: (x: number, y: number) => Promise<ArHitResult[]>;
};

export function anchorToViro(p: ArPlaneAnchor): ViroWebAnchor {
  return {
    anchorId: p.id,
    type: "plane",
    position: p.center,
    rotation: p.rotation,
    scale: [1, 1, 1],
    center: [0, 0, 0], // anchor origin sits at the plane center
    width: p.width,
    height: p.height,
    alignment: p.alignment,
  };
}

function trackingStateToConstant(state: ViroTrackingState): number {
  switch (state) {
    case ViroTrackingState.Normal:
      return ViroTrackingStateConstants.TRACKING_NORMAL;
    case ViroTrackingState.Limited:
      return ViroTrackingStateConstants.TRACKING_LIMITED;
    default:
      return ViroTrackingStateConstants.TRACKING_UNAVAILABLE;
  }
}

export const ViroARScene = forwardRef<ViroARSceneHandle, Props>(function ViroARScene(
  props,
  ref,
) {
  const { session, anchors, trackingState } = useViroAR();
  const renderer = useViroRenderer();

  // Read latest callbacks from a ref so effects don't re-run on identity change.
  const propsRef = useRef(props);
  propsRef.current = props;

  // Tracking state → onTrackingUpdated.
  useEffect(() => {
    propsRef.current.onTrackingUpdated?.(
      trackingStateToConstant(trackingState),
      ViroARTrackingReasonConstants.TRACKING_REASON_NONE,
    );
  }, [trackingState]);

  // Plane set diff → onAnchorFound / onAnchorUpdated / onAnchorRemoved.
  const knownRef = useRef<Map<string, ArPlaneAnchor>>(new Map());
  useEffect(() => {
    const known = knownRef.current;
    const next = new Map(anchors.map((a) => [a.id, a]));
    const p = propsRef.current;

    for (const a of anchors) {
      if (known.has(a.id)) p.onAnchorUpdated?.(anchorToViro(a));
      else p.onAnchorFound?.(anchorToViro(a));
    }
    for (const [id, a] of known) {
      if (!next.has(id)) p.onAnchorRemoved?.(anchorToViro(a));
    }
    knownRef.current = next;
  }, [anchors]);

  // Claim registry so auto-matching planes don't share an anchor.
  const claimsRef = useRef<Map<string, string>>(new Map());
  const claims = useRef<ViroARPlaneClaims>({
    claim(componentId, candidateIds) {
      const map = claimsRef.current;
      const current = map.get(componentId);
      if (current && candidateIds.includes(current)) return current;
      const taken = new Set(
        [...map.entries()].filter(([k]) => k !== componentId).map(([, v]) => v),
      );
      const pick = candidateIds.find((id) => !taken.has(id));
      if (pick) map.set(componentId, pick);
      else map.delete(componentId);
      return pick ?? null;
    },
    release(componentId) {
      claimsRef.current.delete(componentId);
    },
    claimed(componentId) {
      return claimsRef.current.get(componentId) ?? null;
    },
  }).current;

  useImperativeHandle(
    ref,
    () => ({
      performARHitTestWithPoint: async (x: number, y: number) => {
        if (!session) return [];
        const { width, height } = renderer.canvasSize;
        return session.hitTest(x, y, width, height);
      },
    }),
    [session, renderer],
  );

  return (
    <ViroARPlaneClaimsContext.Provider value={claims}>
      {props.children}
    </ViroARPlaneClaimsContext.Provider>
  );
});
