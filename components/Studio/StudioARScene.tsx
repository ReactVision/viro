import * as React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { ViroAmbientLight } from "../ViroAmbientLight";
import { ViroARImageMarker } from "../AR/ViroARImageMarker";
import { ViroARPlane } from "../AR/ViroARPlane";
import { ViroARPlaneSelector } from "../AR/ViroARPlaneSelector";
import { ViroARScene } from "../AR/ViroARScene";
import { ViroText } from "../ViroText";
import { registerSceneAnimations } from "./domain/animationRegistry";
import {
  createPlacementCollisionHandler,
} from "./domain/collisionBindingsRuntime";
import { collisionPairKey } from "./domain/collisionPairKey";
import {
  cleanupTriggerImageTargets,
  registerTriggerImageTargets,
} from "./domain/triggerImageRegistry";
import { createNode } from "./domain/viroNodeFactory";
import {
  executeOnLoadFunction,
} from "./domain/sceneNavigationHandler";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import { useStudioShaderTimeUniforms } from "./domain/useStudioShaderTimeUniforms";
import { useStudioShaderViewportUniforms } from "./domain/useStudioShaderViewportUniforms";
import { buildViroPhysicsWorld, parsePhysicsWorldConfig } from "./domain/physicsConfig";
import {
  StudioAnimation,
  StudioSceneResponse,
  ViroAnimationProp,
} from "./types";

const ANDROID_MAX_3D_MODELS = 3;
const IOS_MAX_3D_MODELS = 10;

/** Per-asset active animation (key + run state for the false→true rAF trick). */
type AnimOverride = { key: string; run: boolean };

interface StudioARSceneProps {
  /** Injected automatically by ViroARSceneNavigator */
  sceneNavigator?: any;
  /** The fully loaded scene response — passed via passProps */
  sceneData: StudioSceneResponse | null;
  onReady?: () => void;
  onError?: (err: Error) => void;
  /** Called when a NAVIGATION function transitions to a new scene. */
  onSceneChange?: (sceneId: string, sceneName: string) => void;
}

/**
 * AR scene component driven by a StudioSceneResponse.
 * Passed as `scene` to ViroARSceneNavigator.initialScene and also
 * to sceneNavigator.push() when navigating between scenes.
 */
export const StudioARScene: React.FC<StudioARSceneProps> = (props) => {
  const { sceneNavigator, sceneData, onReady, onSceneChange } = props;

  // Guard: sceneData may be null during the brief push animation.
  if (!sceneData) return <ViroARScene />;

  const { scene, assets, animations, collision_bindings, functions } =
    sceneData;

  // ─── Material registration ────────────────────────────────────────────────
  // Must run synchronously before first render so shaderOverrides resolve.
  const materialsRegisteredRef = useRef(false);
  if (!materialsRegisteredRef.current) {
    registerStudioMaterialsForAssets(assets);
    materialsRegisteredRef.current = true;
  }

  // Drive `time` uniform for animated shader presets (~60fps).
  useStudioShaderTimeUniforms(assets);

  // Push _rf_vpw / _rf_vph viewport uniforms for shaders sampling the camera feed.
  useStudioShaderViewportUniforms(assets);

  // ─── Animation registration ───────────────────────────────────────────────
  // Done synchronously at render time so the registry is populated before
  // any Viro component reads the animation prop.
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

  const [loadedAssetIds, setLoadedAssetIds] = useState<
    Record<string, true>
  >({});

  const handleAssetLoaded = useCallback((assetId: string) => {
    setLoadedAssetIds((prev) =>
      prev[assetId] ? prev : { ...prev, [assetId]: true }
    );
  }, []);

  const triggerRafsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      triggerRafsRef.current.forEach((id) => cancelAnimationFrame(id));
      triggerRafsRef.current.clear();
    };
  }, []);

  /** Two-step rAF animation trigger: set run:false then run:true on next frame. */
  const triggerAnimation = useCallback(
    (targetAssetId: string, animationKey: string) => {
      setAnimOverrides((prev) => ({
        ...prev,
        [targetAssetId]: { key: animationKey, run: false },
      }));
      const rafId = requestAnimationFrame(() => {
        triggerRafsRef.current.delete(rafId);
        setAnimOverrides((prev) => {
          const current = prev[targetAssetId];
          if (!current || current.key !== animationKey || current.run)
            return prev;
          return { ...prev, [targetAssetId]: { key: animationKey, run: true } };
        });
      });
      triggerRafsRef.current.add(rafId);
    },
    []
  );

  const triggerAnimationRef = useRef(triggerAnimation);
  triggerAnimationRef.current = triggerAnimation;

  // ─── Computed animation props per asset ──────────────────────────────────

  const animationStates = useMemo<Record<string, ViroAnimationProp>>(() => {
    const states: Record<string, ViroAnimationProp> = {};

    // Group animations by target asset
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
                (id, key) => triggerAnimationRef.current(id, key)
              )
          : undefined,
        onFinish: activeAnim.on_finish_function
          ? () =>
              executeOnLoadFunction(
                activeAnim.on_finish_function!,
                functions,
                sceneNavigator,
                animations,
                (id, key) => triggerAnimationRef.current(id, key)
              )
          : undefined,
      };
    }

    return states;
  }, [animations, animOverrides, loadedAssetIds, functions, sceneNavigator]);

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
        onSceneChange,
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
        onSceneChange,
      );
    },
    [bindingsByPairKey, collisionAssetIds, sceneNavigator, animations]
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
          handleAssetLoaded
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
  ]);

  const renderedImageTriggeredAssets = useMemo(() => {
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
          handleAssetLoaded
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
  ]);

  // ─── Plane detection mode ─────────────────────────────────────────────────

  const planeDetectionMode = (
    (scene.plane_detection as string) ?? "NONE"
  ).toUpperCase();
  const planeAlignment = (scene.plane_direction ?? "Horizontal") as any;

  // ─── Physics world ────────────────────────────────────────────────────────

  const physicsWorldConfig = parsePhysicsWorldConfig(scene.physics_world_config);
  const physicsWorld = physicsWorldConfig?.enabled
    ? buildViroPhysicsWorld(physicsWorldConfig)
    : undefined;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ViroARScene {...(physicsWorld ? { physicsWorld: physicsWorld as any } : {})}>
      <ViroAmbientLight color="#ffffff" intensity={1000} />

      {planeDetectionMode === "AUTOMATIC" ? (
        <ViroARPlane
          minHeight={0.1}
          minWidth={0.1}
          alignment={planeAlignment}
        >
          {renderedPlaneAssets}
        </ViroARPlane>
      ) : planeDetectionMode === "MANUAL" ? (
        <ViroARPlaneSelector
          minHeight={0.1}
          minWidth={0.1}
          alignment={planeAlignment}
        >
          {renderedPlaneAssets}
        </ViroARPlaneSelector>
      ) : (
        <>{renderedPlaneAssets}</>
      )}

      {renderedImageTriggeredAssets}

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
    </ViroARScene>
  );
};
