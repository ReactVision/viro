import * as React from "react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { BackHandler, PermissionsAndroid } from "react-native";
import { ViroAmbientLight } from "../ViroAmbientLight";
import { ViroDirectionalLight } from "../ViroDirectionalLight";
import { ViroARImageMarker } from "../AR/ViroARImageMarker";
import { ViroARPlane } from "../AR/ViroARPlane";
import { ViroARPlaneSelector } from "../AR/ViroARPlaneSelector";
import { ViroARScene } from "../AR/ViroARScene";
import { ViroNode } from "../ViroNode";
import { ViroScene } from "../ViroScene";
import { ViroText } from "../ViroText";
import { ViroController } from "../ViroController";
import { isQuest } from "../Utilities/ViroPlatform";
import { ViroTrackingStateConstants } from "../ViroConstants";
import type {
  ViroAmbientLightInfo,
  ViroAnchor,
  ViroTrackingState,
} from "../Types/ViroEvents";
import { registerSceneAnimations } from "./domain/animationRegistry";
import { createPlacementCollisionHandler } from "./domain/collisionBindingsRuntime";
import { collisionPairKey } from "./domain/collisionPairKey";
import {
  evaluateProximityBindings,
  ProximityRuntimeState,
} from "./domain/proximityBindingsRuntime";
import {
  createGazeHandler,
  GazeRuntimeState,
  resetGazeStates,
} from "./domain/gazeBindingsRuntime";
import {
  ViroCameraTransform,
  ViroClickStateTypes,
  type ViroClickState,
} from "../Types/ViroEvents";
import { ViroEventSource, type ViroSource } from "../Types/ViroUtils";
import {
  cleanupTriggerImageTargets,
  registerTriggerImageTargets,
} from "./domain/triggerImageRegistry";
import {
  type DragSurface,
  dragSurfaceFromAnchor,
  isSameDragSurface,
} from "./domain/dragConfiguration";
import {
  createNode,
  STUDIO_TEXT_FONT_FAMILY,
} from "./domain/viroNodeFactory";
import { studioAssetPosition } from "./domain/assetPosition";
import { defaultApiRequestExecutor } from "./domain/defaultApiRequestExecutor";
import {
  executeOnLoadFunction,
  resetVideoRecordingState,
  SequenceScheduler,
} from "./domain/sceneNavigationHandler";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioVisibilityStore } from "./domain/visibilityStore";
import { StudioPlacementStore, isTapToPlaceAsset } from "./domain/placementStore";
import { StudioDragStore } from "./domain/dragStore";
import { StudioAnimationSlots } from "./domain/animationSlots";
import { isDev, type StudioEffectOrigin } from "./domain/utils";
import type { ViroARHitTestResult } from "../Types/ViroEvents";
import { StudioSoundManager } from "./domain/soundManager";
import { StudioSounds } from "./domain/StudioSounds";
import { questAlertStore } from "./domain/questAlertStore";
import { isSelectClick } from "./domain/questInput";
import {
  computeHeadLockedTransform,
  QUEST_PANEL_ORDER,
  QUEST_PANEL_SCALE,
  type CameraPose,
} from "./domain/questHeadLockedTransform";
import { StudioQuestAlertOverlay } from "./StudioQuestAlertOverlay";
import { StudioQuestSceneHudOverlay } from "./StudioQuestSceneHudOverlay";
import { StudioQuestText } from "./StudioQuestText";
import { registerStudioMaterialsForAssets } from "./domain/studioMaterials";
import {
  STUDIO_AMBIENT_INTENSITY,
  STUDIO_DIRECTIONAL_DIRECTION,
  STUDIO_DIRECTIONAL_INTENSITY,
  STUDIO_LIGHT_SCALE_STEP,
  studioLightScale,
} from "./domain/studioLighting";
import { useStudioShaderTimeUniforms } from "./domain/useStudioShaderTimeUniforms";
import { useStudioShaderViewportUniforms } from "./domain/useStudioShaderViewportUniforms";
import {
  buildViroPhysicsWorld,
  parsePhysicsWorldConfig,
} from "./domain/physicsConfig";
import {
  STUDIO_COLOCATION_OFF_FRAME,
  type StudioColocationController,
  type StudioColocationFrame,
  studioSceneRootsInAR,
} from "./colocation/controller";
import {
  dragSurfaceFromSceneToWorld,
  fromPositionEuler,
  IDENTITY,
  invert,
  rotateDirection,
  toNodeTransform,
  transformPoint,
} from "./colocation/frameMath";
import { StudioColocationPeers } from "./colocation/StudioColocationPeers";
import { collisionBindingsRunHere } from "./colocation/sharedState";
import {
  StudioAnimation,
  StudioSceneResponse,
  ViroAnimationProp,
} from "./types";

// The native camera-transform event can fire per frame; throttle the proximity
// distance sweep to this cadence.
const PROXIMITY_EVAL_INTERVAL_MS = 100;

// Cadence for updating the Quest head-locked UI's tracked position (alert
// overlay, exit/scene-name HUD). A little slack behind actual head movement
// is imperceptible for a static panel and far cheaper than re-rendering it
// every frame.
const HEAD_LOCKED_EVAL_INTERVAL_MS = 150;

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

const subscribeToNothing = () => () => {};
const offFrame = () => STUDIO_COLOCATION_OFF_FRAME;

/**
 * A world-space placement in the frame shared content renders in, which is the
 * scene origin while shared and world otherwise.
 */
function placementInSceneFrame(
  frame: StudioColocationFrame,
  position: Vec3,
  forward?: Vec3,
  up?: Vec3
): [Vec3, Vec3 | undefined, Vec3 | undefined] {
  const m = frame.phase === "shared" ? frame.worldToScene : null;
  if (!m) return [position, forward, up];
  return [
    transformPoint(m, position),
    forward && rotateDirection(m, forward),
    up && rotateDirection(m, up),
  ];
}

/**
 * A plane-selector pick as a pose: the plane's orientation at the tapped point,
 * which is where the selector would have put its children.
 */
function selectedPlanePose(plane: ViroAnchor, tapWorld?: Vec3) {
  const pose = fromPositionEuler(plane.position, plane.rotation);
  const inverse = tapWorld ? invert(pose) : null;
  if (!tapWorld || !inverse) return pose;
  const local = transformPoint(inverse, tapWorld);
  const onSurface = transformPoint(pose, [local[0], 0, local[2]]);
  const out = [...pose];
  out[12] = onSurface[0];
  out[13] = onSurface[1];
  out[14] = onSurface[2];
  return out;
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

// AR only: if world tracking never reaches NORMAL (feature-poor room, covered
// camera), reveal content anyway after this window so it is never withheld
// indefinitely. Tunable; most sessions reach NORMAL within ~1-3s.
const TRACKING_GATE_FALLBACK_MS = 6000;
// How long a Quest plane scene waits for a plane before placing its assets as
// a NONE scene does. Granted, the room model's planes arrive within a second.
const QUEST_PLANE_WAIT_MS = 3000;
const QUEST_SPATIAL_DATA_PERMISSION = "com.oculus.permission.USE_SCENE";

type AnimOverride = {
  key: string;
  run: boolean;
  /**
   * Set on the single update that replaces a still-running animation. The
   * runtime only terminates a running one when the prop carrying the new name
   * says it is interruptible, so the flag rides here rather than coming from
   * the animation row.
   */
  interrupting?: boolean;
};

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
  /** The navigator's shared-session controller; absent renders the scene alone. */
  colocation?: StudioColocationController;
  /**
   * Set when a shared session followed another device here: that device ran
   * the scene's on_load function, and what it changed arrives as shared state.
   */
  skipOnLoadFunction?: boolean;
}

/**
 * Outer gate: keeps the hooks-bearing inner component out of the tree until
 * sceneData is available, avoiding a Rules of Hooks violation.
 */
export const StudioARScene: React.FC<StudioARSceneProps> = (props) => {
  if (!props.sceneData) {
    // Quest keeps its own root here for the reason spelled out at the main
    // return below.
    return isQuest ? (
      <ViroScene toneMappingEnabled={false} />
    ) : (
      <ViroARScene toneMappingEnabled={false} />
    );
  }
  return <StudioARSceneInner {...props} sceneData={props.sceneData} />;
};

// ─── Inner component (all hooks live here) ────────────────────────────────────

interface StudioARSceneInnerProps extends StudioARSceneProps {
  sceneData: StudioSceneResponse; // guaranteed non-null by outer gate
}

type StudioLightRigHandle = { setScale: (scale: number) => void };

/** Owns the rig's estimate scale so a light change re-renders these two alone. */
const StudioLightRig = React.forwardRef<StudioLightRigHandle>(
  function StudioLightRig(_props, ref) {
    const [scale, setScale] = useState(1);
    useImperativeHandle(ref, () => ({ setScale }), []);
    return (
      <>
        <ViroAmbientLight
          color="#ffffff"
          intensity={STUDIO_AMBIENT_INTENSITY * scale}
        />
        <ViroDirectionalLight
          color="#ffffff"
          intensity={STUDIO_DIRECTIONAL_INTENSITY * scale}
          direction={STUDIO_DIRECTIONAL_DIRECTION}
        />
      </>
    );
  }
);

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
    colocation,
    skipOnLoadFunction,
  } = props;
  const { scene, assets, animations, collision_bindings, functions } =
    sceneData;

  // ─── Shared session ───────────────────────────────────────────────────────
  // Changes a handful of times a session (phase, frame, origin), never per
  // peer or per pose, so it can be scene state.
  const colocationFrame = useSyncExternalStore(
    colocation?.subscribe ?? subscribeToNothing,
    colocation?.getFrame ?? offFrame,
    offFrame
  );
  const colocationFrameRef = useRef(colocationFrame);
  colocationFrameRef.current = colocationFrame;
  const colocationPhase = colocationFrame.phase;
  const [sceneMount] = useState(() => colocation?.claimSceneMount() ?? 0);

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
      // Dismiss any Quest in-scene alert so a torn-down scene can't leave one
      // stuck on screen for the next scene.
      questAlertStore.reset();
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

  // ─── Drag store ───────────────────────────────────────────────────────────
  // Scene-scoped: where another device in a shared session dragged an asset,
  // read by each draggable node on its own.
  const dragStoreRef = useRef<StudioDragStore | null>(null);
  if (dragStoreRef.current === null) {
    dragStoreRef.current = new StudioDragStore();
  }
  useEffect(() => {
    dragStoreRef.current?.reset();
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
  // Placements are world points outside a shared session and scene-frame
  // points inside one, so crossing that boundary drops them. Only the scene on
  // screen reseeds: the navigator's store is shared by every scene it pushed.
  const placementsSharedRef = useRef(colocationPhase === "shared");
  useEffect(() => {
    const shared = colocationPhase === "shared";
    if (placementsSharedRef.current === shared) return;
    placementsSharedRef.current = shared;
    // Scene-frame positions too. Entering has nothing to drop: the session
    // has just applied the room's drags.
    if (!shared) dragStoreRef.current?.reset();
    if (colocation && !colocation.isCurrentScene(scene.id)) return;
    placementStoreRef.current?.reseed(assets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colocationPhase]);

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

  // Position for a spatial PLAY: the target asset's mounted position, through
  // the node factory's own rule so the sound and the object agree.
  const getAssetPosition = useCallback(
    (assetId: string): [number, number, number] | undefined => {
      const a = assets.find((x) => x.id === assetId);
      return a ? studioAssetPosition(a) : undefined;
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
      dragStore: dragStoreRef.current!,
      getAssetPosition,
      colocation,
    }),
    [getAssetPosition, colocation]
  );
  const deviceRuntimeCtx = useMemo(
    () => ({ ...runtimeCtx, effectOrigin: "device" as const }),
    [runtimeCtx]
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
  const animationSlotsRef = useRef<StudioAnimationSlots | null>(null);
  if (animationSlotsRef.current === null) {
    animationSlotsRef.current = new StudioAnimationSlots();
  }
  const loadedAssetIdsRef = useRef(loadedAssetIds);
  loadedAssetIdsRef.current = loadedAssetIds;
  useEffect(() => {
    animationSlotsRef.current?.reset();
  }, [scene.id]);

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

  const notifyPhysicsDrag = useCallback(
    (assetId: string, worldPosition?: Vec3) => {
      if (worldPosition) dragStoreRef.current?.moved(assetId, worldPosition);
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
    },
    []
  );

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

  // Returns false when the scene has no such animation.
  const startAnimation = useCallback(
    (
      targetAssetId: string,
      animationKey: string,
      origin: StudioEffectOrigin
    ) => {
      const requested = animations.find(
        (a) =>
          a.target_asset_id === targetAssetId &&
          a.animation_key === animationKey
      );
      if (!requested) return false;

      const play = animationSlotsRef.current!.request(
        requested,
        !!loadedAssetIdsRef.current[targetAssetId],
        origin
      );
      if (play === "queued") return true;
      if (play === "interrupt") {
        // Sent as a single update with `run` still true: the runtime only
        // terminates a running animation inside `playAnimation`, which a
        // false→true pair never reaches because the false half pauses it
        // first, and a paused animation resumes whatever it already holds
        // however the name changed.
        setAnimOverrides((prev) => ({
          ...prev,
          [targetAssetId]: { key: animationKey, run: true, interrupting: true },
        }));
        return true;
      }

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
      return true;
    },
    [animations]
  );

  const startAnimationRef = useRef(startAnimation);
  startAnimationRef.current = startAnimation;

  // A trigger on this device, which a shared session repeats on the others.
  const triggerAnimation = useCallback(
    (targetAssetId: string, animationKey: string) => {
      if (startAnimation(targetAssetId, animationKey, "local")) {
        colocation?.shareAnimation(scene.id, targetAssetId, animationKey);
      }
    },
    [startAnimation, colocation, scene.id]
  );

  const triggerAnimationRef = useRef(triggerAnimation);
  triggerAnimationRef.current = triggerAnimation;

  // What an animation's on_start and on_finish dispatch with: a `device` play
  // keeps what they cause on this device too.
  const effectChain = useCallback(
    (origin: StudioEffectOrigin) =>
      origin === "device"
        ? {
            trigger: (id: string, key: string) =>
              startAnimationRef.current(id, key, "device"),
            ctx: deviceRuntimeCtx,
          }
        : {
            trigger: (id: string, key: string) =>
              triggerAnimationRef.current(id, key),
            ctx: runtimeCtx,
          },
    [runtimeCtx, deviceRuntimeCtx]
  );

  const handleAnimationFinished = useCallback(
    (assetId: string, anim: StudioAnimation) => {
      // The runtime loops by replaying the whole animation, so it reports a
      // finish at every cycle boundary. A loop has not finished: firing
      // on_finish there repeats a chained function for as long as the loop runs,
      // and the editor fires it only when an animation ends.
      if (anim.loop) return;
      const slots = animationSlotsRef.current!;
      const chain = effectChain(slots.origin(assetId));
      if (slots.finish(assetId) && anim.on_finish_function) {
        executeOnLoadFunction(
          anim.on_finish_function,
          functions,
          sceneNavigator,
          animations,
          chain.trigger,
          handleSceneChange,
          chain.ctx
        );
      }
      // on_finish runs first, so an animation it chains holds the slot and this
      // one waits behind it rather than cutting it off. A queued play was shared
      // when it was triggered, so it starts without being shared again.
      const next = slots.next(assetId);
      if (next) startAnimationRef.current(assetId, next.key, next.origin);
    },
    [functions, sceneNavigator, animations, handleSceneChange, effectChain]
  );

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
        // MODEL_CLIP resolves against the clip baked into the model file (by its
        // embedded name); PROPERTY resolves against the registered ViroAnimations key.
        name:
          activeAnim.animation_source === "MODEL_CLIP" && activeAnim.clip_name
            ? activeAnim.clip_name
            : activeAnim.animation_key,
        run,
        loop: activeAnim.loop,
        interruptible: activeAnim.interruptible || !!override?.interrupting,
        delay: activeAnim.delay_ms ?? 0,
        onStart: activeAnim.on_start_function
          ? () => {
              // Once per play, not once per loop cycle: the runtime reports a
              // start on every replay, and the editor fires it once.
              const slots = animationSlotsRef.current!;
              if (!slots.runsOnStart(assetId)) return;
              const chain = effectChain(slots.origin(assetId));
              executeOnLoadFunction(
                activeAnim.on_start_function!,
                functions,
                sceneNavigator,
                animations,
                chain.trigger,
                handleSceneChange,
                chain.ctx
              );
            }
          : undefined,
        // Always wired: it carries the author's on_finish and it is also what
        // releases an animation waiting for this one.
        onFinish: () => handleAnimationFinished(assetId, activeAnim),
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
    handleAnimationFinished,
    effectChain,
  ]);

  // ─── Shared session attach ────────────────────────────────────────────────
  // After every per-scene reset above (stores, sounds, animation slots), so a
  // shared session's rows and the events it held for this scene land on them
  // rather than being reset by them, and before on_load, whose effects the
  // session shares as this scene's.
  useEffect(() => {
    if (!colocation) return;
    const stores = {
      variables: variableStoreRef.current!,
      visibility: visibilityStoreRef.current!,
      placement: placementStoreRef.current!,
      drags: dragStoreRef.current!,
      sounds: soundManagerRef.current!,
    };
    colocation.attachScene(
      sceneData,
      stores,
      {
        playAnimation: (assetId, key) =>
          startAnimationRef.current(assetId, key, "remote"),
        leave: () => schedulerRef.current?.cancelAll(),
      },
      sceneMount
    );
    return () => colocation.detachScene(stores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colocation, scene.id]);

  // ─── on_load_function ─────────────────────────────────────────────────────
  const onLoadExecutedRef = useRef(false);
  useEffect(() => {
    if (
      scene.on_load_function &&
      !onLoadExecutedRef.current &&
      !skipOnLoadFunction
    ) {
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

  // Image-triggered content sits on each device's own marker rather than in
  // the shared frame, so its contacts are that device's and run there, and
  // the sounds and animations they cause are not shared: every device that
  // sees the marker has the same contact.
  const getCollisionHandler = useCallback(
    (placementId: string, inSharedFrame = true) => {
      if (!collisionAssetIds.has(placementId)) return undefined;
      const chain = effectChain(inSharedFrame ? "local" : "device");
      return createPlacementCollisionHandler(
        placementId,
        bindingsByPairKey,
        sceneNavigator,
        animations,
        collisionCooldownRef,
        chain.trigger,
        handleSceneChange,
        chain.ctx,
        inSharedFrame
          ? () => collisionBindingsRunHere(colocationFrameRef.current)
          : undefined
      );
    },
    [
      bindingsByPairKey,
      collisionAssetIds,
      sceneNavigator,
      animations,
      handleSceneChange,
      effectChain,
    ]
  );

  // ─── Gaze bindings (On Gaze) ──────────────────────────────────────────────
  // Headset eye-gaze only. The target node's native onGaze reports isHovering;
  // a dwell + hysteresis/fire_mode state machine (gazeBindingsRuntime) fires the
  // bound function. Attached only on Quest — on mobile AR the handler isn't wired,
  // so a scene carrying On Gaze loads and runs, the trigger just never fires.
  const gazeBindings = useMemo(
    () => sceneData.gaze_bindings ?? [],
    [sceneData]
  );
  const gazeBindingsByAsset = useMemo(() => {
    const map = new Map<string, typeof gazeBindings>();
    for (const b of gazeBindings) {
      const list = map.get(b.target_asset_id);
      if (list) list.push(b);
      else map.set(b.target_asset_id, [b]);
    }
    return map;
  }, [gazeBindings]);

  const gazeStateRef = useRef<Map<string, GazeRuntimeState>>(new Map());
  useEffect(() => {
    resetGazeStates(gazeStateRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);
  useEffect(() => () => resetGazeStates(gazeStateRef), []);

  const getGazeHandler = useCallback(
    (assetId: string) => {
      if (!isQuest) return undefined;
      const bindings = gazeBindingsByAsset.get(assetId);
      if (!bindings?.length) return undefined;
      return createGazeHandler(
        bindings,
        {
          sceneNavigator,
          animations,
          onSceneChange: handleSceneChange,
          onAnimationTrigger: (id, key) => triggerAnimationRef.current(id, key),
          runtimeCtx,
        },
        gazeStateRef
      );
    },
    [
      gazeBindingsByAsset,
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
    up: [number, number, number];
  } | null>(null);

  // Throttled *state* mirror of cameraPoseRef, Quest-only: head-locked UI
  // (StudioQuestAlertOverlay) needs to re-render as the head moves, which a
  // ref alone can't trigger.
  const [questHeadLockedPose, setQuestHeadLockedPose] =
    useState<CameraPose | null>(null);
  const lastHeadLockedEvalRef = useRef(0);

  // The controller reports every button to its one delegate, and a second
  // ViroController would replace this one's, so the menu button is read here.
  const [questMenuOpen, setQuestMenuOpen] = useState(false);
  const closeQuestMenu = useCallback(() => setQuestMenuOpen(false), []);
  const handleQuestControllerClickState = useCallback(
    (state: ViroClickState, _position: unknown, source: ViroSource) => {
      if (
        state === ViroClickStateTypes.CLICK_DOWN &&
        (source as unknown as number) === ViroEventSource.MENU_BUTTON
      ) {
        setQuestMenuOpen((open) => !open);
      }
    },
    []
  );

  // B closes the menu before it exits. The listener exists only while the
  // menu is open because the newest one is called first, and React runs a
  // child's effects before its parent's: added as the scene mounts, it could
  // be older than ViroQuestEntryPoint's, which exits.
  useEffect(() => {
    if (!questMenuOpen) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setQuestMenuOpen(false);
        return true;
      }
    );
    return () => subscription.remove();
  }, [questMenuOpen]);

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

  // Quest: each asset's prompt is placed in front of the wearer when it
  // appears, and stays there. Placed while rendering, as the HUD is, so it
  // never draws a frame at the previous asset's spot.
  const [questPromptPlacement, setQuestPromptPlacement] = useState<{
    assetId: string;
    pose: CameraPose;
  } | null>(null);
  if (
    isQuest &&
    activePlacementId &&
    questHeadLockedPose &&
    questPromptPlacement?.assetId !== activePlacementId
  ) {
    setQuestPromptPlacement({
      assetId: activePlacementId,
      pose: questHeadLockedPose,
    });
  }
  const questPromptTransform =
    isQuest &&
    activePlacementId &&
    questPromptPlacement?.assetId === activePlacementId
      ? computeHeadLockedTransform(questPromptPlacement.pose, {
          distanceM: 2,
        })
      : null;

  const lastProximityEvalRef = useRef(0);
  const handleCameraTransformUpdate = useCallback(
    (t: ViroCameraTransform) => {
      cameraPoseRef.current = {
        position: t.position,
        forward: t.forward,
        up: t.up,
      };
      colocation?.publishCameraPose(t.position, t.forward, t.up);
      if (isQuest) {
        const nowHL = Date.now();
        if (nowHL - lastHeadLockedEvalRef.current >= HEAD_LOCKED_EVAL_INTERVAL_MS) {
          lastHeadLockedEvalRef.current = nowHL;
          setQuestHeadLockedPose({
            position: t.position,
            forward: t.forward,
            up: t.up,
          });
        }
      }
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
    [
      proximityBindings,
      sceneNavigator,
      animations,
      handleSceneChange,
      runtimeCtx,
      colocation,
    ]
  );

  // Mobile AR: hit-test the tapped screen point and place the active asset on the
  // best real surface. Returns "miss" when nothing usable is under the tap so the
  // overlay can prompt the user to scan more of the space.
  const placeAtScreenPoint = useCallback(
    async (x: number, y: number): Promise<"placed" | "miss"> => {
      const store = placementStoreRef.current;
      const activeId = store?.activeAssetId();
      if (!store || !activeId || !arSceneRef.current) return "miss";
      // Content is withheld until the shared origin exists, so there is
      // nothing a placement could land in yet.
      if (colocationFrameRef.current.phase === "pending") return "miss";
      let results: ViroARHitTestResult[] = [];
      try {
        results = await arSceneRef.current.performARHitTestWithPoint(x, y);
      } catch {
        return "miss";
      }
      const best = pickBestHit(results);
      if (!best) return "miss";
      store.place(
        activeId,
        ...placementInSceneFrame(
          colocationFrameRef.current,
          best.transform.position as Vec3,
          cameraPoseRef.current?.forward,
          cameraPoseRef.current?.up
        )
      );
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
    if (colocationFrameRef.current.phase === "pending") return;
    const pos = isUsablePoint(hitPosition)
      ? hitPosition
      : projectAlongCameraForward(cameraPoseRef.current);
    if (!pos) return;
    store.place(
      activeId,
      ...placementInSceneFrame(
        colocationFrameRef.current,
        pos,
        cameraPoseRef.current?.forward,
        cameraPoseRef.current?.up
      )
    );
  }, []);

  // ─── Trigger image targets ────────────────────────────────────────────────
  // Three groups: image-triggered (anchored to a tracked image), tap-to-place
  // (withheld until the user places them at scene root), and the rest (plane
  // assets, rendered inside the plane wrapper). Image triggering wins over
  // tap-to-place since a marker already dictates the anchor.
  const { planeAssets, imageTriggeredAssets, tapToPlaceAssets } = useMemo(() => {
    const imgTriggered = assets.filter((a) => !!a.trigger_image_url);
    const tapToPlace = assets.filter((a) => isTapToPlaceAsset(a));
    const plane = assets.filter((a) => !a.trigger_image_url && !a.tap_to_place);
    return {
      planeAssets: plane,
      imageTriggeredAssets: imgTriggered,
      tapToPlaceAssets: tapToPlace,
    };
  }, [assets]);

  const [targetNameByAssetId, setTargetNameByAssetId] = useState<
    Map<string, string>
  >(() => new Map());
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
      setTargetNameByAssetId(new Map());
      return;
    }
    const map = registerTriggerImageTargets(imageTriggeredAssets);
    // Assets sharing a picture share a target name, so delete each one once.
    const targetNames = [...new Set(map.values())];
    if (isDev()) {
      console.log(
        `[Studio] Registered ${targetNames.length} trigger target(s) for ${imageTriggeredAssets.length} placement(s): ${targetNames.join(", ")}`
      );
    }
    prevTargetNamesRef.current = targetNames;
    setTargetNameByAssetId(map);
    return () => {
      cleanupTriggerImageTargets(targetNames);
      prevTargetNamesRef.current = [];
    };
  }, [imageTriggeredAssets]);

  // ─── Tracking-readiness gate (AR, plane_detection=NONE only) ──────────────
  // NONE assets sit at fixed scene-root coords with no anchor, so mounting them
  // before the world origin is locked lets them ride tracking drift ("objects
  // move with the phone"). Withhold them until tracking first hits NORMAL: their
  // positions then commit against a stable origin and, on Android, the bridge's
  // per-node auto-anchor (VRTNode.onTreeUpdate → createAnchoredNode) can acquire
  // an anchor instead of failing during the not-yet-tracking window. The camera
  // shows at mount (onReady fires there); only 3D content waits. Quest and the
  // plane-anchored modes (AUTOMATIC/MANUAL) are drift-immune, so they start ready.
  const [trackingReady, setTrackingReady] = useState(
    () =>
      isQuest ||
      ((scene.plane_detection as string) ?? "NONE").toUpperCase() !== "NONE"
  );

  const handleTrackingUpdated = useCallback((state: ViroTrackingState) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      setTrackingReady(true);
    }
  }, []);

  // ─── Rig scale from the room ──────────────────────────────────────────────
  // The estimate arrives on every rendered frame, so it goes to the rig's own
  // component rather than into state here, where a render rebuilds every asset
  // node, and only once it has moved enough to see. Quest and web never call
  // this and render the rig as authored.
  const lightRigRef = useRef<StudioLightRigHandle | null>(null);
  const lightScaleRef = useRef(1);

  const handleAmbientLightUpdate = useCallback((info: ViroAmbientLightInfo) => {
    const scale = studioLightScale(info?.intensity);
    if (Math.abs(scale - lightScaleRef.current) < STUDIO_LIGHT_SCALE_STEP) {
      return;
    }
    lightScaleRef.current = scale;
    lightRigRef.current?.setScale(scale);
  }, []);

  useEffect(() => {
    if (trackingReady) return;
    const timer = setTimeout(
      () => setTrackingReady(true),
      TRACKING_GATE_FALLBACK_MS
    );
    return () => clearTimeout(timer);
  }, [trackingReady]);

  // ─── Ready callback ───────────────────────────────────────────────────────
  // Fires at mount so the navigator reveals the camera immediately; only the
  // NONE-mode 3D content is held back (above), never the live camera feed.
  useEffect(() => {
    onReady?.();
  }, []);

  // ─── Drag surface ─────────────────────────────────────────────────────────
  // A FixedToPlane drag is confined to a world plane, so a draggable asset
  // needs the plane its anchor actually found: guessing an axis from
  // plane_direction drags content off any wall not facing world Z. Only the
  // plane-wrapped assets are anchored to it, and only their own anchor will do,
  // since a scene can detect several walls at once.
  const hasPlaneDrag = useMemo(
    () => planeAssets.some((asset) => asset.is_draggable),
    [planeAssets]
  );
  const [dragSurface, setDragSurface] = useState<DragSurface | null>(null);
  const selectedAnchorIdRef = useRef<string | null>(null);

  const trackDragSurface = useCallback(
    (anchor: ViroAnchor) => {
      if (!hasPlaneDrag || !anchor?.position || !anchor?.rotation) return;
      const next = dragSurfaceFromAnchor(anchor.position, anchor.rotation);
      // The session refines a plane continuously, mostly by sliding the anchor
      // around inside the surface, which does not move the plane at all. Keep
      // the previous object in that case or every update re-renders the scene.
      setDragSurface((prev) =>
        prev && isSameDragSurface(prev, next) ? prev : next
      );
    },
    [hasPlaneDrag]
  );

  useEffect(() => {
    setDragSurface(null);
    selectedAnchorIdRef.current = null;
  }, [scene.id]);

  // Shared content sits on the origin, not on a plane anchor, and the origin
  // keeps the picked plane's orientation, so its +Y is the surface to drag on.
  const sharedSceneToWorld =
    colocationPhase === "shared" ? colocationFrame.sceneToWorld : null;
  const sharedDragSurface = useMemo(
    () =>
      hasPlaneDrag && sharedSceneToWorld
        ? dragSurfaceFromSceneToWorld(sharedSceneToWorld)
        : null,
    [hasPlaneDrag, sharedSceneToWorld]
  );
  const effectiveDragSurface =
    colocationPhase === "shared" ? sharedDragSurface : dragSurface;

  // ─── Render helpers ───────────────────────────────────────────────────────
  const renderedPlaneAssets = useMemo(() => {
    return planeAssets
      .map((asset) =>
        createNode(
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
          proximityTargetIds.has(asset.id)
            ? registerProximityTarget
            : undefined,
          getGazeHandler(asset.id),
          effectiveDragSurface
        )
      )
      .filter(Boolean) as React.ReactElement[];
  }, [
    planeAssets,
    effectiveDragSurface,
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
    getGazeHandler,
  ]);

  // Tap-to-place nodes render at the scene root (world space), or under the
  // shared origin while shared; each is gated by the placement store (null
  // until placed, then mounted at the placed point in that frame).
  const renderedTapToPlaceAssets = useMemo(() => {
    return tapToPlaceAssets
      .map((asset) =>
        createNode(
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
          proximityTargetIds.has(asset.id)
            ? registerProximityTarget
            : undefined,
          getGazeHandler(asset.id)
        )
      )
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
    handleSceneChange,
    runtimeCtx,
    proximityTargetIds,
    registerProximityTarget,
    getGazeHandler,
  ]);

  // One marker per target, carrying every asset on that image. The renderer
  // attaches a detected anchor to a single marker node, so a second marker on
  // the same target stays detached and its assets never appear.
  const renderedImageTriggeredAssets = useMemo(() => {
    if (isQuest) return [];
    const nodesByTarget = new Map<string, React.ReactElement[]>();
    for (const asset of imageTriggeredAssets) {
      const targetName = targetNameByAssetId.get(asset.id);
      if (!targetName) continue;
      const node = createNode(
        asset,
        sceneNavigator,
        animations,
        scene,
        (id, key) => triggerAnimationRef.current(id, key),
        animationStates,
        handleAssetLoaded,
        getCollisionHandler(asset.id, false),
        isDragActive,
        notifyPhysicsDrag,
        handleSceneChange,
        runtimeCtx,
        proximityTargetIds.has(asset.id) ? registerProximityTarget : undefined,
        getGazeHandler(asset.id)
      );
      if (!node) continue;
      const nodes = nodesByTarget.get(targetName);
      if (nodes) nodes.push(node);
      else nodesByTarget.set(targetName, [node]);
    }
    return [...nodesByTarget].map(([targetName, nodes]) => (
      <ViroARImageMarker
        key={targetName}
        target={targetName}
        // Whether the tracker ever recognised the picture is otherwise
        // invisible, and it is the first thing to establish when content does
        // not appear on a marker. The native side emits this event either way.
        onAnchorFound={
          isDev()
            ? () =>
                console.log(
                  `[Studio] Trigger image "${targetName}" found, ${nodes.length} placement(s) on it`
                )
            : undefined
        }
      >
        {nodes}
      </ViroARImageMarker>
    ));
  }, [
    targetNameByAssetId,
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
    getGazeHandler,
  ]);

  // ─── Plane detection (AR only) ────────────────────────────────────────────
  const planeDetectionMode = (
    (scene.plane_detection as string) ?? "NONE"
  ).toUpperCase();
  // The Quest room model reports a ceiling as a downward-facing horizontal
  // plane, which "Horizontal" matches too.
  const planeDirection = scene.plane_direction ?? "Horizontal";
  const planeAlignment = (
    isQuest && planeDirection === "Horizontal"
      ? "HorizontalUpward"
      : planeDirection
  ) as any;

  // On Quest the planes are the room model from Space Setup, which needs the
  // spatial data permission. Without it there are none, so the scene keeps the
  // ViroScene root and places its assets as a NONE scene does. Null until the
  // check answers.
  const wantsQuestPlanes =
    isQuest &&
    (planeDetectionMode === "AUTOMATIC" || planeDetectionMode === "MANUAL");
  const [questSpatialData, setQuestSpatialData] = useState<boolean | null>(
    wantsQuestPlanes ? null : false
  );
  useEffect(() => {
    if (!wantsQuestPlanes) return;
    let live = true;
    PermissionsAndroid.check(QUEST_SPATIAL_DATA_PERMISSION as any).then(
      (granted) => {
        if (live) setQuestSpatialData(granted);
      },
      () => {
        if (live) setQuestSpatialData(false);
      }
    );
    return () => {
      live = false;
    };
  }, [wantsQuestPlanes]);

  // ViroARPlane and ViroARPlaneSelector need an AR root: under the ViroScene
  // root Quest uses outside a shared session, the Android bridge casts the
  // plane's scene to VRTARScene and the app crashes as the plane mounts.
  const rootsInAR = studioSceneRootsInAR(
    colocationFrame,
    sceneMount,
    isQuest,
    questSpatialData === true
  );

  // A room without Space Setup has no planes, so on Quest assets still waiting
  // for one are placed as a NONE scene's are after QUEST_PLANE_WAIT_MS. Kept
  // once it fires, so a late plane does not move them.
  const [questPlaneFound, setQuestPlaneFound] = useState(false);
  const [questPlaneFallback, setQuestPlaneFallback] = useState(false);
  useEffect(() => {
    if (questSpatialData !== true || questPlaneFound) return;
    const timer = setTimeout(
      () => setQuestPlaneFallback(true),
      QUEST_PLANE_WAIT_MS
    );
    return () => clearTimeout(timer);
  }, [questSpatialData, questPlaneFound]);
  const [questPlaneSelected, setQuestPlaneSelected] = useState(false);

  // Native plane anchor types for ViroARScene. NONE must pass [] explicitly
  // (empty disables plane finding): omitting the prop keeps the native default
  // of horizontal + vertical, scanning for planes the scene never uses.
  // Exception: tap-to-place placement runs surface hit tests, which return no
  // plane results while detection is off — keep the native default on when the
  // scene has any tap-to-place asset.
  //
  // In a shared session the plane mode only picks the host's origin, so its
  // planes are looked for until then and never on a joiner.
  const detectsScenePlanes =
    (planeDetectionMode === "AUTOMATIC" || planeDetectionMode === "MANUAL") &&
    (colocationPhase === "off" || colocationFrame.needsOrigin);
  const anchorDetectionTypes = useMemo((): string[] => {
    if (!detectsScenePlanes) {
      return tapToPlaceAssets.length
        ? ["planesHorizontal", "planesVertical"]
        : [];
    }
    const dir = (scene.plane_direction ?? "Horizontal").toLowerCase();
    if (dir === "vertical") return ["planesVertical"];
    if (dir.includes("horizontal")) return ["planesHorizontal"];
    return ["planesHorizontal", "planesVertical"];
  }, [detectsScenePlanes, scene.plane_direction, tapToPlaceAssets]);

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
          if (anchor?.anchorId === selectedAnchorIdRef.current) {
            trackDragSurface(anchor);
          }
        }
        refreshAllTargetTransforms();
      } catch (error) {
        console.error("[Studio] handleAnchorUpdated failed:", error);
      }
    },
    [planeDetectionMode, refreshAllTargetTransforms, trackDragSurface]
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

  const handlePlaneSelected = useCallback(
    (plane: ViroAnchor) => {
      selectedAnchorIdRef.current = plane?.anchorId ?? null;
      if (isQuest) setQuestPlaneSelected(true);
      trackDragSurface(plane);
      onPlaneSelected?.();
    },
    [onPlaneSelected, trackDragSurface]
  );

  // ViroARPlaneSelector.onPlaneDetected must return a boolean (accept the plane).
  const handlePlaneDetectedForSelector = useCallback(() => {
    if (isQuest) setQuestPlaneFound(true);
    onPlaneDetected?.();
    return true;
  }, [onPlaneDetected]);

  // Only a plane the wrapper accepts counts: the scene's own onAnchorFound
  // also hears walls and ceilings the alignment rules out.
  const handleWrapperAnchorFound = useCallback(
    (anchor: ViroAnchor) => {
      if (isQuest) setQuestPlaneFound(true);
      trackDragSurface(anchor);
    },
    [trackDragSurface]
  );

  // The scene origin is fixed in the room and can be out of view, and the
  // host's 2D guidance cannot be seen in the headset, so on Quest these are
  // placed in front of the wearer when they appear, as the placement prompt is.
  const questNotice = !isQuest
    ? null
    : assets.length === 0
      ? noAssetsMessage ?? "No assets to display"
      : rootsInAR &&
          colocationPhase === "off" &&
          planeDetectionMode === "MANUAL" &&
          questPlaneFound &&
          !questPlaneSelected &&
          !questPlaneFallback
        ? "Point at a surface and pull the trigger to place the scene"
        : null;
  const [questNoticePlacement, setQuestNoticePlacement] = useState<{
    text: string;
    pose: CameraPose;
  } | null>(null);
  if (
    questNotice &&
    questHeadLockedPose &&
    questNoticePlacement?.text !== questNotice
  ) {
    setQuestNoticePlacement({ text: questNotice, pose: questHeadLockedPose });
  } else if (!questNotice && questNoticePlacement) {
    setQuestNoticePlacement(null);
  }
  const questNoticeTransform =
    questNotice && questNoticePlacement?.text === questNotice
      ? computeHeadLockedTransform(questNoticePlacement.pose, { distanceM: 2 })
      : null;

  // ─── Shared origin (host) ─────────────────────────────────────────────────
  // The host places the scene the way it was authored, and that pose becomes
  // everyone's origin: the world origin for NONE, the first plane for
  // AUTOMATIC, the selected plane at the tapped point for MANUAL.
  const needsOrigin = colocationFrame.needsOrigin;
  useEffect(() => {
    if (needsOrigin && planeDetectionMode === "NONE") {
      colocation?.proposeOrigin(IDENTITY);
    }
  }, [needsOrigin, planeDetectionMode, colocation]);

  const proposePlaneOrigin = useCallback(
    (anchor: ViroAnchor) => {
      if (!anchor?.position || !anchor?.rotation) return;
      colocation?.proposeOrigin(
        fromPositionEuler(anchor.position, anchor.rotation)
      );
    },
    [colocation]
  );

  const handleOriginPlaneSelected = useCallback(
    (plane: ViroAnchor, tapPosition?: Vec3) => {
      handlePlaneSelected(plane);
      if (!plane?.position || !plane?.rotation) return;
      colocation?.proposeOrigin(selectedPlanePose(plane, tapPosition));
    },
    [handlePlaneSelected, colocation]
  );

  // Detection only, at the scene root: a plane anchor writes its world pose
  // into its node's local transform, so it can never sit inside the shared
  // (transformed) nodes.
  const renderOriginPicker = () => {
    if (!rootsInAR) return null;
    if (planeDetectionMode === "AUTOMATIC") {
      return (
        <ViroARPlane
          minHeight={0.1}
          minWidth={0.1}
          alignment={planeAlignment}
          onAnchorFound={proposePlaneOrigin}
        />
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
          onPlaneSelected={handleOriginPlaneSelected}
        />
      );
    }
    return null;
  };

  const sharedNodes = useMemo(() => {
    const { location, origin } = colocationFrame;
    if (colocationPhase !== "shared" || !location || !origin) return null;
    return {
      location: toNodeTransform(location),
      origin: toNodeTransform(origin),
    };
  }, [colocationFrame, colocationPhase]);

  const renderSharedContent = () => {
    if (!sharedNodes || !colocation) return null;
    return (
      <ViroNode
        position={sharedNodes.location.position}
        rotation={sharedNodes.location.rotation}
        scale={sharedNodes.location.scale}
      >
        {/* Scenes under a push stay mounted; only the one on screen polls. */}
        {colocationFrame.sceneId === scene.id && (
          <StudioColocationPeers readPeers={colocation.readPeers} />
        )}
        <ViroNode
          position={sharedNodes.origin.position}
          rotation={sharedNodes.origin.rotation}
        >
          {trackingReady && renderedPlaneAssets}
          {renderedTapToPlaceAssets}
        </ViroNode>
      </ViroNode>
    );
  };

  // A plane-mode scene under the ViroScene root renders its assets the way a
  // NONE scene does, at the scene root.
  const renderAssets = () => {
    if (!rootsInAR || questPlaneFallback) return <>{renderedPlaneAssets}</>;
    if (planeDetectionMode === "AUTOMATIC") {
      return (
        <ViroARPlane
          minHeight={0.1}
          minWidth={0.1}
          alignment={planeAlignment}
          onAnchorFound={handleWrapperAnchorFound}
          onAnchorUpdated={trackDragSurface}
        >
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
          onClickState={handleQuestControllerClickState}
          {...(activePlacementId
            ? {
                // The controller also hears clicks on a panel's items, and
                // reports them before the item does.
                onClick: (
                  position: [number, number, number],
                  source: ViroSource
                ) => {
                  if (
                    !isSelectClick(source) ||
                    questMenuOpen ||
                    questAlertStore.isActive()
                  )
                    return;
                  handleHeadsetPlaceTrigger(position);
                },
              }
            : {})}
        />
      )}
      <StudioLightRig ref={lightRigRef} />
      {colocationPhase === "off" && trackingReady && renderAssets()}
      {colocationPhase === "off" && renderedTapToPlaceAssets}
      {needsOrigin && renderOriginPicker()}
      {renderSharedContent()}
      {renderedImageTriggeredAssets}
      {questPromptTransform && (
        <ViroNode
          position={questPromptTransform.position}
          rotation={questPromptTransform.rotation}
          scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
        >
          <StudioQuestText
            text={`Point and pull the trigger to place: ${
              activePlacementName ?? "object"
            }`}
            position={[0, 0, 0]}
            width={3}
            height={1}
            fontSize={14}
            renderingOrder={QUEST_PANEL_ORDER.prompt + 2}
            depthPlate
            style={{
              fontFamily: STUDIO_TEXT_FONT_FAMILY,
              color: "#FFFFFF",
              textAlign: "center",
              textAlignVertical: "center",
            }}
          />
        </ViroNode>
      )}
      {isQuest && <StudioQuestAlertOverlay cameraPose={questHeadLockedPose} />}
      {isQuest && (
        <StudioQuestSceneHudOverlay
          cameraPose={questHeadLockedPose}
          sceneName={scene.name}
          menuOpen={questMenuOpen}
          onCloseMenu={closeQuestMenu}
          promptShown={
            questPromptTransform !== null || questNoticeTransform !== null
          }
        />
      )}
      <StudioSounds manager={soundManagerRef.current!} />
      {questNoticeTransform && questNotice && (
        <ViroNode
          position={questNoticeTransform.position}
          rotation={questNoticeTransform.rotation}
          scale={[QUEST_PANEL_SCALE, QUEST_PANEL_SCALE, QUEST_PANEL_SCALE]}
        >
          <StudioQuestText
            text={questNotice}
            position={[0, 0, 0]}
            width={3}
            height={1}
            fontSize={16}
            renderingOrder={QUEST_PANEL_ORDER.prompt + 2}
            depthPlate
            style={{
              fontFamily: STUDIO_TEXT_FONT_FAMILY,
              color: "#CCCCCC",
              textAlign: "center",
              textAlignVertical: "center",
            }}
          />
        </ViroNode>
      )}
      {assets.length === 0 && !isQuest && (
        <ViroText
          text={noAssetsMessage ?? "No assets to display"}
          position={[0, 0, -2]}
          style={{
            fontFamily: STUDIO_TEXT_FONT_FAMILY,
            fontSize: 16,
            color: "#CCCCCC",
            textAlign: "center",
          }}
        />
      )}
    </>
  );

  // Wire the camera event when a proximity trigger needs it, tap-to-place needs
  // the cached camera pose for headset placement, or we're on Quest (head-locked
  // UI — alert overlay, exit/scene-name HUD — needs a live pose to track) —
  // native gates the per-frame transform stream on this prop being present.
  // A shared session publishes this device's pose from it.
  const cameraTransformProp =
    isQuest ||
    proximityBindings.length ||
    tapToPlaceAssets.length ||
    colocationPhase === "shared"
      ? { onCameraTransformUpdate: handleCameraTransformUpdate }
      : {};

  // Quest mounts ViroScene, not the ViroARScene below, and that is a decision
  // rather than an oversight — it was made when this branch and the passthrough
  // prop met in a merge, so here is what each one buys.
  //
  // ViroXRSceneNavigator's contract is that a ViroScene root is fully-virtual VR
  // and a ViroARScene root is mixed reality, which turns passthrough on by itself
  // and hands the room's planes (Space Setup's room model, through XR_FB_scene)
  // to onAnchorFound and ViroARPlane. Passthrough is not what is lost by keeping
  // ViroScene: StudioSceneNavigator asks for it outright with
  // `passthroughEnabled` on Quest, which reaches VRActivity through the
  // navigator bridge and does not depend on the root at all.
  //
  // Plane anchors are, so a plane-mode scene takes the AR root when the wearer
  // has granted spatial data, and falls back to the scene root as a NONE scene
  // does when no plane arrives (QUEST_PLANE_WAIT_MS). The ref that drives
  // tap-to-place hit testing is null on Quest either way.
  //
  // The scene on screen during a shared session is the other exception
  // (studioSceneRootsInAR). Its content sits in the shared frame rather than on
  // planes, so the AR root changes nothing it renders, and the scene returns to
  // ViroScene when the session ends. Changing the root remounts everything
  // below it, which is the cost the `colocation` prop doc states.
  // Briefly, until the spatial data check answers, so the assets mount once
  // under the root they keep.
  if (questSpatialData === null) {
    return <ViroScene toneMappingEnabled={false} />;
  }
  if (!rootsInAR) {
    return (
      <ViroScene
        {...physicsProps}
        {...cameraTransformProp}
        toneMappingEnabled={false}
      >
        {children}
      </ViroScene>
    );
  }
  return (
    <ViroARScene
      ref={arSceneRef}
      // The editor previews no tone curve, and virocore's default Hable
      // luminance-only pass renders pure white at about 0.77. Off here rather
      // than via the navigator's `hdrEnabled`, which would take PBR with it.
      toneMappingEnabled={false}
      {...physicsProps}
      {...cameraTransformProp}
      anchorDetectionTypes={anchorDetectionTypes}
      onTrackingUpdated={handleTrackingUpdated}
      onAmbientLightUpdate={handleAmbientLightUpdate}
      onAnchorFound={handleAnchorFound}
      onAnchorUpdated={handleAnchorUpdated}
      onAnchorRemoved={handleAnchorRemoved}
    >
      {children}
    </ViroARScene>
  );
};
