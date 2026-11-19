/**
 * Web implementation of ViroARScene. Renders its children under the scene root
 * (provided by ViroARSceneNavigator.web) and bridges the AR session's plane
 * stream + tracking state to the declarative callbacks:
 *   - onTrackingUpdated       when the tracking state or its reason changes
 *   - onAnchorFound/Updated/Removed  as slam planes appear/move/disappear
 *
 * It also provides a claim registry so multiple auto-matching <ViroARPlane>s
 * don't bind to the same detected plane, and exposes native's hit tests and
 * camera reads via ref: against the session's planes, or the virtual camera's
 * when there is no session. onCameraARHitTest runs the point test from the
 * middle of the view every frame.
 *
 * MVP scope: plane anchors only (slam has no image/object anchors).
 */
import * as React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { type ArPlaneAnchor } from "@reactvision/viro-web-renderer";
import {
  useViroAR,
  useViroRenderer,
  ViroARContext,
  ViroARPlaneClaimsContext,
  type ViroARPlaneClaims,
} from "../Web/ViroWebContext";
import { ViroTrackingStateConstants } from "../ViroConstants";
import { trackingReasonToConstant, trackingStateToConstant } from "../Web/viroTracking";
import { useViroToneMapping } from "../Web/useViroToneMapping";
import {
  collisionQueries,
  useViroPhysicsWorld,
  type ViroCollisionQueries,
  type ViroPhysicsWorldProp,
} from "../Web/useViroPhysicsWorld";
import { useViroSceneEvents } from "../Web/useViroNode";
import { useViroLightEstimate, type ViroWebAmbientLight } from "../Web/viroLightEstimate";
import { cameraView, rayAt } from "../Web/viroDrag";
import { hitTestPlanes, planeHitResult, type ViroPlaneHit } from "../Web/viroHitTest";
import {
  cameraOrientation,
  cameraOrientationAsync,
  useViroCameraTransform,
  type ViroWebCameraOrientation,
  type ViroWebCameraTransform,
} from "../Web/viroCameraTransform";
import { cameraBasis, quatToEulerDegrees, type Quat, type Vec3 } from "../Web/viroMath";
import type { ViroCameraARHitTest } from "../Types/ViroEvents";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

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
  /** @deprecated on native too; fires once, the first time tracking is Limited or Normal. */
  onTrackingInitialized?: () => void;
  onPlatformUpdate?: (info: { platform: string; headset: string; controller: string }) => void;
  /** "planesHorizontal" and/or "planesVertical"; default both. */
  anchorDetectionTypes?: string[] | string;
  onAnchorFound?: (anchor: ViroWebAnchor) => void;
  onAnchorUpdated?: (anchor: ViroWebAnchor) => void;
  onAnchorRemoved?: (anchor: ViroWebAnchor) => void;
  onCameraARHitTest?: (event: ViroCameraARHitTest) => void;
  /** Estimated from the camera feed a few times a second; see viroLightEstimate. */
  onAmbientLightUpdate?: (light: ViroWebAmbientLight) => void;
  onCameraTransformUpdate?: (transform: ViroWebCameraTransform) => void;
  /** Off drops Hable's curve without dropping PBR — see useViroToneMapping. */
  toneMappingEnabled?: boolean;
  physicsWorld?: ViroPhysicsWorldProp;
  children?: React.ReactNode;
  [key: string]: any;
};

export type ViroARSceneHandle = {
  /** From a screen point in the canvas's device pixels, top-left origin. */
  performARHitTestWithPoint: (x: number, y: number) => Promise<ViroPlaneHit[]>;
  /** Along a direction from the camera. */
  performARHitTestWithRay: (ray: Vec3) => Promise<ViroPlaneHit[]>;
  /** Between two world points. */
  performARHitTestWithWorldPoints: (origin: Vec3, destination: Vec3) => Promise<ViroPlaneHit[]>;
  /** From the camera toward a world point. */
  performARHitTestWithPosition: (position: Vec3) => Promise<ViroPlaneHit[]>;
  getCameraOrientationAsync: () => Promise<ViroWebCameraOrientation>;
  getCameraPositionAsync: () => Promise<Vec3>;
} & ViroCollisionQueries;

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

/** Native's anchorDetectionTypes as a plane filter; unknown names detect nothing, as on iOS. */
export function detectsPlane(types: string[] | string | undefined, plane: ArPlaneAnchor): boolean {
  const list = typeof types === "string" ? [types] : types ?? ["planesHorizontal", "planesVertical"];
  const wanted = plane.alignment === "Vertical" ? "planesvertical" : "planeshorizontal";
  return list.some((t) => t.toLowerCase() === wanted);
}

export const ViroARScene = forwardRef<ViroARSceneHandle, Props>(function ViroARScene(
  props,
  ref,
) {
  const ar = useViroAR();
  const { session, trackingState, trackingReason } = ar;
  const renderer = useViroRenderer();
  useViroToneMapping(props.toneMappingEnabled);
  useViroPhysicsWorld(props.physicsWorld);
  useViroLightEstimate(session, props.onAmbientLightUpdate);
  useViroCameraTransform(props.onCameraTransformUpdate);
  useViroSceneEvents(props);

  // Read latest callbacks from a ref so effects don't re-run on identity change.
  const propsRef = useRef(props);
  propsRef.current = props;

  // Tracking state → onTrackingUpdated, and onTrackingInitialized the first
  // time it is Limited or Normal (native's rule).
  const state = trackingStateToConstant(trackingState);
  const reason = trackingReasonToConstant(trackingReason);
  const initializedRef = useRef(false);
  useEffect(() => {
    propsRef.current.onTrackingUpdated?.(state, reason);
    if (!initializedRef.current && state !== ViroTrackingStateConstants.TRACKING_UNAVAILABLE) {
      initializedRef.current = true;
      propsRef.current.onTrackingInitialized?.();
    }
  }, [state, reason]);

  // What iOS reports for an AR view; Android's AR navigator sends nothing.
  const wantsPlatform = !!props.onPlatformUpdate;
  useEffect(() => {
    if (wantsPlatform) propsRef.current.onPlatformUpdate?.({ platform: "ar", headset: "mobile", controller: "screen" });
  }, [wantsPlatform]);

  // Native's detection types decide which planes the session finds at all, so
  // children and hit tests see the filtered set too.
  const detectionKey = JSON.stringify(props.anchorDetectionTypes ?? null);
  const detects = useMemo(() => {
    const types = props.anchorDetectionTypes;
    return (plane: ArPlaneAnchor) => detectsPlane(types, plane);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionKey]);
  const anchors = useMemo(() => ar.anchors.filter(detects), [ar.anchors, detects]);
  const filteredAR = useMemo(() => ({ ...ar, anchors }), [ar, anchors]);

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
  const planes = () => (session ? session.getPlanes().filter(detects) : anchorsRef.current);
  const hitAt = (x: number, y: number): ViroPlaneHit[] => {
    const { width, height } = renderer.canvasSize;
    if (session) {
      const byId = new Map(planes().map((p) => [p.id, p]));
      return session.hitTest(x, y, width, height).flatMap((hit) => {
        const plane = byId.get(hit.anchorId);
        return plane ? [{ ...planeHitResult(plane, hit.position, hit.distance), ...hit }] : [];
      });
    }
    const view = cameraView(renderer.scene);
    if (!view || !width || !height) return [];
    const rect = view.element.getBoundingClientRect();
    const ray = rayAt(view, rect.left + (x * rect.width) / width, rect.top + (y * rect.height) / height);
    return hitTestPlanes(anchorsRef.current, ray.origin, ray.dir);
  };
  // A session's pose even under a ViroCamera, whose view the web cannot read in AR.
  const cameraNow = (): ViroWebCameraOrientation | null => {
    if (!session) return cameraOrientation(renderer.scene);
    const q = session.cameraPose.quaternion as Quat;
    return { position: [...session.cameraPose.position] as Vec3, rotation: quatToEulerDegrees(q), ...cameraBasis(q) };
  };
  const fromCamera = (toward: (camera: Vec3) => Vec3): ViroPlaneHit[] => {
    const camera = cameraNow()?.position;
    return camera ? hitTestPlanes(planes(), camera, toward(camera)) : [];
  };
  const hitsRef = useRef({ hitAt, fromCamera, planes, cameraNow });
  hitsRef.current = { hitAt, fromCamera, planes, cameraNow };

  useImperativeHandle(
    ref,
    () => ({
      performARHitTestWithPoint: async (x: number, y: number) => hitsRef.current.hitAt(x, y),
      performARHitTestWithRay: async (ray: Vec3) => hitsRef.current.fromCamera(() => ray),
      performARHitTestWithWorldPoints: async (origin: Vec3, destination: Vec3) => {
        const dir: Vec3 = [destination[0] - origin[0], destination[1] - origin[1], destination[2] - origin[2]];
        return hitTestPlanes(hitsRef.current.planes(), origin, dir, Math.hypot(...dir));
      },
      performARHitTestWithPosition: async (position: Vec3) =>
        hitsRef.current.fromCamera((c) => [position[0] - c[0], position[1] - c[1], position[2] - c[2]]),
      getCameraOrientationAsync: () => cameraOrientationAsync(renderer.scene),
      getCameraPositionAsync: async () => (await cameraOrientationAsync(renderer.scene)).position,
      ...collisionQueries(renderer.scene),
      // Null is what native resolves when the anchor cannot be made.
      createAnchoredNode: async () => {
        warnUnsupported(
          "ViroARScene.createAnchoredNode",
          "the web",
          "The web tracker cannot anchor to a hit result; place content at the hit result's position instead.",
        );
        return null;
      },
    }),
    [renderer],
  );

  const wantsCameraHits = !!props.onCameraARHitTest;
  useEffect(() => {
    if (!wantsCameraHits) return;
    let frame = requestAnimationFrame(function tick() {
      frame = requestAnimationFrame(tick);
      const camera = hitsRef.current.cameraNow();
      if (!camera) return;
      const { width, height } = renderer.canvasSize;
      propsRef.current.onCameraARHitTest?.({
        hitTestResults: hitsRef.current.hitAt(width / 2, height / 2),
        cameraOrientation: camera,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [wantsCameraHits, renderer]);

  return (
    <ViroARContext.Provider value={filteredAR}>
      <ViroARPlaneClaimsContext.Provider value={claims}>
        {props.children}
      </ViroARPlaneClaimsContext.Provider>
    </ViroARContext.Provider>
  );
});
