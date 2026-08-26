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
 *  - Dropped (no web equivalent): Quest/ViroController, image-triggered assets
 *    (ViroARImageMarker), native physics, drag, collisions. These are reported
 *    via `onUnsupported` so the caller can warn.
 *  - apiRequestExecutor + navigate are injected (no native VRTStudioModule).
 */
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ViroAmbientLight } from "../ViroAmbientLight.web";
import { ViroARPlane } from "../AR/ViroARPlane.web";
import { ViroARScene } from "../AR/ViroARScene.web";
import { ViroScene } from "../ViroScene.web";
import { ViroText } from "../ViroText.web";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { createNode } from "./domain/viroNodeFactory";
import {
  executeOnLoadFunction,
  SequenceScheduler,
  type SequenceRuntimeContext,
} from "./domain/sceneNavigationHandler";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioVisibilityStore } from "./domain/visibilityStore";
import { StudioSoundManager } from "./domain/soundManager";
import { StudioSounds } from "./domain/StudioSounds";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import type {
  StudioAnimation,
  StudioSceneResponse,
  ViroAnimationProp,
} from "./types";

type AnimOverride = { key: string; run: boolean };

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
  useEffect(() => {
    soundManagerRef.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  const getAssetPosition = useCallback(
    (assetId: string): [number, number, number] | undefined => {
      const a = assets.find((x) => x.id === assetId);
      return a ? [a.position_x ?? 0, a.position_y ?? 0, a.position_z ?? -2] : undefined;
    },
    [assets],
  );

  const runtimeCtx = useMemo<SequenceRuntimeContext>(
    () => ({
      scheduler: schedulerRef.current!,
      variableStore: variableStoreRef.current!,
      apiRequestExecutor,
      visibilityStore: visibilityStoreRef.current!,
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
  useEffect(() => {
    const unsupported: string[] = [];
    if (assets.some((a) => a.trigger_image_url)) unsupported.push("image markers");
    if (scene.physics_world_config) unsupported.push("physics");
    if (((scene.plane_detection as string) ?? "").toUpperCase() === "MANUAL")
      unsupported.push("manual plane selection");
    if (unsupported.length > 0) onUnsupported?.(unsupported);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // ─── Ready ────────────────────────────────────────────────────────────────
  useEffect(() => {
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Node mapping (plane assets only; image-triggered are skipped on web) ──
  const planeAssets = useMemo(() => assets.filter((a) => !a.trigger_image_url), [assets]);

  const renderedAssets = useMemo(() => {
    return planeAssets
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
      .filter(Boolean) as React.ReactElement[];
  }, [planeAssets, animations, scene, animationStates, handleAssetLoaded, handleSceneChange, runtimeCtx]);

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
      <ViroAmbientLight color="#ffffff" intensity={1000} />
      {body}
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

  return mode === "3d" ? <ViroScene>{children}</ViroScene> : <ViroARScene>{children}</ViroARScene>;
};
