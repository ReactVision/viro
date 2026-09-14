/**
 * Web host for Studio scenes. Mirrors StudioARScene (native) but adapted to the
 * web renderer: it reuses the entire shared runtime (domain/ — scheduler, stores,
 * sound manager, sceneNavigationHandler, viroNodeFactory) and mounts the nodes
 * with the `.web` Viro components.
 *
 * Web adaptations vs native:
 *  - Root is ViroARScene (AR via slam) in `mode="ar"`, else ViroScene (3D).
 *  - AUTOMATIC/MANUAL plane detection → wrap plane assets in ViroARPlane (slam).
 *    (MANUAL degrades to auto-match; there is no web plane-selector UI yet.)
 *  - Tap-to-place runs off the AR session's hit test rather than a native one,
 *    and the navigator supplies the tap surface.
 *  - Dropped (no web equivalent): Quest/ViroController, image-triggered assets
 *    (ViroARImageMarker), native physics, drag, collisions, and the gaze and
 *    proximity bindings. `webCapabilities` reports all of them through
 *    `onUnsupported` so the caller can warn.
 *  - apiRequestExecutor + navigate are injected (no native VRTStudioModule).
 */
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ViroAmbientLight } from "../ViroAmbientLight.web";
import { ViroDirectionalLight } from "../ViroDirectionalLight.web";
import { ViroARPlane } from "../AR/ViroARPlane.web";
import { ViroARScene, type ViroARSceneHandle } from "../AR/ViroARScene.web";
import { useViroAR } from "../Web/ViroWebContext";
import { cameraBasis } from "../Web/viroMath";
import { ViroScene } from "../ViroScene.web";
import { ViroText } from "../ViroText.web";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { createNode } from "./domain/viroNodeFactory";
import { studioAssetPosition } from "./domain/assetPosition";
import {
  executeOnLoadFunction,
  SequenceScheduler,
  type SequenceRuntimeContext,
} from "./domain/sceneNavigationHandler";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioVisibilityStore } from "./domain/visibilityStore";
import { StudioPlacementStore, isTapToPlaceAsset } from "./domain/placementStore";
import { StudioSoundManager } from "./domain/soundManager";
import { StudioSounds } from "./domain/StudioSounds";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import { webUnsupportedFeatures, usesPlaneWrapper } from "./domain/webCapabilities";
import {
  evaluateProximityBindings,
  type ProximityRuntimeState,
} from "./domain/proximityBindingsRuntime";
import {
  STUDIO_AMBIENT_INTENSITY,
  STUDIO_DIRECTIONAL_DIRECTION,
  STUDIO_DIRECTIONAL_INTENSITY,
} from "./domain/studioLighting";
import type {
  StudioAnimation,
  StudioSceneResponse,
  ViroAnimationProp,
} from "./types";

type AnimOverride = { key: string; run: boolean };

/** Native's throttle: the pose updates every frame, the distances need not. */
const PROXIMITY_EVAL_INTERVAL_MS = 100;

type Vec3 = [number, number, number];

/**
 * Imperative placement surface the navigator's tap overlay drives. Mirrors the
 * native host's, so the overlay is the same component on both.
 */
export type StudioPlacementApi = {
  placeAtScreenPoint: (x: number, y: number) => Promise<"placed" | "miss">;
};

/**
 * The surface a tap lands on, or null when it lands on nothing usable.
 *
 * Nearest wins. The web tracker reports a plane hit with a normal and a
 * distance and nothing else, so unlike the native pick there is no anchor type
 * to prefer — the nearest real surface in front of the user is the whole rule.
 */
function pickBestHit(
  results: { position: Vec3; distance: number }[],
): { position: Vec3 } | null {
  let best: { position: Vec3; distance: number } | null = null;
  for (const hit of results) {
    if (!Number.isFinite(hit.distance) || hit.distance <= 0) continue;
    if (!best || hit.distance < best.distance) best = hit;
  }
  return best;
}

export interface StudioApiRequestExecutorLike {
  (body: string): Promise<{ success: boolean; data?: string; error?: string }>;
}

interface Props {
  sceneData: StudioSceneResponse | null;
  /** "ar" mounts ViroARScene (slam camera+pose+planes); "3d" mounts ViroScene. */
  mode?: "ar" | "3d";
  /** Injected API_REQUEST transport (replaces native VRTStudioModule). */
  apiRequestExecutor?: SequenceRuntimeContext["apiRequestExecutor"];
  /** Injected scene navigation (fetch + re-render); wired by the web navigator. */
  navigate?: (targetSceneId: string) => void;
  onReady?: () => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  onPlaneDetected?: () => void;
  /** Reports scene features that won't render on web (for a capability warning). */
  onUnsupported?: (features: string[]) => void;
  noAssetsMessage?: string;
  variableStore?: StudioVariableStore;
  /** Receives the placement API so the navigator's tap overlay can drive it. */
  placementApiRef?: React.MutableRefObject<StudioPlacementApi | null>;
  /** Injected so the navigator can drive its own prompt off the same queue. */
  placementStore?: StudioPlacementStore;
}

/** Outer gate: keep hooks out of the tree until sceneData exists. */
export const StudioARScene: React.FC<Props> = (props) => {
  if (!props.sceneData) {
    return props.mode === "3d" ? <ViroScene /> : <ViroARScene />;
  }
  return <StudioARSceneInner {...props} sceneData={props.sceneData} />;
};

const StudioARSceneInner: React.FC<Props & { sceneData: StudioSceneResponse }> = (
  props,
) => {
  const {
    sceneData,
    mode = "ar",
    apiRequestExecutor,
    navigate,
    onReady,
    onSceneChange,
    onPlaneDetected,
    onUnsupported,
    noAssetsMessage,
    variableStore,
    placementApiRef,
    placementStore,
  } = props;
  const { scene, assets, animations, functions } = sceneData;

  // ─── Runtime singletons (per scene) ───────────────────────────────────────
  const schedulerRef = useRef<SequenceScheduler | null>(null);
  if (schedulerRef.current === null) schedulerRef.current = new SequenceScheduler();

  const soundManagerRef = useRef<StudioSoundManager | null>(null);
  if (soundManagerRef.current === null) soundManagerRef.current = new StudioSoundManager();

  useEffect(() => {
    return () => {
      schedulerRef.current?.dispose();
      schedulerRef.current = null;
      soundManagerRef.current?.reset();
    };
  }, []);

  const variableStoreRef = useRef<StudioVariableStore | null>(null);
  if (variableStoreRef.current === null) {
    variableStoreRef.current = variableStore ?? new StudioVariableStore();
    variableStoreRef.current.seed(sceneData.variables ?? []);
  }

  const visibilityStoreRef = useRef<StudioVisibilityStore | null>(null);
  if (visibilityStoreRef.current === null) {
    visibilityStoreRef.current = new StudioVisibilityStore();
    visibilityStoreRef.current.seed(assets);
  }
  useEffect(() => {
    visibilityStoreRef.current?.reseed(assets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);
  const placementStoreRef = useRef<StudioPlacementStore | null>(null);
  if (placementStoreRef.current === null) {
    placementStoreRef.current = placementStore ?? new StudioPlacementStore();
    placementStoreRef.current.seed(assets);
  }
  useEffect(() => {
    placementStoreRef.current?.reseed(assets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);
  useEffect(() => {
    soundManagerRef.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  const getAssetPosition = useCallback(
    (assetId: string): [number, number, number] | undefined => {
      const a = assets.find((x) => x.id === assetId);
      return a ? studioAssetPosition(a) : undefined;
    },
    [assets],
  );

  const runtimeCtx = useMemo<SequenceRuntimeContext>(
    () => ({
      scheduler: schedulerRef.current!,
      variableStore: variableStoreRef.current!,
      apiRequestExecutor,
      visibilityStore: visibilityStoreRef.current!,
      // Without this the node factory skips its PlaceableNode wrap and mounts a
      // tap-to-place asset at once, at an offset meant to be added to a tap
      // point that never happens — which lands it on top of the camera.
      placementStore: placementStoreRef.current!,
      soundManager: soundManagerRef.current!,
      getAssetPosition,
      navigate,
    }),
    [getAssetPosition, apiRequestExecutor, navigate],
  );

  const handleSceneChange = useCallback(
    (sceneId: string, sceneName: string) => {
      schedulerRef.current?.cancelAll();
      onSceneChange?.(sceneId, sceneName);
    },
    [onSceneChange],
  );

  // ─── Material + animation registration ────────────────────────────────────
  const materialsRegisteredRef = useRef(false);
  if (!materialsRegisteredRef.current) {
    registerStudioMaterialsForAssets(assets);
    materialsRegisteredRef.current = true;
  }
  const registeredKeyRef = useRef<string | null>(null);
  const animationsKey = animations.map((a) => a.animation_key).join(",");
  if (animations.length > 0 && registeredKeyRef.current !== animationsKey) {
    registeredKeyRef.current = animationsKey;
    registerSceneAnimations(animations);
  }

  // ─── Animation runtime state ──────────────────────────────────────────────
  const [animOverrides, setAnimOverrides] = useState<Record<string, AnimOverride>>({});
  const [loadedAssetIds, setLoadedAssetIds] = useState<Record<string, true>>({});

  const handleAssetLoaded = useCallback((assetId: string) => {
    setLoadedAssetIds((prev) => (prev[assetId] ? prev : { ...prev, [assetId]: true }));
  }, []);

  const triggerHandlesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    return () => {
      triggerHandlesRef.current.forEach((id) => cancelAnimationFrame(id));
      triggerHandlesRef.current.clear();
    };
  }, []);

  const triggerAnimation = useCallback((targetAssetId: string, animationKey: string) => {
    setAnimOverrides((prev) => ({ ...prev, [targetAssetId]: { key: animationKey, run: false } }));
    const handle = requestAnimationFrame(() => {
      triggerHandlesRef.current.delete(handle);
      setAnimOverrides((prev) => {
        const current = prev[targetAssetId];
        if (!current || current.key !== animationKey || current.run) return prev;
        return { ...prev, [targetAssetId]: { key: animationKey, run: true } };
      });
    });
    triggerHandlesRef.current.add(handle);
  }, []);
  const triggerAnimationRef = useRef(triggerAnimation);
  triggerAnimationRef.current = triggerAnimation;

  const animationStates = useMemo<Record<string, ViroAnimationProp>>(() => {
    const states: Record<string, ViroAnimationProp> = {};
    const byAsset = new Map<string, StudioAnimation[]>();
    for (const anim of animations) {
      const list = byAsset.get(anim.target_asset_id) ?? [];
      list.push(anim);
      byAsset.set(anim.target_asset_id, list);
    }
    for (const [assetId, anims] of byAsset) {
      const override = animOverrides[assetId];
      let activeAnim: StudioAnimation;
      let run: boolean;
      if (override) {
        const triggered = anims.find((a) => a.animation_key === override.key);
        if (!triggered) continue;
        activeAnim = triggered;
        run = override.run && !!loadedAssetIds[assetId];
      } else {
        activeAnim = anims[0];
        run = false;
      }
      const runOnLoad = (fnId: string) =>
        executeOnLoadFunction(
          fnId,
          functions,
          undefined,
          animations,
          (id, key) => triggerAnimationRef.current(id, key),
          handleSceneChange,
          runtimeCtx,
        );
      states[assetId] = {
        name: activeAnim.animation_key,
        run,
        loop: activeAnim.loop,
        interruptible: activeAnim.interruptible,
        delay: activeAnim.delay_ms ?? 0,
        onStart: activeAnim.on_start_function ? () => runOnLoad(activeAnim.on_start_function!) : undefined,
        onFinish: activeAnim.on_finish_function ? () => runOnLoad(activeAnim.on_finish_function!) : undefined,
      };
    }
    return states;
  }, [animations, animOverrides, loadedAssetIds, functions, handleSceneChange, runtimeCtx]);

  // ─── on_load_function ─────────────────────────────────────────────────────
  const onLoadExecutedRef = useRef(false);
  useEffect(() => {
    if (scene.on_load_function && !onLoadExecutedRef.current) {
      onLoadExecutedRef.current = true;
      executeOnLoadFunction(
        scene.on_load_function,
        functions,
        undefined,
        animations,
        (id, key) => triggerAnimationRef.current(id, key),
        handleSceneChange,
        runtimeCtx,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // ─── Capability report (features that won't render on web) ────────────────
  //
  // Everything this host drops has to be listed here. The three trigger kinds
  // and tap-to-place used to be missing, so a scene built on them opened looking
  // fine and then did nothing, with no way to tell a web gap from a bug.
  useEffect(() => {
    const unsupported = webUnsupportedFeatures(sceneData, mode);
    if (unsupported.length > 0) onUnsupported?.(unsupported);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // ─── Ready ────────────────────────────────────────────────────────────────
  useEffect(() => {
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Tap to place ─────────────────────────────────────────────────────────
  // The AR session is the only thing that knows where the camera is, and the
  // scene handle is the only thing that can hit-test a screen point.
  const { session } = useViroAR();
  const arSceneRef = useRef<ViroARSceneHandle | null>(null);

  const placeAtScreenPoint = useCallback(
    async (x: number, y: number): Promise<"placed" | "miss"> => {
      const store = placementStoreRef.current;
      const activeId = store?.activeAssetId();
      if (!store || !activeId || !arSceneRef.current) return "miss";

      let results: { position: Vec3; distance: number }[] = [];
      try {
        results = await arSceneRef.current.performARHitTestWithPoint(x, y);
      } catch {
        return "miss";
      }
      const best = pickBestHit(results);
      if (!best) return "miss";

      // The author's rotation is relative to where the user was facing, so the
      // basis goes in with the point or the asset lands facing world forward.
      const basis = session ? cameraBasis(session.cameraPose.quaternion) : null;
      store.place(activeId, best.position, basis?.forward, basis?.up);
      return "placed";
    },
    [session],
  );

  useEffect(() => {
    if (!placementApiRef) return;
    placementApiRef.current = { placeAtScreenPoint };
    return () => {
      if (placementApiRef.current?.placeAtScreenPoint === placeAtScreenPoint) {
        placementApiRef.current = null;
      }
    };
  }, [placementApiRef, placeAtScreenPoint]);

  // ─── Proximity bindings ───────────────────────────────────────────────────
  // Fires a function when the user comes within `distance` of an asset. The
  // camera side is the tracked pose; the asset side is its authored position,
  // which is its world position only outside a plane wrapper — hence the gate,
  // and hence webCapabilities reporting the wrapped case as unsupported.
  const proximityBindings = useMemo(
    () => sceneData.proximity_bindings ?? [],
    [sceneData],
  );
  const proximityStateRef = useRef<Map<string, ProximityRuntimeState>>(new Map());
  useEffect(() => {
    proximityStateRef.current.clear();
  }, [scene.id]);

  const proximityLive =
    proximityBindings.length > 0 &&
    !usesPlaneWrapper(scene.plane_detection as string, mode);

  useEffect(() => {
    if (!proximityLive || !session) return;
    let handle = 0;
    let last = 0;
    const step = () => {
      handle = requestAnimationFrame(step);
      const now = Date.now();
      if (now - last < PROXIMITY_EVAL_INTERVAL_MS) return;
      last = now;
      evaluateProximityBindings({
        cameraPosition: session.cameraPose.position,
        bindings: proximityBindings,
        getTargetWorldPosition: getAssetPosition,
        stateRef: proximityStateRef,
        animations,
        onSceneChange: handleSceneChange,
        onAnimationTrigger: (id, key) => triggerAnimationRef.current(id, key),
        runtimeCtx,
      });
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [
    proximityLive,
    session,
    proximityBindings,
    getAssetPosition,
    animations,
    handleSceneChange,
    runtimeCtx,
  ]);

  // ─── Node mapping (image-triggered assets are skipped on web) ─────────────
  // Tap-to-place assets are held out of the plane wrapper: once placed they live
  // in world space, and a plane wrapper would re-parent them to the plane.
  const { planeAssets, tapToPlaceAssets } = useMemo(() => {
    const placeable = assets.filter(isTapToPlaceAsset);
    return {
      planeAssets: assets.filter(
        (a) => !a.trigger_image_url && !isTapToPlaceAsset(a),
      ),
      tapToPlaceAssets: placeable,
    };
  }, [assets]);

  const buildNodes = useCallback(
    (list: typeof assets) =>
      list
        .map((asset) =>
          createNode(
            asset,
            undefined, // sceneNavigator: web navigates via runtimeCtx.navigate
            animations,
            scene,
            (id, key) => triggerAnimationRef.current(id, key),
            animationStates,
            handleAssetLoaded,
            undefined, // onCollision: no physics on web
            undefined, // isDragActive
            undefined, // notifyPhysicsDrag
            handleSceneChange,
            runtimeCtx,
          ),
        )
        .filter(Boolean) as React.ReactElement[],
    [animations, scene, animationStates, handleAssetLoaded, handleSceneChange, runtimeCtx],
  );

  const renderedAssets = useMemo(
    () => buildNodes(planeAssets),
    [buildNodes, planeAssets],
  );
  const renderedPlacements = useMemo(
    () => buildNodes(tapToPlaceAssets),
    [buildNodes, tapToPlaceAssets],
  );

  // ─── Plane wrapping (AR mode only) ────────────────────────────────────────
  const planeMode = ((scene.plane_detection as string) ?? "NONE").toUpperCase();
  const planeAlignment = (scene.plane_direction ?? "Horizontal") as any;
  const usePlane = mode === "ar" && (planeMode === "AUTOMATIC" || planeMode === "MANUAL");

  const body = usePlane ? (
    <ViroARPlane
      minHeight={0.1}
      minWidth={0.1}
      alignment={planeAlignment}
      onAnchorFound={() => onPlaneDetected?.()}
    >
      {renderedAssets}
    </ViroARPlane>
  ) : (
    <>{renderedAssets}</>
  );

  const children = (
    <>
      <ViroAmbientLight color="#ffffff" intensity={STUDIO_AMBIENT_INTENSITY} />
      <ViroDirectionalLight
        color="#ffffff"
        intensity={STUDIO_DIRECTIONAL_INTENSITY}
        direction={STUDIO_DIRECTIONAL_DIRECTION}
      />
      {body}
      {/* At scene root: a placed asset is in world space, and the plane wrapper
          would re-parent it to the plane it happened to be tapped on. */}
      {renderedPlacements}
      <StudioSounds manager={soundManagerRef.current!} />
      {assets.length === 0 && (
        <ViroText
          text={noAssetsMessage ?? "No assets to display"}
          position={[0, 0, -2]}
          style={{ fontFamily: "Arial", fontSize: 16, color: "#CCCCCC", textAlign: "center" }}
        />
      )}
    </>
  );

  return mode === "3d" ? (
    <ViroScene>{children}</ViroScene>
  ) : (
    <ViroARScene ref={arSceneRef}>{children}</ViroARScene>
  );
};
