import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { ViroAmbientLight } from "../ViroAmbientLight";
import { ViroARImageMarker } from "../AR/ViroARImageMarker";
import { ViroARPlane } from "../AR/ViroARPlane";
import { ViroARPlaneSelector } from "../AR/ViroARPlaneSelector";
import { ViroARScene } from "../AR/ViroARScene";
import { ViroScene } from "../ViroScene";
import { ViroText } from "../ViroText";
import { ViroController } from "../ViroController";
import { isQuest } from "../Utilities/ViroPlatform";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { createPlacementCollisionHandler } from "./domain/collisionBindingsRuntime";
import { collisionPairKey } from "./domain/collisionPairKey";
import {
  cleanupTriggerImageTargets,
  registerTriggerImageTargets,
} from "./domain/triggerImageRegistry";
import { createNode } from "./domain/viroNodeFactory";
import { defaultApiRequestExecutor } from "./domain/defaultApiRequestExecutor";
import {
  executeOnLoadFunction,
  SequenceScheduler,
} from "./domain/sceneNavigationHandler";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioVisibilityStore } from "./domain/visibilityStore";
import { StudioSoundManager } from "./domain/soundManager";
import { StudioSounds } from "./domain/StudioSounds";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import { useStudioShaderTimeUniforms } from "./domain/useStudioShaderTimeUniforms";
import { useStudioShaderViewportUniforms } from "./domain/useStudioShaderViewportUniforms";
import {
  buildViroPhysicsWorld,
  parsePhysicsWorldConfig,
} from "./domain/physicsConfig";
import {
  StudioAnimation,
  StudioSceneResponse,
  ViroAnimationProp,
} from "./types";

const ANDROID_MAX_3D_MODELS = 3;
const IOS_MAX_3D_MODELS = 10;

type AnimOverride = { key: string; run: boolean };

interface StudioARSceneProps {
  sceneNavigator?: any;
  sceneData: StudioSceneResponse | null;
  onReady?: () => void;
  onError?: (err: Error) => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  /** Session-scoped store owned by the navigator; survives scene pushes. */
  variableStore?: StudioVariableStore;
}

/**
 * Outer gate: keeps the hooks-bearing inner component out of the tree until
 * sceneData is available, avoiding a Rules of Hooks violation.
 */
export const StudioARScene: React.FC<StudioARSceneProps> = (props) => {
  if (!props.sceneData) {
    return isQuest ? <ViroScene /> : <ViroARScene />;
  }
  return <StudioARSceneInner {...props} sceneData={props.sceneData} />;
};

// ─── Inner component (all hooks live here) ────────────────────────────────────

interface StudioARSceneInnerProps extends StudioARSceneProps {
  sceneData: StudioSceneResponse; // guaranteed non-null by outer gate
}

const StudioARSceneInner: React.FC<StudioARSceneInnerProps> = (props) => {
  const { sceneNavigator, sceneData, onReady, onSceneChange, variableStore } =
    props;
  const { scene, assets, animations, collision_bindings, functions } =
    sceneData;

  // ─── Sequence scheduler ───────────────────────────────────────────────────
  // One per scene. Drives WAIT steps; cancelled on unmount and on navigation so
  // a pending WAIT never fires into a torn-down or replaced scene.
  const schedulerRef = useRef<SequenceScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = new SequenceScheduler();
  }
  useEffect(() => {
    return () => {
      schedulerRef.current?.dispose();
      schedulerRef.current = null;
      // dispose() bumps the scheduler generation first; reset() then clears any
      // pending sound backstop timers and fires their callbacks, which now
      // no-op via the generation guard so unmount can't advance a waited step.
      soundManagerRef.current?.reset();
    };
  }, []);

  // ─── Variable store ───────────────────────────────────────────────────────
  // Normally passed down by the navigator (session-scoped); hosts mounting this
  // scene directly get a scene-local fallback. Seeding happens here, at instance
  // init, so values exist before any effect dispatches on_load. seed() is
  // initialize-if-absent, hence idempotent and strict-mode safe.
  const variableStoreRef = useRef<StudioVariableStore | null>(null);
  if (variableStoreRef.current === null) {
    variableStoreRef.current = variableStore ?? new StudioVariableStore();
    variableStoreRef.current.seed(sceneData.variables ?? []);
  }

  // ─── Visibility store ─────────────────────────────────────────────────────
  // Scene-scoped (asset placements are per-scene), keyed by asset id. Seeded
  // from each asset's author-time hidden_on_load default; Set Visibility
  // actions flip it at runtime. Re-seeded on scene change so a persisted
  // instance doesn't carry stale visibility across a navigation.
  const visibilityStoreRef = useRef<StudioVisibilityStore | null>(null);
  if (visibilityStoreRef.current === null) {
    visibilityStoreRef.current = new StudioVisibilityStore();
    visibilityStoreRef.current.seed(assets);
  }
  useEffect(() => {
    visibilityStoreRef.current?.reseed(assets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // ─── Sound manager ────────────────────────────────────────────────────────
  // Per-scene. PLAY/STOP scene-function actions drive it; <StudioSounds> renders
  // the active list. Reset on scene change so sounds don't leak across a
  // navigation (sounds, unlike variables, are not session-scoped).
  const soundManagerRef = useRef<StudioSoundManager | null>(null);
  if (soundManagerRef.current === null) {
    soundManagerRef.current = new StudioSoundManager();
  }
  useEffect(() => {
    soundManagerRef.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // Position for a spatial PLAY: look up the placed target asset (matches the
  // node factory's position derivation, position_z defaulting to -2).
  const getAssetPosition = useCallback(
    (assetId: string): [number, number, number] | undefined => {
      const a = assets.find((x) => x.id === assetId);
      if (!a) return undefined;
      return [a.position_x ?? 0, a.position_y ?? 0, a.position_z ?? -2];
    },
    [assets]
  );

  const runtimeCtx = useMemo(
    () => ({
      scheduler: schedulerRef.current!,
      variableStore: variableStoreRef.current!,
      apiRequestExecutor: defaultApiRequestExecutor,
      visibilityStore: visibilityStoreRef.current!,
      soundManager: soundManagerRef.current!,
      getAssetPosition,
    }),
    [getAssetPosition]
  );

  // Cancel this scene's pending WAITs before handing off to the next scene.
  const handleSceneChange = useCallback(
    (sceneId: string, sceneName: string) => {
      schedulerRef.current?.cancelAll();
      onSceneChange?.(sceneId, sceneName);
    },
    [onSceneChange]
  );

  // ─── Material registration ────────────────────────────────────────────────
  const materialsRegisteredRef = useRef(false);
  if (!materialsRegisteredRef.current) {
    registerStudioMaterialsForAssets(assets);
    materialsRegisteredRef.current = true;
  }

  useStudioShaderTimeUniforms(assets);
  useStudioShaderViewportUniforms(assets);

  // ─── Animation registration ───────────────────────────────────────────────
  const registeredKeyRef = useRef<string | null>(null);
  const animationsKey = animations.map((a) => a.animation_key).join(",");
  if (animations.length > 0 && registeredKeyRef.current !== animationsKey) {
    registeredKeyRef.current = animationsKey;
    registerSceneAnimations(animations);
  }

  // ─── Animation runtime state ──────────────────────────────────────────────
  const [animOverrides, setAnimOverrides] = useState<
    Record<string, AnimOverride>
  >({});
  const [loadedAssetIds, setLoadedAssetIds] = useState<Record<string, true>>(
    {}
  );

  const handleAssetLoaded = useCallback((assetId: string) => {
    setLoadedAssetIds((prev) =>
      prev[assetId] ? prev : { ...prev, [assetId]: true }
    );
  }, []);

  const triggerHandlesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    return () => {
      triggerHandlesRef.current.forEach((id) => cancelAnimationFrame(id));
      triggerHandlesRef.current.clear();
    };
  }, []);

  const triggerAnimation = useCallback(
    (targetAssetId: string, animationKey: string) => {
      // Viro's animation prop is edge-triggered on false→true. Force false first,
      // then flip to true on the next frame so a re-trigger of the same key fires.
      setAnimOverrides((prev) => ({
        ...prev,
        [targetAssetId]: { key: animationKey, run: false },
      }));
      const handle = requestAnimationFrame(() => {
        triggerHandlesRef.current.delete(handle);
        setAnimOverrides((prev) => {
          const current = prev[targetAssetId];
          if (!current || current.key !== animationKey || current.run)
            return prev;
          return { ...prev, [targetAssetId]: { key: animationKey, run: true } };
        });
      });
      triggerHandlesRef.current.add(handle);
    },
    []
  );

  const triggerAnimationRef = useRef(triggerAnimation);
  triggerAnimationRef.current = triggerAnimation;

  // ─── Computed animation props per asset ──────────────────────────────────
  const animationStates = useMemo<Record<string, ViroAnimationProp>>(() => {
    const states: Record<string, ViroAnimationProp> = {};
    const animsByAsset = new Map<string, StudioAnimation[]>();
    for (const anim of animations) {
      const list = animsByAsset.get(anim.target_asset_id) ?? [];
      list.push(anim);
      animsByAsset.set(anim.target_asset_id, list);
    }
    for (const [assetId, anims] of animsByAsset) {
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
      states[assetId] = {
        name: activeAnim.animation_key,
        run,
        loop: activeAnim.loop,
        interruptible: activeAnim.interruptible,
        delay: activeAnim.delay_ms ?? 0,
        onStart: activeAnim.on_start_function
          ? () =>
              executeOnLoadFunction(
                activeAnim.on_start_function!,
                functions,
                sceneNavigator,
                animations,
                (id, key) => triggerAnimationRef.current(id, key),
                handleSceneChange,
                runtimeCtx
              )
          : undefined,
        onFinish: activeAnim.on_finish_function
          ? () =>
              executeOnLoadFunction(
                activeAnim.on_finish_function!,
                functions,
                sceneNavigator,
                animations,
                (id, key) => triggerAnimationRef.current(id, key),
                handleSceneChange,
                runtimeCtx
              )
          : undefined,
      };
    }
    return states;
  }, [
    animations,
    animOverrides,
    loadedAssetIds,
    functions,
    sceneNavigator,
    handleSceneChange,
    runtimeCtx,
  ]);

  // ─── on_load_function ─────────────────────────────────────────────────────
  const onLoadExecutedRef = useRef(false);
  useEffect(() => {
    if (scene.on_load_function && !onLoadExecutedRef.current) {
      onLoadExecutedRef.current = true;
      executeOnLoadFunction(
        scene.on_load_function,
        functions,
        sceneNavigator,
        animations,
        (id, key) => triggerAnimationRef.current(id, key),
        handleSceneChange,
        runtimeCtx
      );
    }
  }, [scene.id]);

  // ─── Collision bindings ───────────────────────────────────────────────────
  const bindingsByPairKey = useMemo(() => {
    const m = new Map<string, (typeof collision_bindings)[0][]>();
    for (const b of collision_bindings) {
      const key = collisionPairKey(b.asset_x_id, b.asset_y_id);
      const list = m.get(key) ?? [];
      list.push(b);
      m.set(key, list);
    }
    return m;
  }, [collision_bindings]);

  const collisionAssetIds = useMemo(() => {
    const s = new Set<string>();
    for (const b of collision_bindings) {
      s.add(b.asset_x_id);
      s.add(b.asset_y_id);
    }
    return s;
  }, [collision_bindings]);

  const collisionCooldownRef = useRef<Map<string, number>>(new Map());

  const getCollisionHandler = useCallback(
    (placementId: string) => {
      if (!collisionAssetIds.has(placementId)) return undefined;
      return createPlacementCollisionHandler(
        placementId,
        bindingsByPairKey,
        sceneNavigator,
        animations,
        collisionCooldownRef,
        (id, key) => triggerAnimationRef.current(id, key),
        handleSceneChange,
        runtimeCtx
      );
    },
    [
      bindingsByPairKey,
      collisionAssetIds,
      sceneNavigator,
      animations,
      handleSceneChange,
      runtimeCtx,
    ]
  );

  // ─── Trigger image targets ────────────────────────────────────────────────
  const { planeAssets, imageTriggeredAssets } = useMemo(() => {
    const plane = assets.filter((a) => !a.trigger_image_url);
    const imgTriggered = assets.filter((a) => !!a.trigger_image_url);
    return { planeAssets: plane, imageTriggeredAssets: imgTriggered };
  }, [assets]);

  const [urlToTargetName, setUrlToTargetName] = useState<Map<string, string>>(
    () => new Map()
  );
  const prevTargetNamesRef = useRef<string[]>([]);

  useEffect(() => {
    if (isQuest) {
      if (imageTriggeredAssets.length > 0) {
        console.warn(
          "[Studio] Image-triggered assets are not supported on Quest — skipping."
        );
      }
      return;
    }
    if (imageTriggeredAssets.length === 0) {
      cleanupTriggerImageTargets(prevTargetNamesRef.current);
      prevTargetNamesRef.current = [];
      setUrlToTargetName(new Map());
      return;
    }
    const map = registerTriggerImageTargets(imageTriggeredAssets);
    const targetNames = [...map.values()];
    prevTargetNamesRef.current = targetNames;
    setUrlToTargetName(map);
    return () => {
      cleanupTriggerImageTargets(targetNames);
      prevTargetNamesRef.current = [];
    };
  }, [imageTriggeredAssets]);

  // ─── Ready callback ───────────────────────────────────────────────────────
  useEffect(() => {
    onReady?.();
  }, []);

  // ─── Render helpers ───────────────────────────────────────────────────────
  const maxModels =
    Platform.OS === "android" ? ANDROID_MAX_3D_MODELS : IOS_MAX_3D_MODELS;

  const renderedPlaneAssets = useMemo(() => {
    let modelCount = 0;
    return planeAssets
      .map((asset) => {
        if (asset.asset_type_name === "3D-MODEL") {
          modelCount++;
          if (modelCount > maxModels) {
            console.warn(
              `[Studio] Skipping 3D model "${asset.name}" — ${Platform.OS} limit (${maxModels}) reached`
            );
            return null;
          }
        }
        return createNode(
          asset,
          sceneNavigator,
          animations,
          scene,
          (id, key) => triggerAnimationRef.current(id, key),
          animationStates,
          handleAssetLoaded,
          getCollisionHandler(asset.id),
          handleSceneChange,
          runtimeCtx
        );
      })
      .filter(Boolean) as React.ReactElement[];
  }, [
    planeAssets,
    sceneNavigator,
    animations,
    animationStates,
    handleAssetLoaded,
    getCollisionHandler,
    maxModels,
    handleSceneChange,
    runtimeCtx,
  ]);

  const renderedImageTriggeredAssets = useMemo(() => {
    if (isQuest) return [];
    return imageTriggeredAssets
      .map((asset) => {
        const targetName = urlToTargetName.get(asset.trigger_image_url!);
        if (!targetName) return null;
        const node = createNode(
          asset,
          sceneNavigator,
          animations,
          scene,
          (id, key) => triggerAnimationRef.current(id, key),
          animationStates,
          handleAssetLoaded,
          getCollisionHandler(asset.id),
          handleSceneChange,
          runtimeCtx
        );
        if (!node) return null;
        return (
          <ViroARImageMarker key={asset.id} target={targetName}>
            {node}
          </ViroARImageMarker>
        );
      })
      .filter(Boolean) as React.ReactElement[];
  }, [
    urlToTargetName,
    imageTriggeredAssets,
    sceneNavigator,
    animations,
    animationStates,
    handleAssetLoaded,
    getCollisionHandler,
    handleSceneChange,
    runtimeCtx,
  ]);

  // ─── Plane detection (AR only) ────────────────────────────────────────────
  const planeDetectionMode = (
    (scene.plane_detection as string) ?? "NONE"
  ).toUpperCase();
  const planeAlignment = (scene.plane_direction ?? "Horizontal") as any;

  const renderAssets = () => {
    if (isQuest) {
      if (planeDetectionMode !== "NONE") {
        console.warn(
          `[Studio] Plane detection (${planeDetectionMode}) is not supported on Quest — rendering assets without plane anchor.`
        );
      }
      return <>{renderedPlaneAssets}</>;
    }

    if (planeDetectionMode === "AUTOMATIC") {
      return (
        <ViroARPlane minHeight={0.1} minWidth={0.1} alignment={planeAlignment}>
          {renderedPlaneAssets}
        </ViroARPlane>
      );
    }
    if (planeDetectionMode === "MANUAL") {
      return (
        <ViroARPlaneSelector
          minHeight={0.1}
          minWidth={0.1}
          alignment={planeAlignment}
        >
          {renderedPlaneAssets}
        </ViroARPlaneSelector>
      );
    }
    return <>{renderedPlaneAssets}</>;
  };

  // ─── Physics world ────────────────────────────────────────────────────────
  const physicsWorldConfig = parsePhysicsWorldConfig(
    scene.physics_world_config
  );
  const physicsWorld = physicsWorldConfig?.enabled
    ? buildViroPhysicsWorld(physicsWorldConfig)
    : undefined;

  const physicsProps = physicsWorld
    ? { physicsWorld: physicsWorld as any }
    : {};

  // ─── Render ───────────────────────────────────────────────────────────────
  const children = (
    <>
      {isQuest && <ViroController controllerVisibility reticleVisibility />}
      <ViroAmbientLight color="#ffffff" intensity={1000} />
      {renderAssets()}
      {renderedImageTriggeredAssets}
      <StudioSounds manager={soundManagerRef.current!} />
      {assets.length === 0 && (
        <ViroText
          text="No assets to display"
          position={[0, 0, -2]}
          style={{
            fontFamily: "Arial",
            fontSize: 16,
            color: "#CCCCCC",
            textAlign: "center",
          }}
        />
      )}
    </>
  );

  if (isQuest) {
    return <ViroScene {...physicsProps}>{children}</ViroScene>;
  }
  return <ViroARScene {...physicsProps}>{children}</ViroARScene>;
};
