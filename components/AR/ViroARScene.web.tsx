/**
 * Web implementation of ViroARScene. Renders its children under the scene root
 * (provided by ViroARSceneNavigator.web) and bridges the AR session's plane
 * stream + tracking state to the declarative callbacks:
 *   - onTrackingUpdated       when the tracking state changes
 *   - onAnchorFound/Updated/Removed  as slam planes appear/move/disappear
 *
 * It also provides a claim registry so multiple auto-matching <ViroARPlane>s
 * don't bind to the same detected plane, and exposes performARHitTestWithPoint
 * via ref: ray-vs-plane in the session, or against the virtual camera's planes
 * within their extent when there is no session. onCameraARHitTest runs the same
 * test from the middle of the view every frame.
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
import { useViroToneMapping } from "../Web/useViroToneMapping";
import { useViroPhysicsWorld, type ViroPhysicsWorldProp } from "../Web/useViroPhysicsWorld";
import { cameraView, rayAt } from "../Web/viroDrag";
import { hitTestPlanes, toViroHit, type ViroPlaneHit } from "../Web/viroPlaneHitTest";
import { cameraBasis } from "../Web/viroMath";
import { quatToEuler } from "../Studio/colocation/frameMath";
import type { ViroCameraARHitTest } from "../Types/ViroEvents";

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
  onCameraARHitTest?: (event: ViroCameraARHitTest) => void;
  /** Off drops Hable's curve without dropping PBR — see useViroToneMapping. */
  toneMappingEnabled?: boolean;
  physicsWorld?: ViroPhysicsWorldProp;
  children?: React.ReactNode;
  [key: string]: any;
};

export type ViroARSceneHandle = {
  /** Ray-vs-plane hit test from a screen point (device pixels, top-left origin). */
  performARHitTestWithPoint: (x: number, y: number) => Promise<ViroPlaneHit[]>;
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
  useViroToneMapping(props.toneMappingEnabled);
  useViroPhysicsWorld(props.physicsWorld);

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

  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const hitAt = (x: number, y: number): ViroPlaneHit[] => {
    const { width, height } = renderer.canvasSize;
    if (session) {
      return session.hitTest(x, y, width, height).map((h) => toViroHit(h, anchorsRef.current.find((a) => a.id === h.anchorId), false));
    }
    const view = cameraView(renderer.scene);
    if (!view || !width || !height) return [];
    const rect = view.element.getBoundingClientRect();
    const ray = rayAt(view, rect.left + (x * rect.width) / width, rect.top + (y * rect.height) / height);
    return hitTestPlanes(ray, anchorsRef.current);
  };
  const hitAtRef = useRef(hitAt);
  hitAtRef.current = hitAt;

  useImperativeHandle(
    ref,
    () => ({
      performARHitTestWithPoint: async (x: number, y: number) => hitAtRef.current(x, y),
    }),
    [],
  );

  const wantsCameraHits = !!props.onCameraARHitTest;
  useEffect(() => {
    if (!wantsCameraHits) return;
    let frame = requestAnimationFrame(function tick() {
      frame = requestAnimationFrame(tick);
      const view = session ? null : cameraView(renderer.scene);
      const pose = session ? session.cameraPose : view && { position: view.position, quaternion: view.orientation };
      if (!pose) return;
      const { width, height } = renderer.canvasSize;
      const { forward, up } = cameraBasis(pose.quaternion);
      propsRef.current.onCameraARHitTest?.({
        hitTestResults: hitAtRef.current(width / 2, height / 2),
        cameraOrientation: { position: [...pose.position], rotation: quatToEuler(pose.quaternion), forward, up },
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [wantsCameraHits, session, renderer]);

  return (
    <ViroARPlaneClaimsContext.Provider value={claims}>
      {props.children}
    </ViroARPlaneClaimsContext.Provider>
  );
});
