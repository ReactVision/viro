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
import type { ViroAnchor } from "../Types/ViroEvents";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { createPlacementCollisionHandler } from "./domain/collisionBindingsRuntime";
import { collisionPairKey } from "./domain/collisionPairKey";
import {
  evaluateProximityBindings,
  ProximityRuntimeState,
} from "./domain/proximityBindingsRuntime";
import { ViroCameraTransform } from "../Types/ViroEvents";
import {
  cleanupTriggerImageTargets,
  registerTriggerImageTargets,
} from "./domain/triggerImageRegistry";
import { createNode } from "./domain/viroNodeFactory";
import { defaultApiRequestExecutor } from "./domain/defaultApiRequestExecutor";
import {
  executeOnLoadFunction,
  resetVideoRecordingState,
  SequenceScheduler,
} from "./domain/sceneNavigationHandler";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioVisibilityStore } from "./domain/visibilityStore";
import { StudioPlacementStore } from "./domain/placementStore";
import type { ViroARHitTestResult } from "../Types/ViroEvents";
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

// The native camera-transform event can fire per frame; throttle the proximity
// distance sweep to this cadence.
const PROXIMITY_EVAL_INTERVAL_MS = 100;

// Headset placement has no surface hit-test, so a triggered tap-to-place asset
// lands this far along the aim ray when no controller hit point is available.
const HEADSET_PLACEMENT_DISTANCE_M = 1.5;

// Result kinds worth placing on, best first (LiDAR depth > sized plane > plane >
// sparse feature point). Mirrors the ar-hit-test example's ranking.
const HIT_TEST_PRIORITY = [
  "DepthPoint",
  "ExistingPlaneUsingExtent",
  "ExistingPlane",
  "FeaturePoint",
];

/** Imperative placement surface the navigator's tap overlay drives (mobile AR). */
export type StudioPlacementApi = {
  placeAtScreenPoint: (x: number, y: number) => Promise<"placed" | "miss">;
};

type Vec3 = [number, number, number];

/** A world point is usable if finite and not the origin sentinel. */
function isUsablePoint(p?: number[] | null): p is Vec3 {
  return (
    Array.isArray(p) &&
    p.length >= 3 &&
    p.every((n) => Number.isFinite(n)) &&
    !(p[0] === 0 && p[1] === 0 && p[2] === 0)
  );
}

/** Highest-priority hit-test result with a usable surface point, else null. */
function pickBestHit(results: ViroARHitTestResult[]): ViroARHitTestResult | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  for (const type of HIT_TEST_PRIORITY) {
    const match = results.find(
      (r) => r.type === type && isUsablePoint(r.transform?.position)
    );
    if (match) return match;
  }
  return null;
}

/** Fixed-distance point along the cached camera-forward ray (headset fallback). */
function projectAlongCameraForward(
  pose: { position: Vec3; forward: Vec3 } | null
): Vec3 | null {
  if (!pose) return null;
  const { position, forward } = pose;
  return [
    position[0] + forward[0] * HEADSET_PLACEMENT_DISTANCE_M,
    position[1] + forward[1] * HEADSET_PLACEMENT_DISTANCE_M,
    position[2] + forward[2] * HEADSET_PLACEMENT_DISTANCE_M,
  ];
}

type AnimOverride = { key: string; run: boolean };

interface StudioARSceneProps {
  sceneNavigator?: any;
  sceneData: StudioSceneResponse | null;
  onReady?: () => void;
  onError?: (err: Error) => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  /** Fired on first AR plane detection (AUTOMATIC) / plane accept (MANUAL). */
  onPlaneDetected?: () => void;
  /** Fired when the user taps to select a plane (MANUAL mode). */
  onPlaneSelected?: () => void;
  /** Text shown when the scene has no assets. Defaults to "No assets to display". */
  noAssetsMessage?: string;
  /** Session-scoped store owned by the navigator; survives scene pushes. */
  variableStore?: StudioVariableStore;
  /** Placement store owned by the navigator so its tap overlay can read active state. */
  placementStore?: StudioPlacementStore;
  /** The navigator's tap overlay writes the placement API here (mobile AR). */
  placementApiRef?: React.MutableRefObject<StudioPlacementApi | null>;
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
  const {
    sceneNavigator,
    sceneData,
    onReady,
    onSceneChange,
    onPlaneDetected,
    onPlaneSelected,
    noAssetsMessage,
    variableStore,
    placementStore,
    placementApiRef,
  } = props;
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
      // Clear a dangling video-recording flag so leaving the experience mid-
      // recording can't block the next session's RECORD_VIDEO toggle.
      resetVideoRecordingState();
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

  // ─── Placement store (tap to place) ───────────────────────────────────────
  // Scene-scoped, seeded from each asset's author-time tap_to_place flag.
  // Normally owned by the navigator (so its tap overlay can read active state);
  // a host mounting this scene directly gets a scene-local fallback. Placement
  // is ephemeral, so a scene change re-seeds every tap-to-place asset to unplaced.
  const placementStoreRef = useRef<StudioPlacementStore | null>(null);
  if (placementStoreRef.current === null) {
    placementStoreRef.current = placementStore ?? new StudioPlacementStore();
    placementStoreRef.current.seed(assets);
  }
  useEffect(() => {
    placementStoreRef.current?.reseed(assets);
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
      placementStore: placementStoreRef.current!,
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

  // ─── Drag-active state (debounced) ────────────────────────────────────────
  // Viro's onDrag fires per-frame. Track a Record<assetId, true> cleared 220ms
  // after the last drag event; the node factory reads isDragActive to pass
  // kinematicDragOverride so Dynamic-physics bodies don't fight the gesture.
  // The onDrag callback's mere presence is also what unlocks native drag.
  const [dragActiveByAssetId, setDragActiveByAssetId] = useState<
    Record<string, true>
  >({});
  const dragTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const notifyPhysicsDrag = useCallback((assetId: string) => {
    setDragActiveByAssetId((prev) =>
      prev[assetId] ? prev : { ...prev, [assetId]: true }
    );
    const existing = dragTimersRef.current.get(assetId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setDragActiveByAssetId((prev) => {
        if (!prev[assetId]) return prev;
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
      dragTimersRef.current.delete(assetId);
    }, 220);
    dragTimersRef.current.set(assetId, t);
  }, []);

  const isDragActive = useCallback(
    (assetId: string) => !!dragActiveByAssetId[assetId],
    [dragActiveByAssetId]
  );

  useEffect(() => {
    const timers = dragTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

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

  // ─── Proximity bindings ───────────────────────────────────────────────────
  // Fire a function when the user's world position comes within `distance` of a
  // target object. Camera pose is uniform world-space across every locomotion
  // mode; the target side reads a live world transform (getTransformAsync)
  // rather than the parent-anchor-local DB position, so the metres are correct
  // regardless of anchor (plane / image marker / moved rig).
  const proximityBindings = useMemo(
    () => sceneData.proximity_bindings ?? [],
    [sceneData]
  );
  const proximityTargetIds = useMemo(() => {
    const s = new Set<string>();
    for (const b of proximityBindings) s.add(b.target_asset_id);
    return s;
  }, [proximityBindings]);

  // Per-binding latches (inside/fired/primed) — reset on scene change so a
  // navigation doesn't carry a one-shot's spent state into the next scene.
  const proximityStateRef = useRef<Map<string, ProximityRuntimeState>>(
    new Map()
  );
  useEffect(() => {
    proximityStateRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // Live target node refs + a cached world position per target. Refs self-manage
  // via the node factory's mount/unmount ref callback; the cache is refreshed on
  // register and whenever an AR anchor moves, so the camera hot path stays sync.
  const proximityTargetRefsRef = useRef<Map<string, any>>(new Map());
  const proximityTargetTransformsRef = useRef<
    Map<string, [number, number, number]>
  >(new Map());

  const refreshTargetTransform = useCallback(async (assetId: string) => {
    const ref = proximityTargetRefsRef.current.get(assetId);
    if (!ref?.getTransformAsync) return;
    try {
      const tr = await ref.getTransformAsync();
      const pos = tr?.position ?? tr?.transform?.position;
      if (Array.isArray(pos) && pos.length >= 3) {
        proximityTargetTransformsRef.current.set(assetId, [
          pos[0],
          pos[1],
          pos[2],
        ]);
      }
    } catch {
      // Node may not be mounted/anchored yet; the next anchor update retries.
    }
  }, []);

  const refreshAllTargetTransforms = useCallback(() => {
    for (const id of proximityTargetRefsRef.current.keys()) {
      void refreshTargetTransform(id);
    }
  }, [refreshTargetTransform]);

  const registerProximityTarget = useCallback(
    (assetId: string, ref: unknown) => {
      if (ref) {
        proximityTargetRefsRef.current.set(assetId, ref);
        void refreshTargetTransform(assetId);
      } else {
        proximityTargetRefsRef.current.delete(assetId);
        proximityTargetTransformsRef.current.delete(assetId);
      }
    },
    [refreshTargetTransform]
  );

  // ─── Tap to place ─────────────────────────────────────────────────────────
  const arSceneRef = useRef<InstanceType<typeof ViroARScene> | null>(null);
  // Latest camera pose, cached from the transform stream so a headset trigger
  // can project the aim ray without an AR surface hit-test.
  const cameraPoseRef = useRef<{
    position: [number, number, number];
    forward: [number, number, number];
  } | null>(null);

  // Which tap-to-place asset the guided queue is waiting on (drives the prompt).
  const [activePlacementId, setActivePlacementId] = useState<string | null>(
    () => placementStoreRef.current?.activeAssetId() ?? null
  );
  useEffect(() => {
    const store = placementStoreRef.current;
    if (!store) return;
    setActivePlacementId(store.activeAssetId());
    return store.subscribeActive(() =>
      setActivePlacementId(store.activeAssetId())
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  const activePlacementName = useMemo(() => {
    if (!activePlacementId) return null;
    return assets.find((a) => a.id === activePlacementId)?.name ?? null;
  }, [activePlacementId, assets]);

  const lastProximityEvalRef = useRef(0);
  const handleCameraTransformUpdate = useCallback(
    (t: ViroCameraTransform) => {
      cameraPoseRef.current = { position: t.position, forward: t.forward };
      if (!proximityBindings.length) return;
      const now = Date.now();
      if (now - lastProximityEvalRef.current < PROXIMITY_EVAL_INTERVAL_MS)
        return;
      lastProximityEvalRef.current = now;
      evaluateProximityBindings({
        cameraPosition: t.position,
        bindings: proximityBindings,
        getTargetWorldPosition: (id) =>
          proximityTargetTransformsRef.current.get(id),
        stateRef: proximityStateRef,
        sceneNavigator,
        animations,
        onSceneChange: handleSceneChange,
        onAnimationTrigger: (id, key) => triggerAnimationRef.current(id, key),
        runtimeCtx,
      });
    },
    [proximityBindings, sceneNavigator, animations, handleSceneChange, runtimeCtx]
  );

  // Mobile AR: hit-test the tapped screen point and place the active asset on the
  // best real surface. Returns "miss" when nothing usable is under the tap so the
  // overlay can prompt the user to scan more of the space.
  const placeAtScreenPoint = useCallback(
    async (x: number, y: number): Promise<"placed" | "miss"> => {
      const store = placementStoreRef.current;
      const activeId = store?.activeAssetId();
      if (!store || !activeId || !arSceneRef.current) return "miss";
      let results: ViroARHitTestResult[] = [];
      try {
        results = await arSceneRef.current.performARHitTestWithPoint(x, y);
      } catch {
        return "miss";
      }
      const best = pickBestHit(results);
      if (!best) return "miss";
      store.place(activeId, best.transform.position as Vec3);
      return "placed";
    },
    []
  );

  // Expose the mobile placement API to the navigator's tap overlay.
  useEffect(() => {
    if (!placementApiRef) return;
    placementApiRef.current = { placeAtScreenPoint };
    return () => {
      if (placementApiRef.current?.placeAtScreenPoint === placeAtScreenPoint) {
        placementApiRef.current = null;
      }
    };
  }, [placementApiRef, placeAtScreenPoint]);

  // Headset: the controller trigger fires this. Prefer the ray's real hit point
  // (room mesh); fall back to a fixed distance along the cached aim ray.
  const handleHeadsetPlaceTrigger = useCallback((hitPosition?: Vec3) => {
    const store = placementStoreRef.current;
    const activeId = store?.activeAssetId();
    if (!store || !activeId) return;
    const pos = isUsablePoint(hitPosition)
      ? hitPosition
      : projectAlongCameraForward(cameraPoseRef.current);
    if (!pos) return;
    store.place(activeId, pos);
  }, []);

  // ─── Trigger image targets ────────────────────────────────────────────────
  // Three groups: image-triggered (anchored to a tracked image), tap-to-place
  // (withheld until the user places them at scene root), and the rest (plane
  // assets, rendered inside the plane wrapper). Image triggering wins over
  // tap-to-place since a marker already dictates the anchor.
  const { planeAssets, imageTriggeredAssets, tapToPlaceAssets } = useMemo(() => {
    const imgTriggered = assets.filter((a) => !!a.trigger_image_url);
    const tapToPlace = assets.filter(
      (a) => !a.trigger_image_url && a.tap_to_place
    );
    const plane = assets.filter((a) => !a.trigger_image_url && !a.tap_to_place);
    return {
      planeAssets: plane,
      imageTriggeredAssets: imgTriggered,
      tapToPlaceAssets: tapToPlace,
    };
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
          isDragActive,
          notifyPhysicsDrag,
          handleSceneChange,
          runtimeCtx,
          proximityTargetIds.has(asset.id) ? registerProximityTarget : undefined
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
    isDragActive,
    notifyPhysicsDrag,
    maxModels,
    handleSceneChange,
    runtimeCtx,
    proximityTargetIds,
    registerProximityTarget,
  ]);

  // Tap-to-place nodes render at scene root (world space); each is gated by the
  // placement store (null until placed, then mounted at the placed world point).
  const renderedTapToPlaceAssets = useMemo(() => {
    let modelCount = 0;
    return tapToPlaceAssets
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
          isDragActive,
          notifyPhysicsDrag,
          handleSceneChange,
          runtimeCtx,
          proximityTargetIds.has(asset.id) ? registerProximityTarget : undefined
        );
      })
      .filter(Boolean) as React.ReactElement[];
  }, [
    tapToPlaceAssets,
    sceneNavigator,
    animations,
    animationStates,
    handleAssetLoaded,
    getCollisionHandler,
    isDragActive,
    notifyPhysicsDrag,
    maxModels,
    handleSceneChange,
    runtimeCtx,
    proximityTargetIds,
    registerProximityTarget,
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
          isDragActive,
          notifyPhysicsDrag,
          handleSceneChange,
          runtimeCtx,
          proximityTargetIds.has(asset.id) ? registerProximityTarget : undefined
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
    isDragActive,
    notifyPhysicsDrag,
    handleSceneChange,
    runtimeCtx,
    proximityTargetIds,
    registerProximityTarget,
  ]);

  // ─── Plane detection (AR only) ────────────────────────────────────────────
  const planeDetectionMode = (
    (scene.plane_detection as string) ?? "NONE"
  ).toUpperCase();
  const planeAlignment = (scene.plane_direction ?? "Horizontal") as any;

  // Native plane anchor types for ViroARScene (lowercase matches Viro defaults).
  const anchorDetectionTypes = useMemo((): string[] | undefined => {
    if (planeDetectionMode !== "AUTOMATIC" && planeDetectionMode !== "MANUAL") {
      return undefined;
    }
    const dir = (scene.plane_direction ?? "Horizontal").toLowerCase();
    if (dir === "vertical") return ["planesVertical"];
    if (dir.includes("horizontal")) return ["planesHorizontal"];
    return ["planesHorizontal", "planesVertical"];
  }, [planeDetectionMode, scene.plane_direction]);

  // ViroARPlaneSelector (react-viro 2.54+) no longer receives scene anchors
  // automatically; ViroARScene forwards them here via ref. Also surfaces
  // onPlaneDetected / onPlaneSelected to the host.
  const planeSelectorRef = useRef<InstanceType<
    typeof ViroARPlaneSelector
  > | null>(null);

  const handleAnchorFound = useCallback(
    (anchor: ViroAnchor) => {
      try {
        if (planeDetectionMode === "MANUAL") {
          planeSelectorRef.current?.handleAnchorFound(anchor);
        }
        if (planeDetectionMode === "AUTOMATIC" && anchor?.type === "plane") {
          onPlaneDetected?.();
        }
        // Anchoring places content in world space — refresh cached target
        // positions so proximity metres stay correct once the anchor lands.
        refreshAllTargetTransforms();
      } catch (error) {
        console.error("[Studio] handleAnchorFound failed:", error);
      }
    },
    [planeDetectionMode, onPlaneDetected, refreshAllTargetTransforms]
  );

  const handleAnchorUpdated = useCallback(
    (anchor: ViroAnchor) => {
      try {
        if (planeDetectionMode === "MANUAL") {
          planeSelectorRef.current?.handleAnchorUpdated(anchor);
        }
        refreshAllTargetTransforms();
      } catch (error) {
        console.error("[Studio] handleAnchorUpdated failed:", error);
      }
    },
    [planeDetectionMode, refreshAllTargetTransforms]
  );

  const handleAnchorRemoved = useCallback(
    (anchor?: ViroAnchor) => {
      try {
        if (planeDetectionMode === "MANUAL" && anchor) {
          planeSelectorRef.current?.handleAnchorRemoved(anchor);
        }
      } catch (error) {
        console.error("[Studio] handleAnchorRemoved failed:", error);
      }
    },
    [planeDetectionMode]
  );

  const handlePlaneSelected = useCallback(() => {
    onPlaneSelected?.();
  }, [onPlaneSelected]);

  // ViroARPlaneSelector.onPlaneDetected must return a boolean (accept the plane).
  const handlePlaneDetectedForSelector = useCallback(() => {
    onPlaneDetected?.();
    return true;
  }, [onPlaneDetected]);

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
          ref={planeSelectorRef}
          minHeight={0.1}
          minWidth={0.1}
          alignment={planeAlignment}
          onPlaneDetected={handlePlaneDetectedForSelector}
          onPlaneSelected={handlePlaneSelected}
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
      {isQuest && (
        <ViroController
          controllerVisibility
          reticleVisibility
          {...(activePlacementId
            ? {
                onClick: (position: [number, number, number]) =>
                  handleHeadsetPlaceTrigger(position),
              }
            : {})}
        />
      )}
      <ViroAmbientLight color="#ffffff" intensity={1000} />
      {renderAssets()}
      {renderedTapToPlaceAssets}
      {renderedImageTriggeredAssets}
      {isQuest && activePlacementId && (
        <ViroText
          text={`Point and pull the trigger to place: ${
            activePlacementName ?? "object"
          }`}
          position={[0, 0.2, -2]}
          width={3}
          height={1}
          style={{
            fontFamily: "Arial",
            fontSize: 14,
            color: "#FFFFFF",
            textAlign: "center",
          }}
        />
      )}
      <StudioSounds manager={soundManagerRef.current!} />
      {assets.length === 0 && (
        <ViroText
          text={noAssetsMessage ?? "No assets to display"}
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

  // Wire the camera event when a proximity trigger needs it OR tap-to-place needs
  // the cached camera pose for headset placement — native gates the per-frame
  // transform stream on this prop being present.
  const cameraTransformProp =
    proximityBindings.length || tapToPlaceAssets.length
      ? { onCameraTransformUpdate: handleCameraTransformUpdate }
      : {};

  if (isQuest) {
    return (
      <ViroScene {...physicsProps} {...cameraTransformProp}>
        {children}
      </ViroScene>
    );
  }
  return (
    <ViroARScene
      ref={arSceneRef}
      {...physicsProps}
      {...cameraTransformProp}
      {...(anchorDetectionTypes != null ? { anchorDetectionTypes } : {})}
      onAnchorFound={handleAnchorFound}
      onAnchorUpdated={handleAnchorUpdated}
      onAnchorRemoved={handleAnchorRemoved}
    >
      {children}
    </ViroARScene>
  );
};
