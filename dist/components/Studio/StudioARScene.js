"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioARScene = void 0;
const React = __importStar(require("react"));
const react_1 = require("react");
const ViroAmbientLight_1 = require("../ViroAmbientLight");
const ViroDirectionalLight_1 = require("../ViroDirectionalLight");
const ViroARImageMarker_1 = require("../AR/ViroARImageMarker");
const ViroARPlane_1 = require("../AR/ViroARPlane");
const ViroARPlaneSelector_1 = require("../AR/ViroARPlaneSelector");
const ViroARScene_1 = require("../AR/ViroARScene");
const ViroNode_1 = require("../ViroNode");
const ViroScene_1 = require("../ViroScene");
const ViroText_1 = require("../ViroText");
const ViroController_1 = require("../ViroController");
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
const ViroConstants_1 = require("../ViroConstants");
const animationRegistry_1 = require("./domain/animationRegistry");
const collisionBindingsRuntime_1 = require("./domain/collisionBindingsRuntime");
const collisionPairKey_1 = require("./domain/collisionPairKey");
const proximityBindingsRuntime_1 = require("./domain/proximityBindingsRuntime");
const gazeBindingsRuntime_1 = require("./domain/gazeBindingsRuntime");
const triggerImageRegistry_1 = require("./domain/triggerImageRegistry");
const dragConfiguration_1 = require("./domain/dragConfiguration");
const viroNodeFactory_1 = require("./domain/viroNodeFactory");
const assetPosition_1 = require("./domain/assetPosition");
const defaultApiRequestExecutor_1 = require("./domain/defaultApiRequestExecutor");
const sceneNavigationHandler_1 = require("./domain/sceneNavigationHandler");
const variableStore_1 = require("./domain/variableStore");
const visibilityStore_1 = require("./domain/visibilityStore");
const placementStore_1 = require("./domain/placementStore");
const dragStore_1 = require("./domain/dragStore");
const animationSlots_1 = require("./domain/animationSlots");
const utils_1 = require("./domain/utils");
const soundManager_1 = require("./domain/soundManager");
const StudioSounds_1 = require("./domain/StudioSounds");
const questAlertStore_1 = require("./domain/questAlertStore");
const StudioQuestAlertOverlay_1 = require("./StudioQuestAlertOverlay");
const StudioQuestSceneHudOverlay_1 = require("./StudioQuestSceneHudOverlay");
const studioMaterials_1 = require("./domain/studioMaterials");
const studioLighting_1 = require("./domain/studioLighting");
const useStudioShaderTimeUniforms_1 = require("./domain/useStudioShaderTimeUniforms");
const useStudioShaderViewportUniforms_1 = require("./domain/useStudioShaderViewportUniforms");
const physicsConfig_1 = require("./domain/physicsConfig");
const controller_1 = require("./colocation/controller");
const frameMath_1 = require("./colocation/frameMath");
const StudioColocationPeers_1 = require("./colocation/StudioColocationPeers");
const sharedState_1 = require("./colocation/sharedState");
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
/** A world point is usable if finite and not the origin sentinel. */
function isUsablePoint(p) {
    return (Array.isArray(p) &&
        p.length >= 3 &&
        p.every((n) => Number.isFinite(n)) &&
        !(p[0] === 0 && p[1] === 0 && p[2] === 0));
}
/** Highest-priority hit-test result with a usable surface point, else null. */
function pickBestHit(results) {
    if (!Array.isArray(results) || results.length === 0)
        return null;
    for (const type of HIT_TEST_PRIORITY) {
        const match = results.find((r) => r.type === type && isUsablePoint(r.transform?.position));
        if (match)
            return match;
    }
    return null;
}
const subscribeToNothing = () => () => { };
const offFrame = () => controller_1.STUDIO_COLOCATION_OFF_FRAME;
/**
 * A world-space placement in the frame shared content renders in, which is the
 * scene origin while shared and world otherwise.
 */
function placementInSceneFrame(frame, position, forward, up) {
    const m = frame.phase === "shared" ? frame.worldToScene : null;
    if (!m)
        return [position, forward, up];
    return [
        (0, frameMath_1.transformPoint)(m, position),
        forward && (0, frameMath_1.rotateDirection)(m, forward),
        up && (0, frameMath_1.rotateDirection)(m, up),
    ];
}
/**
 * A plane-selector pick as a pose: the plane's orientation at the tapped point,
 * which is where the selector would have put its children.
 */
function selectedPlanePose(plane, tapWorld) {
    const pose = (0, frameMath_1.fromPositionEuler)(plane.position, plane.rotation);
    const inverse = tapWorld ? (0, frameMath_1.invert)(pose) : null;
    if (!tapWorld || !inverse)
        return pose;
    const local = (0, frameMath_1.transformPoint)(inverse, tapWorld);
    const onSurface = (0, frameMath_1.transformPoint)(pose, [local[0], 0, local[2]]);
    const out = [...pose];
    out[12] = onSurface[0];
    out[13] = onSurface[1];
    out[14] = onSurface[2];
    return out;
}
/** Fixed-distance point along the cached camera-forward ray (headset fallback). */
function projectAlongCameraForward(pose) {
    if (!pose)
        return null;
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
/**
 * Outer gate: keeps the hooks-bearing inner component out of the tree until
 * sceneData is available, avoiding a Rules of Hooks violation.
 */
const StudioARScene = (props) => {
    if (!props.sceneData) {
        // Quest keeps its own root here for the reason spelled out at the main
        // return below.
        return ViroPlatform_1.isQuest ? (<ViroScene_1.ViroScene toneMappingEnabled={false}/>) : (<ViroARScene_1.ViroARScene toneMappingEnabled={false}/>);
    }
    return <StudioARSceneInner {...props} sceneData={props.sceneData}/>;
};
exports.StudioARScene = StudioARScene;
/** Owns the rig's estimate scale so a light change re-renders these two alone. */
const StudioLightRig = React.forwardRef(function StudioLightRig(_props, ref) {
    const [scale, setScale] = (0, react_1.useState)(1);
    (0, react_1.useImperativeHandle)(ref, () => ({ setScale }), []);
    return (<>
        <ViroAmbientLight_1.ViroAmbientLight color="#ffffff" intensity={studioLighting_1.STUDIO_AMBIENT_INTENSITY * scale}/>
        <ViroDirectionalLight_1.ViroDirectionalLight color="#ffffff" intensity={studioLighting_1.STUDIO_DIRECTIONAL_INTENSITY * scale} direction={studioLighting_1.STUDIO_DIRECTIONAL_DIRECTION}/>
      </>);
});
const StudioARSceneInner = (props) => {
    const { sceneNavigator, sceneData, onReady, onSceneChange, onPlaneDetected, onPlaneSelected, noAssetsMessage, variableStore, placementStore, placementApiRef, colocation, skipOnLoadFunction, } = props;
    const { scene, assets, animations, collision_bindings, functions } = sceneData;
    // ─── Shared session ───────────────────────────────────────────────────────
    // Changes a handful of times a session (phase, frame, origin), never per
    // peer or per pose, so it can be scene state.
    const colocationFrame = (0, react_1.useSyncExternalStore)(colocation?.subscribe ?? subscribeToNothing, colocation?.getFrame ?? offFrame, offFrame);
    const colocationFrameRef = (0, react_1.useRef)(colocationFrame);
    colocationFrameRef.current = colocationFrame;
    const colocationPhase = colocationFrame.phase;
    const [sceneMount] = (0, react_1.useState)(() => colocation?.claimSceneMount() ?? 0);
    // ─── Sequence scheduler ───────────────────────────────────────────────────
    // One per scene. Drives WAIT steps; cancelled on unmount and on navigation so
    // a pending WAIT never fires into a torn-down or replaced scene.
    const schedulerRef = (0, react_1.useRef)(null);
    if (schedulerRef.current === null) {
        schedulerRef.current = new sceneNavigationHandler_1.SequenceScheduler();
    }
    (0, react_1.useEffect)(() => {
        return () => {
            schedulerRef.current?.dispose();
            schedulerRef.current = null;
            // dispose() bumps the scheduler generation first; reset() then clears any
            // pending sound backstop timers and fires their callbacks, which now
            // no-op via the generation guard so unmount can't advance a waited step.
            soundManagerRef.current?.reset();
            // Clear a dangling video-recording flag so leaving the experience mid-
            // recording can't block the next session's RECORD_VIDEO toggle.
            (0, sceneNavigationHandler_1.resetVideoRecordingState)();
            // Dismiss any Quest in-scene alert so a torn-down scene can't leave one
            // stuck on screen for the next scene.
            questAlertStore_1.questAlertStore.reset();
        };
    }, []);
    // ─── Variable store ───────────────────────────────────────────────────────
    // Normally passed down by the navigator (session-scoped); hosts mounting this
    // scene directly get a scene-local fallback. Seeding happens here, at instance
    // init, so values exist before any effect dispatches on_load. seed() is
    // initialize-if-absent, hence idempotent and strict-mode safe.
    const variableStoreRef = (0, react_1.useRef)(null);
    if (variableStoreRef.current === null) {
        variableStoreRef.current = variableStore ?? new variableStore_1.StudioVariableStore();
        variableStoreRef.current.seed(sceneData.variables ?? []);
    }
    // ─── Visibility store ─────────────────────────────────────────────────────
    // Scene-scoped (asset placements are per-scene), keyed by asset id. Seeded
    // from each asset's author-time hidden_on_load default; Set Visibility
    // actions flip it at runtime. Re-seeded on scene change so a persisted
    // instance doesn't carry stale visibility across a navigation.
    const visibilityStoreRef = (0, react_1.useRef)(null);
    if (visibilityStoreRef.current === null) {
        visibilityStoreRef.current = new visibilityStore_1.StudioVisibilityStore();
        visibilityStoreRef.current.seed(assets);
    }
    (0, react_1.useEffect)(() => {
        visibilityStoreRef.current?.reseed(assets);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    // ─── Drag store ───────────────────────────────────────────────────────────
    // Scene-scoped: where another device in a shared session dragged an asset,
    // read by each draggable node on its own.
    const dragStoreRef = (0, react_1.useRef)(null);
    if (dragStoreRef.current === null) {
        dragStoreRef.current = new dragStore_1.StudioDragStore();
    }
    (0, react_1.useEffect)(() => {
        dragStoreRef.current?.reset();
    }, [scene.id]);
    // ─── Placement store (tap to place) ───────────────────────────────────────
    // Scene-scoped, seeded from each asset's author-time tap_to_place flag.
    // Normally owned by the navigator (so its tap overlay can read active state);
    // a host mounting this scene directly gets a scene-local fallback. Placement
    // is ephemeral, so a scene change re-seeds every tap-to-place asset to unplaced.
    const placementStoreRef = (0, react_1.useRef)(null);
    if (placementStoreRef.current === null) {
        placementStoreRef.current = placementStore ?? new placementStore_1.StudioPlacementStore();
        placementStoreRef.current.seed(assets);
    }
    (0, react_1.useEffect)(() => {
        placementStoreRef.current?.reseed(assets);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    // Placements are world points outside a shared session and scene-frame
    // points inside one, so crossing that boundary drops them. Only the scene on
    // screen reseeds: the navigator's store is shared by every scene it pushed.
    const placementsSharedRef = (0, react_1.useRef)(colocationPhase === "shared");
    (0, react_1.useEffect)(() => {
        const shared = colocationPhase === "shared";
        if (placementsSharedRef.current === shared)
            return;
        placementsSharedRef.current = shared;
        // Scene-frame positions too. Entering has nothing to drop: the session
        // has just applied the room's drags.
        if (!shared)
            dragStoreRef.current?.reset();
        if (colocation && !colocation.isCurrentScene(scene.id))
            return;
        placementStoreRef.current?.reseed(assets);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colocationPhase]);
    // ─── Sound manager ────────────────────────────────────────────────────────
    // Per-scene. PLAY/STOP scene-function actions drive it; <StudioSounds> renders
    // the active list. Reset on scene change so sounds don't leak across a
    // navigation (sounds, unlike variables, are not session-scoped).
    const soundManagerRef = (0, react_1.useRef)(null);
    if (soundManagerRef.current === null) {
        soundManagerRef.current = new soundManager_1.StudioSoundManager();
    }
    (0, react_1.useEffect)(() => {
        soundManagerRef.current?.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    // Position for a spatial PLAY: the target asset's mounted position, through
    // the node factory's own rule so the sound and the object agree.
    const getAssetPosition = (0, react_1.useCallback)((assetId) => {
        const a = assets.find((x) => x.id === assetId);
        return a ? (0, assetPosition_1.studioAssetPosition)(a) : undefined;
    }, [assets]);
    const runtimeCtx = (0, react_1.useMemo)(() => ({
        scheduler: schedulerRef.current,
        variableStore: variableStoreRef.current,
        apiRequestExecutor: defaultApiRequestExecutor_1.defaultApiRequestExecutor,
        visibilityStore: visibilityStoreRef.current,
        placementStore: placementStoreRef.current,
        soundManager: soundManagerRef.current,
        dragStore: dragStoreRef.current,
        getAssetPosition,
        colocation,
    }), [getAssetPosition, colocation]);
    const deviceRuntimeCtx = (0, react_1.useMemo)(() => ({ ...runtimeCtx, effectOrigin: "device" }), [runtimeCtx]);
    // Cancel this scene's pending WAITs before handing off to the next scene.
    const handleSceneChange = (0, react_1.useCallback)((sceneId, sceneName) => {
        schedulerRef.current?.cancelAll();
        onSceneChange?.(sceneId, sceneName);
    }, [onSceneChange]);
    // ─── Material registration ────────────────────────────────────────────────
    const materialsRegisteredRef = (0, react_1.useRef)(false);
    if (!materialsRegisteredRef.current) {
        (0, studioMaterials_1.registerStudioMaterialsForAssets)(assets);
        materialsRegisteredRef.current = true;
    }
    (0, useStudioShaderTimeUniforms_1.useStudioShaderTimeUniforms)(assets);
    (0, useStudioShaderViewportUniforms_1.useStudioShaderViewportUniforms)(assets);
    // ─── Animation registration ───────────────────────────────────────────────
    const registeredKeyRef = (0, react_1.useRef)(null);
    const animationsKey = animations.map((a) => a.animation_key).join(",");
    if (animations.length > 0 && registeredKeyRef.current !== animationsKey) {
        registeredKeyRef.current = animationsKey;
        (0, animationRegistry_1.registerSceneAnimations)(animations);
    }
    // ─── Animation runtime state ──────────────────────────────────────────────
    const [animOverrides, setAnimOverrides] = (0, react_1.useState)({});
    const [loadedAssetIds, setLoadedAssetIds] = (0, react_1.useState)({});
    const animationSlotsRef = (0, react_1.useRef)(null);
    if (animationSlotsRef.current === null) {
        animationSlotsRef.current = new animationSlots_1.StudioAnimationSlots();
    }
    const loadedAssetIdsRef = (0, react_1.useRef)(loadedAssetIds);
    loadedAssetIdsRef.current = loadedAssetIds;
    (0, react_1.useEffect)(() => {
        animationSlotsRef.current?.reset();
    }, [scene.id]);
    // ─── Drag-active state (debounced) ────────────────────────────────────────
    // Viro's onDrag fires per-frame. Track a Record<assetId, true> cleared 220ms
    // after the last drag event; the node factory reads isDragActive to pass
    // kinematicDragOverride so Dynamic-physics bodies don't fight the gesture.
    // The onDrag callback's mere presence is also what unlocks native drag.
    const [dragActiveByAssetId, setDragActiveByAssetId] = (0, react_1.useState)({});
    const dragTimersRef = (0, react_1.useRef)(new Map());
    const notifyPhysicsDrag = (0, react_1.useCallback)((assetId, worldPosition) => {
        if (worldPosition)
            dragStoreRef.current?.moved(assetId, worldPosition);
        setDragActiveByAssetId((prev) => prev[assetId] ? prev : { ...prev, [assetId]: true });
        const existing = dragTimersRef.current.get(assetId);
        if (existing)
            clearTimeout(existing);
        const t = setTimeout(() => {
            setDragActiveByAssetId((prev) => {
                if (!prev[assetId])
                    return prev;
                const next = { ...prev };
                delete next[assetId];
                return next;
            });
            dragTimersRef.current.delete(assetId);
        }, 220);
        dragTimersRef.current.set(assetId, t);
    }, []);
    const isDragActive = (0, react_1.useCallback)((assetId) => !!dragActiveByAssetId[assetId], [dragActiveByAssetId]);
    (0, react_1.useEffect)(() => {
        const timers = dragTimersRef.current;
        return () => {
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        };
    }, []);
    const handleAssetLoaded = (0, react_1.useCallback)((assetId) => {
        setLoadedAssetIds((prev) => prev[assetId] ? prev : { ...prev, [assetId]: true });
    }, []);
    const triggerHandlesRef = (0, react_1.useRef)(new Set());
    (0, react_1.useEffect)(() => {
        return () => {
            triggerHandlesRef.current.forEach((id) => cancelAnimationFrame(id));
            triggerHandlesRef.current.clear();
        };
    }, []);
    // Returns false when the scene has no such animation.
    const startAnimation = (0, react_1.useCallback)((targetAssetId, animationKey, origin) => {
        const requested = animations.find((a) => a.target_asset_id === targetAssetId &&
            a.animation_key === animationKey);
        if (!requested)
            return false;
        const play = animationSlotsRef.current.request(requested, !!loadedAssetIdsRef.current[targetAssetId], origin);
        if (play === "queued")
            return true;
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
    }, [animations]);
    const startAnimationRef = (0, react_1.useRef)(startAnimation);
    startAnimationRef.current = startAnimation;
    // A trigger on this device, which a shared session repeats on the others.
    const triggerAnimation = (0, react_1.useCallback)((targetAssetId, animationKey) => {
        if (startAnimation(targetAssetId, animationKey, "local")) {
            colocation?.shareAnimation(scene.id, targetAssetId, animationKey);
        }
    }, [startAnimation, colocation, scene.id]);
    const triggerAnimationRef = (0, react_1.useRef)(triggerAnimation);
    triggerAnimationRef.current = triggerAnimation;
    // What an animation's on_start and on_finish dispatch with: a `device` play
    // keeps what they cause on this device too.
    const effectChain = (0, react_1.useCallback)((origin) => origin === "device"
        ? {
            trigger: (id, key) => startAnimationRef.current(id, key, "device"),
            ctx: deviceRuntimeCtx,
        }
        : {
            trigger: (id, key) => triggerAnimationRef.current(id, key),
            ctx: runtimeCtx,
        }, [runtimeCtx, deviceRuntimeCtx]);
    const handleAnimationFinished = (0, react_1.useCallback)((assetId, anim) => {
        // The runtime loops by replaying the whole animation, so it reports a
        // finish at every cycle boundary. A loop has not finished: firing
        // on_finish there repeats a chained function for as long as the loop runs,
        // and the editor fires it only when an animation ends.
        if (anim.loop)
            return;
        const slots = animationSlotsRef.current;
        const chain = effectChain(slots.origin(assetId));
        if (slots.finish(assetId) && anim.on_finish_function) {
            (0, sceneNavigationHandler_1.executeOnLoadFunction)(anim.on_finish_function, functions, sceneNavigator, animations, chain.trigger, handleSceneChange, chain.ctx);
        }
        // on_finish runs first, so an animation it chains holds the slot and this
        // one waits behind it rather than cutting it off. A queued play was shared
        // when it was triggered, so it starts without being shared again.
        const next = slots.next(assetId);
        if (next)
            startAnimationRef.current(assetId, next.key, next.origin);
    }, [functions, sceneNavigator, animations, handleSceneChange, effectChain]);
    // ─── Computed animation props per asset ──────────────────────────────────
    const animationStates = (0, react_1.useMemo)(() => {
        const states = {};
        const animsByAsset = new Map();
        for (const anim of animations) {
            const list = animsByAsset.get(anim.target_asset_id) ?? [];
            list.push(anim);
            animsByAsset.set(anim.target_asset_id, list);
        }
        for (const [assetId, anims] of animsByAsset) {
            const override = animOverrides[assetId];
            let activeAnim;
            let run;
            if (override) {
                const triggered = anims.find((a) => a.animation_key === override.key);
                if (!triggered)
                    continue;
                activeAnim = triggered;
                run = override.run && !!loadedAssetIds[assetId];
            }
            else {
                activeAnim = anims[0];
                run = false;
            }
            states[assetId] = {
                // MODEL_CLIP resolves against the clip baked into the model file (by its
                // embedded name); PROPERTY resolves against the registered ViroAnimations key.
                name: activeAnim.animation_source === "MODEL_CLIP" && activeAnim.clip_name
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
                        const slots = animationSlotsRef.current;
                        if (!slots.runsOnStart(assetId))
                            return;
                        const chain = effectChain(slots.origin(assetId));
                        (0, sceneNavigationHandler_1.executeOnLoadFunction)(activeAnim.on_start_function, functions, sceneNavigator, animations, chain.trigger, handleSceneChange, chain.ctx);
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
    (0, react_1.useEffect)(() => {
        if (!colocation)
            return;
        const stores = {
            variables: variableStoreRef.current,
            visibility: visibilityStoreRef.current,
            placement: placementStoreRef.current,
            drags: dragStoreRef.current,
            sounds: soundManagerRef.current,
        };
        colocation.attachScene(sceneData, stores, {
            playAnimation: (assetId, key) => startAnimationRef.current(assetId, key, "remote"),
            leave: () => schedulerRef.current?.cancelAll(),
        }, sceneMount);
        return () => colocation.detachScene(stores);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colocation, scene.id]);
    // ─── on_load_function ─────────────────────────────────────────────────────
    const onLoadExecutedRef = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => {
        if (scene.on_load_function &&
            !onLoadExecutedRef.current &&
            !skipOnLoadFunction) {
            onLoadExecutedRef.current = true;
            (0, sceneNavigationHandler_1.executeOnLoadFunction)(scene.on_load_function, functions, sceneNavigator, animations, (id, key) => triggerAnimationRef.current(id, key), handleSceneChange, runtimeCtx);
        }
    }, [scene.id]);
    // ─── Collision bindings ───────────────────────────────────────────────────
    const bindingsByPairKey = (0, react_1.useMemo)(() => {
        const m = new Map();
        for (const b of collision_bindings) {
            const key = (0, collisionPairKey_1.collisionPairKey)(b.asset_x_id, b.asset_y_id);
            const list = m.get(key) ?? [];
            list.push(b);
            m.set(key, list);
        }
        return m;
    }, [collision_bindings]);
    const collisionAssetIds = (0, react_1.useMemo)(() => {
        const s = new Set();
        for (const b of collision_bindings) {
            s.add(b.asset_x_id);
            s.add(b.asset_y_id);
        }
        return s;
    }, [collision_bindings]);
    const collisionCooldownRef = (0, react_1.useRef)(new Map());
    // Image-triggered content sits on each device's own marker rather than in
    // the shared frame, so its contacts are that device's and run there, and
    // the sounds and animations they cause are not shared: every device that
    // sees the marker has the same contact.
    const getCollisionHandler = (0, react_1.useCallback)((placementId, inSharedFrame = true) => {
        if (!collisionAssetIds.has(placementId))
            return undefined;
        const chain = effectChain(inSharedFrame ? "local" : "device");
        return (0, collisionBindingsRuntime_1.createPlacementCollisionHandler)(placementId, bindingsByPairKey, sceneNavigator, animations, collisionCooldownRef, chain.trigger, handleSceneChange, chain.ctx, inSharedFrame
            ? () => (0, sharedState_1.collisionBindingsRunHere)(colocationFrameRef.current)
            : undefined);
    }, [
        bindingsByPairKey,
        collisionAssetIds,
        sceneNavigator,
        animations,
        handleSceneChange,
        effectChain,
    ]);
    // ─── Gaze bindings (On Gaze) ──────────────────────────────────────────────
    // Headset eye-gaze only. The target node's native onGaze reports isHovering;
    // a dwell + hysteresis/fire_mode state machine (gazeBindingsRuntime) fires the
    // bound function. Attached only on Quest — on mobile AR the handler isn't wired,
    // so a scene carrying On Gaze loads and runs, the trigger just never fires.
    const gazeBindings = (0, react_1.useMemo)(() => sceneData.gaze_bindings ?? [], [sceneData]);
    const gazeBindingsByAsset = (0, react_1.useMemo)(() => {
        const map = new Map();
        for (const b of gazeBindings) {
            const list = map.get(b.target_asset_id);
            if (list)
                list.push(b);
            else
                map.set(b.target_asset_id, [b]);
        }
        return map;
    }, [gazeBindings]);
    const gazeStateRef = (0, react_1.useRef)(new Map());
    (0, react_1.useEffect)(() => {
        (0, gazeBindingsRuntime_1.resetGazeStates)(gazeStateRef);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    (0, react_1.useEffect)(() => () => (0, gazeBindingsRuntime_1.resetGazeStates)(gazeStateRef), []);
    const getGazeHandler = (0, react_1.useCallback)((assetId) => {
        if (!ViroPlatform_1.isQuest)
            return undefined;
        const bindings = gazeBindingsByAsset.get(assetId);
        if (!bindings?.length)
            return undefined;
        return (0, gazeBindingsRuntime_1.createGazeHandler)(bindings, {
            sceneNavigator,
            animations,
            onSceneChange: handleSceneChange,
            onAnimationTrigger: (id, key) => triggerAnimationRef.current(id, key),
            runtimeCtx,
        }, gazeStateRef);
    }, [
        gazeBindingsByAsset,
        sceneNavigator,
        animations,
        handleSceneChange,
        runtimeCtx,
    ]);
    // ─── Proximity bindings ───────────────────────────────────────────────────
    // Fire a function when the user's world position comes within `distance` of a
    // target object. Camera pose is uniform world-space across every locomotion
    // mode; the target side reads a live world transform (getTransformAsync)
    // rather than the parent-anchor-local DB position, so the metres are correct
    // regardless of anchor (plane / image marker / moved rig).
    const proximityBindings = (0, react_1.useMemo)(() => sceneData.proximity_bindings ?? [], [sceneData]);
    const proximityTargetIds = (0, react_1.useMemo)(() => {
        const s = new Set();
        for (const b of proximityBindings)
            s.add(b.target_asset_id);
        return s;
    }, [proximityBindings]);
    // Per-binding latches (inside/fired/primed) — reset on scene change so a
    // navigation doesn't carry a one-shot's spent state into the next scene.
    const proximityStateRef = (0, react_1.useRef)(new Map());
    (0, react_1.useEffect)(() => {
        proximityStateRef.current.clear();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    // Live target node refs + a cached world position per target. Refs self-manage
    // via the node factory's mount/unmount ref callback; the cache is refreshed on
    // register and whenever an AR anchor moves, so the camera hot path stays sync.
    const proximityTargetRefsRef = (0, react_1.useRef)(new Map());
    const proximityTargetTransformsRef = (0, react_1.useRef)(new Map());
    const refreshTargetTransform = (0, react_1.useCallback)(async (assetId) => {
        const ref = proximityTargetRefsRef.current.get(assetId);
        if (!ref?.getTransformAsync)
            return;
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
        }
        catch {
            // Node may not be mounted/anchored yet; the next anchor update retries.
        }
    }, []);
    const refreshAllTargetTransforms = (0, react_1.useCallback)(() => {
        for (const id of proximityTargetRefsRef.current.keys()) {
            void refreshTargetTransform(id);
        }
    }, [refreshTargetTransform]);
    const registerProximityTarget = (0, react_1.useCallback)((assetId, ref) => {
        if (ref) {
            proximityTargetRefsRef.current.set(assetId, ref);
            void refreshTargetTransform(assetId);
        }
        else {
            proximityTargetRefsRef.current.delete(assetId);
            proximityTargetTransformsRef.current.delete(assetId);
        }
    }, [refreshTargetTransform]);
    // ─── Tap to place ─────────────────────────────────────────────────────────
    const arSceneRef = (0, react_1.useRef)(null);
    // Latest camera pose, cached from the transform stream so a headset trigger
    // can project the aim ray without an AR surface hit-test.
    const cameraPoseRef = (0, react_1.useRef)(null);
    // Throttled *state* mirror of cameraPoseRef, Quest-only: head-locked UI
    // (StudioQuestAlertOverlay) needs to re-render as the head moves, which a
    // ref alone can't trigger.
    const [questHeadLockedPose, setQuestHeadLockedPose] = (0, react_1.useState)(null);
    const lastHeadLockedEvalRef = (0, react_1.useRef)(0);
    // Which tap-to-place asset the guided queue is waiting on (drives the prompt).
    const [activePlacementId, setActivePlacementId] = (0, react_1.useState)(() => placementStoreRef.current?.activeAssetId() ?? null);
    (0, react_1.useEffect)(() => {
        const store = placementStoreRef.current;
        if (!store)
            return;
        setActivePlacementId(store.activeAssetId());
        return store.subscribeActive(() => setActivePlacementId(store.activeAssetId()));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    const activePlacementName = (0, react_1.useMemo)(() => {
        if (!activePlacementId)
            return null;
        return assets.find((a) => a.id === activePlacementId)?.name ?? null;
    }, [activePlacementId, assets]);
    const lastProximityEvalRef = (0, react_1.useRef)(0);
    const handleCameraTransformUpdate = (0, react_1.useCallback)((t) => {
        cameraPoseRef.current = {
            position: t.position,
            forward: t.forward,
            up: t.up,
        };
        colocation?.publishCameraPose(t.position, t.forward, t.up);
        if (ViroPlatform_1.isQuest) {
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
        if (!proximityBindings.length)
            return;
        const now = Date.now();
        if (now - lastProximityEvalRef.current < PROXIMITY_EVAL_INTERVAL_MS)
            return;
        lastProximityEvalRef.current = now;
        (0, proximityBindingsRuntime_1.evaluateProximityBindings)({
            cameraPosition: t.position,
            bindings: proximityBindings,
            getTargetWorldPosition: (id) => proximityTargetTransformsRef.current.get(id),
            stateRef: proximityStateRef,
            sceneNavigator,
            animations,
            onSceneChange: handleSceneChange,
            onAnimationTrigger: (id, key) => triggerAnimationRef.current(id, key),
            runtimeCtx,
        });
    }, [
        proximityBindings,
        sceneNavigator,
        animations,
        handleSceneChange,
        runtimeCtx,
        colocation,
    ]);
    // Mobile AR: hit-test the tapped screen point and place the active asset on the
    // best real surface. Returns "miss" when nothing usable is under the tap so the
    // overlay can prompt the user to scan more of the space.
    const placeAtScreenPoint = (0, react_1.useCallback)(async (x, y) => {
        const store = placementStoreRef.current;
        const activeId = store?.activeAssetId();
        if (!store || !activeId || !arSceneRef.current)
            return "miss";
        // Content is withheld until the shared origin exists, so there is
        // nothing a placement could land in yet.
        if (colocationFrameRef.current.phase === "pending")
            return "miss";
        let results = [];
        try {
            results = await arSceneRef.current.performARHitTestWithPoint(x, y);
        }
        catch {
            return "miss";
        }
        const best = pickBestHit(results);
        if (!best)
            return "miss";
        store.place(activeId, ...placementInSceneFrame(colocationFrameRef.current, best.transform.position, cameraPoseRef.current?.forward, cameraPoseRef.current?.up));
        return "placed";
    }, []);
    // Expose the mobile placement API to the navigator's tap overlay.
    (0, react_1.useEffect)(() => {
        if (!placementApiRef)
            return;
        placementApiRef.current = { placeAtScreenPoint };
        return () => {
            if (placementApiRef.current?.placeAtScreenPoint === placeAtScreenPoint) {
                placementApiRef.current = null;
            }
        };
    }, [placementApiRef, placeAtScreenPoint]);
    // Headset: the controller trigger fires this. Prefer the ray's real hit point
    // (room mesh); fall back to a fixed distance along the cached aim ray.
    const handleHeadsetPlaceTrigger = (0, react_1.useCallback)((hitPosition) => {
        const store = placementStoreRef.current;
        const activeId = store?.activeAssetId();
        if (!store || !activeId)
            return;
        if (colocationFrameRef.current.phase === "pending")
            return;
        const pos = isUsablePoint(hitPosition)
            ? hitPosition
            : projectAlongCameraForward(cameraPoseRef.current);
        if (!pos)
            return;
        store.place(activeId, ...placementInSceneFrame(colocationFrameRef.current, pos, cameraPoseRef.current?.forward, cameraPoseRef.current?.up));
    }, []);
    // ─── Trigger image targets ────────────────────────────────────────────────
    // Three groups: image-triggered (anchored to a tracked image), tap-to-place
    // (withheld until the user places them at scene root), and the rest (plane
    // assets, rendered inside the plane wrapper). Image triggering wins over
    // tap-to-place since a marker already dictates the anchor.
    const { planeAssets, imageTriggeredAssets, tapToPlaceAssets } = (0, react_1.useMemo)(() => {
        const imgTriggered = assets.filter((a) => !!a.trigger_image_url);
        const tapToPlace = assets.filter((a) => (0, placementStore_1.isTapToPlaceAsset)(a));
        const plane = assets.filter((a) => !a.trigger_image_url && !a.tap_to_place);
        return {
            planeAssets: plane,
            imageTriggeredAssets: imgTriggered,
            tapToPlaceAssets: tapToPlace,
        };
    }, [assets]);
    const [targetNameByAssetId, setTargetNameByAssetId] = (0, react_1.useState)(() => new Map());
    const prevTargetNamesRef = (0, react_1.useRef)([]);
    (0, react_1.useEffect)(() => {
        if (ViroPlatform_1.isQuest) {
            if (imageTriggeredAssets.length > 0) {
                console.warn("[Studio] Image-triggered assets are not supported on Quest — skipping.");
            }
            return;
        }
        if (imageTriggeredAssets.length === 0) {
            (0, triggerImageRegistry_1.cleanupTriggerImageTargets)(prevTargetNamesRef.current);
            prevTargetNamesRef.current = [];
            setTargetNameByAssetId(new Map());
            return;
        }
        const map = (0, triggerImageRegistry_1.registerTriggerImageTargets)(imageTriggeredAssets);
        // Assets sharing a picture share a target name, so delete each one once.
        const targetNames = [...new Set(map.values())];
        if ((0, utils_1.isDev)()) {
            console.log(`[Studio] Registered ${targetNames.length} trigger target(s) for ${imageTriggeredAssets.length} placement(s): ${targetNames.join(", ")}`);
        }
        prevTargetNamesRef.current = targetNames;
        setTargetNameByAssetId(map);
        return () => {
            (0, triggerImageRegistry_1.cleanupTriggerImageTargets)(targetNames);
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
    const [trackingReady, setTrackingReady] = (0, react_1.useState)(() => ViroPlatform_1.isQuest ||
        (scene.plane_detection ?? "NONE").toUpperCase() !== "NONE");
    const handleTrackingUpdated = (0, react_1.useCallback)((state) => {
        if (state === ViroConstants_1.ViroTrackingStateConstants.TRACKING_NORMAL) {
            setTrackingReady(true);
        }
    }, []);
    // ─── Rig scale from the room ──────────────────────────────────────────────
    // The estimate arrives on every rendered frame, so it goes to the rig's own
    // component rather than into state here, where a render rebuilds every asset
    // node, and only once it has moved enough to see. Quest and web never call
    // this and render the rig as authored.
    const lightRigRef = (0, react_1.useRef)(null);
    const lightScaleRef = (0, react_1.useRef)(1);
    const handleAmbientLightUpdate = (0, react_1.useCallback)((info) => {
        const scale = (0, studioLighting_1.studioLightScale)(info?.intensity);
        if (Math.abs(scale - lightScaleRef.current) < studioLighting_1.STUDIO_LIGHT_SCALE_STEP) {
            return;
        }
        lightScaleRef.current = scale;
        lightRigRef.current?.setScale(scale);
    }, []);
    (0, react_1.useEffect)(() => {
        if (trackingReady)
            return;
        const timer = setTimeout(() => setTrackingReady(true), TRACKING_GATE_FALLBACK_MS);
        return () => clearTimeout(timer);
    }, [trackingReady]);
    // ─── Ready callback ───────────────────────────────────────────────────────
    // Fires at mount so the navigator reveals the camera immediately; only the
    // NONE-mode 3D content is held back (above), never the live camera feed.
    (0, react_1.useEffect)(() => {
        onReady?.();
    }, []);
    // ─── Drag surface ─────────────────────────────────────────────────────────
    // A FixedToPlane drag is confined to a world plane, so a draggable asset
    // needs the plane its anchor actually found: guessing an axis from
    // plane_direction drags content off any wall not facing world Z. Only the
    // plane-wrapped assets are anchored to it, and only their own anchor will do,
    // since a scene can detect several walls at once.
    const hasPlaneDrag = (0, react_1.useMemo)(() => planeAssets.some((asset) => asset.is_draggable), [planeAssets]);
    const [dragSurface, setDragSurface] = (0, react_1.useState)(null);
    const selectedAnchorIdRef = (0, react_1.useRef)(null);
    const trackDragSurface = (0, react_1.useCallback)((anchor) => {
        if (!hasPlaneDrag || !anchor?.position || !anchor?.rotation)
            return;
        const next = (0, dragConfiguration_1.dragSurfaceFromAnchor)(anchor.position, anchor.rotation);
        // The session refines a plane continuously, mostly by sliding the anchor
        // around inside the surface, which does not move the plane at all. Keep
        // the previous object in that case or every update re-renders the scene.
        setDragSurface((prev) => prev && (0, dragConfiguration_1.isSameDragSurface)(prev, next) ? prev : next);
    }, [hasPlaneDrag]);
    (0, react_1.useEffect)(() => {
        setDragSurface(null);
        selectedAnchorIdRef.current = null;
    }, [scene.id]);
    // Shared content sits on the origin, not on a plane anchor, and the origin
    // keeps the picked plane's orientation, so its +Y is the surface to drag on.
    const sharedSceneToWorld = colocationPhase === "shared" ? colocationFrame.sceneToWorld : null;
    const sharedDragSurface = (0, react_1.useMemo)(() => hasPlaneDrag && sharedSceneToWorld
        ? (0, frameMath_1.dragSurfaceFromSceneToWorld)(sharedSceneToWorld)
        : null, [hasPlaneDrag, sharedSceneToWorld]);
    const effectiveDragSurface = colocationPhase === "shared" ? sharedDragSurface : dragSurface;
    // ─── Render helpers ───────────────────────────────────────────────────────
    const renderedPlaneAssets = (0, react_1.useMemo)(() => {
        return planeAssets
            .map((asset) => (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id)
            ? registerProximityTarget
            : undefined, getGazeHandler(asset.id), effectiveDragSurface))
            .filter(Boolean);
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
    const renderedTapToPlaceAssets = (0, react_1.useMemo)(() => {
        return tapToPlaceAssets
            .map((asset) => (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id)
            ? registerProximityTarget
            : undefined, getGazeHandler(asset.id)))
            .filter(Boolean);
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
    const renderedImageTriggeredAssets = (0, react_1.useMemo)(() => {
        if (ViroPlatform_1.isQuest)
            return [];
        const nodesByTarget = new Map();
        for (const asset of imageTriggeredAssets) {
            const targetName = targetNameByAssetId.get(asset.id);
            if (!targetName)
                continue;
            const node = (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id, false), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id) ? registerProximityTarget : undefined, getGazeHandler(asset.id));
            if (!node)
                continue;
            const nodes = nodesByTarget.get(targetName);
            if (nodes)
                nodes.push(node);
            else
                nodesByTarget.set(targetName, [node]);
        }
        return [...nodesByTarget].map(([targetName, nodes]) => (<ViroARImageMarker_1.ViroARImageMarker key={targetName} target={targetName} 
        // Whether the tracker ever recognised the picture is otherwise
        // invisible, and it is the first thing to establish when content does
        // not appear on a marker. The native side emits this event either way.
        onAnchorFound={(0, utils_1.isDev)()
                ? () => console.log(`[Studio] Trigger image "${targetName}" found, ${nodes.length} placement(s) on it`)
                : undefined}>
        {nodes}
      </ViroARImageMarker_1.ViroARImageMarker>));
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
    const planeDetectionMode = (scene.plane_detection ?? "NONE").toUpperCase();
    const planeAlignment = (scene.plane_direction ?? "Horizontal");
    // Native plane anchor types for ViroARScene. NONE must pass [] explicitly
    // (empty disables plane finding): omitting the prop keeps the native default
    // of horizontal + vertical, scanning for planes the scene never uses.
    // Exception: tap-to-place placement runs surface hit tests, which return no
    // plane results while detection is off — keep the native default on when the
    // scene has any tap-to-place asset.
    //
    // In a shared session the plane mode only picks the host's origin, so its
    // planes are looked for until then and never on a joiner.
    const detectsScenePlanes = (planeDetectionMode === "AUTOMATIC" || planeDetectionMode === "MANUAL") &&
        (colocationPhase === "off" || colocationFrame.needsOrigin);
    const anchorDetectionTypes = (0, react_1.useMemo)(() => {
        if (!detectsScenePlanes) {
            return tapToPlaceAssets.length
                ? ["planesHorizontal", "planesVertical"]
                : [];
        }
        const dir = (scene.plane_direction ?? "Horizontal").toLowerCase();
        if (dir === "vertical")
            return ["planesVertical"];
        if (dir.includes("horizontal"))
            return ["planesHorizontal"];
        return ["planesHorizontal", "planesVertical"];
    }, [detectsScenePlanes, scene.plane_direction, tapToPlaceAssets]);
    // ViroARPlaneSelector (react-viro 2.54+) no longer receives scene anchors
    // automatically; ViroARScene forwards them here via ref. Also surfaces
    // onPlaneDetected / onPlaneSelected to the host.
    const planeSelectorRef = (0, react_1.useRef)(null);
    // Quest HUD status ("Scanning for planes…" vs "Plane found") — a coarse
    // found/not-found flag, not a count; the HUD only needs to tell the user
    // scanning is working, not exactly how many planes exist.
    const [hasFoundPlane, setHasFoundPlane] = (0, react_1.useState)(false);
    const handleAnchorFound = (0, react_1.useCallback)((anchor) => {
        try {
            if (planeDetectionMode === "MANUAL") {
                planeSelectorRef.current?.handleAnchorFound(anchor);
            }
            if (planeDetectionMode === "AUTOMATIC" && anchor?.type === "plane") {
                onPlaneDetected?.();
            }
            if (anchor?.type === "plane") {
                setHasFoundPlane(true);
            }
            // Anchoring places content in world space — refresh cached target
            // positions so proximity metres stay correct once the anchor lands.
            refreshAllTargetTransforms();
        }
        catch (error) {
            console.error("[Studio] handleAnchorFound failed:", error);
        }
    }, [planeDetectionMode, onPlaneDetected, refreshAllTargetTransforms]);
    const handleAnchorUpdated = (0, react_1.useCallback)((anchor) => {
        try {
            if (planeDetectionMode === "MANUAL") {
                planeSelectorRef.current?.handleAnchorUpdated(anchor);
                if (anchor?.anchorId === selectedAnchorIdRef.current) {
                    trackDragSurface(anchor);
                }
            }
            refreshAllTargetTransforms();
        }
        catch (error) {
            console.error("[Studio] handleAnchorUpdated failed:", error);
        }
    }, [planeDetectionMode, refreshAllTargetTransforms, trackDragSurface]);
    const handleAnchorRemoved = (0, react_1.useCallback)((anchor) => {
        try {
            if (planeDetectionMode === "MANUAL" && anchor) {
                planeSelectorRef.current?.handleAnchorRemoved(anchor);
            }
        }
        catch (error) {
            console.error("[Studio] handleAnchorRemoved failed:", error);
        }
    }, [planeDetectionMode]);
    const handlePlaneSelected = (0, react_1.useCallback)((plane) => {
        selectedAnchorIdRef.current = plane?.anchorId ?? null;
        trackDragSurface(plane);
        onPlaneSelected?.();
    }, [onPlaneSelected, trackDragSurface]);
    // ViroARPlaneSelector.onPlaneDetected must return a boolean (accept the plane).
    const handlePlaneDetectedForSelector = (0, react_1.useCallback)(() => {
        onPlaneDetected?.();
        return true;
    }, [onPlaneDetected]);
    // ─── Shared origin (host) ─────────────────────────────────────────────────
    // The host places the scene the way it was authored, and that pose becomes
    // everyone's origin: the world origin for NONE, the first plane for
    // AUTOMATIC, the selected plane at the tapped point for MANUAL.
    const needsOrigin = colocationFrame.needsOrigin;
    (0, react_1.useEffect)(() => {
        if (needsOrigin && planeDetectionMode === "NONE") {
            colocation?.proposeOrigin(frameMath_1.IDENTITY);
        }
    }, [needsOrigin, planeDetectionMode, colocation]);
    const proposePlaneOrigin = (0, react_1.useCallback)((anchor) => {
        if (!anchor?.position || !anchor?.rotation)
            return;
        colocation?.proposeOrigin((0, frameMath_1.fromPositionEuler)(anchor.position, anchor.rotation));
    }, [colocation]);
    const handleOriginPlaneSelected = (0, react_1.useCallback)((plane, tapPosition) => {
        handlePlaneSelected(plane);
        if (!plane?.position || !plane?.rotation)
            return;
        colocation?.proposeOrigin(selectedPlanePose(plane, tapPosition));
    }, [handlePlaneSelected, colocation]);
    // Detection only, at the scene root: a plane anchor writes its world pose
    // into its node's local transform, so it can never sit inside the shared
    // (transformed) nodes.
    const renderOriginPicker = () => {
        if (planeDetectionMode === "AUTOMATIC") {
            return (<ViroARPlane_1.ViroARPlane minHeight={0.1} minWidth={0.1} alignment={planeAlignment} onAnchorFound={proposePlaneOrigin}/>);
        }
        if (planeDetectionMode === "MANUAL") {
            return (<ViroARPlaneSelector_1.ViroARPlaneSelector ref={planeSelectorRef} minHeight={0.1} minWidth={0.1} alignment={planeAlignment} onPlaneDetected={handlePlaneDetectedForSelector} onPlaneSelected={handleOriginPlaneSelected}/>);
        }
        return null;
    };
    const sharedNodes = (0, react_1.useMemo)(() => {
        const { location, origin } = colocationFrame;
        if (colocationPhase !== "shared" || !location || !origin)
            return null;
        return {
            location: (0, frameMath_1.toNodeTransform)(location),
            origin: (0, frameMath_1.toNodeTransform)(origin),
        };
    }, [colocationFrame, colocationPhase]);
    const renderSharedContent = () => {
        if (!sharedNodes || !colocation)
            return null;
        return (<ViroNode_1.ViroNode position={sharedNodes.location.position} rotation={sharedNodes.location.rotation} scale={sharedNodes.location.scale}>
        {/* Scenes under a push stay mounted; only the one on screen polls. */}
        {colocationFrame.sceneId === scene.id && (<StudioColocationPeers_1.StudioColocationPeers readPeers={colocation.readPeers}/>)}
        <ViroNode_1.ViroNode position={sharedNodes.origin.position} rotation={sharedNodes.origin.rotation}>
          {trackingReady && renderedPlaneAssets}
          {renderedTapToPlaceAssets}
        </ViroNode_1.ViroNode>
      </ViroNode_1.ViroNode>);
    };
    // Quest goes through the same AUTOMATIC/MANUAL/NONE gating as phones now —
    // the OpenXR renderer feeds Quest plane anchors through the same
    // onAnchorFound path ARCore/ARKit use (XR_FB_scene room model), see
    // VROARSessionOpenXR.cpp in virocore. No Quest-specific branch needed.
    const renderAssets = () => {
        if (planeDetectionMode === "AUTOMATIC") {
            return (<ViroARPlane_1.ViroARPlane minHeight={0.1} minWidth={0.1} alignment={planeAlignment} onAnchorFound={trackDragSurface} onAnchorUpdated={trackDragSurface}>
          {renderedPlaneAssets}
        </ViroARPlane_1.ViroARPlane>);
        }
        if (planeDetectionMode === "MANUAL") {
            return (<ViroARPlaneSelector_1.ViroARPlaneSelector ref={planeSelectorRef} minHeight={0.1} minWidth={0.1} alignment={planeAlignment} onPlaneDetected={handlePlaneDetectedForSelector} onPlaneSelected={handlePlaneSelected}>
          {renderedPlaneAssets}
        </ViroARPlaneSelector_1.ViroARPlaneSelector>);
        }
        return <>{renderedPlaneAssets}</>;
    };
    // ─── Physics world ────────────────────────────────────────────────────────
    const physicsWorldConfig = (0, physicsConfig_1.parsePhysicsWorldConfig)(scene.physics_world_config);
    const physicsWorld = physicsWorldConfig?.enabled
        ? (0, physicsConfig_1.buildViroPhysicsWorld)(physicsWorldConfig)
        : undefined;
    const physicsProps = physicsWorld
        ? { physicsWorld: physicsWorld }
        : {};
    // ─── Render ───────────────────────────────────────────────────────────────
    const children = (<>
      {ViroPlatform_1.isQuest && (<ViroController_1.ViroController controllerVisibility reticleVisibility {...(activePlacementId
            ? {
                onClick: (position) => handleHeadsetPlaceTrigger(position),
            }
            : {})}/>)}
      <StudioLightRig ref={lightRigRef}/>
      {colocationPhase === "off" && trackingReady && renderAssets()}
      {colocationPhase === "off" && renderedTapToPlaceAssets}
      {needsOrigin && renderOriginPicker()}
      {renderSharedContent()}
      {renderedImageTriggeredAssets}
      {ViroPlatform_1.isQuest && activePlacementId && (<ViroText_1.ViroText text={`Point and pull the trigger to place: ${activePlacementName ?? "object"}`} position={[0, 0.2, -2]} width={3} height={1} style={{
                fontFamily: "Arial",
                fontSize: 14,
                color: "#FFFFFF",
                textAlign: "center",
            }}/>)}
      {ViroPlatform_1.isQuest && <StudioQuestAlertOverlay_1.StudioQuestAlertOverlay cameraPose={questHeadLockedPose}/>}
      {ViroPlatform_1.isQuest && (<StudioQuestSceneHudOverlay_1.StudioQuestSceneHudOverlay cameraPose={questHeadLockedPose} sceneName={scene.name} planeDetectionMode={planeDetectionMode} hasFoundPlane={hasFoundPlane}/>)}
      <StudioSounds_1.StudioSounds manager={soundManagerRef.current}/>
      {assets.length === 0 && (<ViroText_1.ViroText text={noAssetsMessage ?? "No assets to display"} position={[0, 0, -2]} style={{
                fontFamily: "Arial",
                fontSize: 16,
                color: "#CCCCCC",
                textAlign: "center",
            }}/>)}
    </>);
    // Wire the camera event when a proximity trigger needs it, tap-to-place needs
    // the cached camera pose for headset placement, or we're on Quest (head-locked
    // UI — alert overlay, exit/scene-name HUD — needs a live pose to track) —
    // native gates the per-frame transform stream on this prop being present.
    // A shared session publishes this device's pose from it.
    const cameraTransformProp = ViroPlatform_1.isQuest ||
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
    // and wires XR_EXT_plane_detection into onAnchorFound and ViroARPlane. Passthrough
    // is not what is lost by keeping ViroScene: StudioSceneNavigator asks for it
    // outright with `passthroughEnabled` on Quest, which reaches VRActivity through
    // the navigator bridge and does not depend on the root at all.
    //
    // Plane anchors are. With this root a Studio scene on Quest gets no detected
    // surfaces, so an asset authored to sit on a floor or a wall has nothing to land
    // on. Nothing regresses against what shipped — ViroScene is the root Quest has
    // had since April, and the ref that drives tap-to-place hit testing is null on
    // Quest either way — but unifying the two roots is a real change with a device
    // test behind it, not something a conflict resolution should decide quietly.
    //
    // The scene on screen during a shared session is the one exception
    // (studioSceneRootsInAR). Its content sits in the shared frame rather than on
    // planes, so the AR root changes nothing it renders, and the scene returns to
    // ViroScene when the session ends. Changing the root remounts everything
    // below it, which is the cost the `colocation` prop doc states.
    if (!(0, controller_1.studioSceneRootsInAR)(colocationFrame, sceneMount, ViroPlatform_1.isQuest)) {
        return (<ViroScene_1.ViroScene {...physicsProps} {...cameraTransformProp} toneMappingEnabled={false}>
        {children}
      </ViroScene_1.ViroScene>);
    }
    return (<ViroARScene_1.ViroARScene ref={arSceneRef} 
    // The editor previews no tone curve, and virocore's default Hable
    // luminance-only pass renders pure white at about 0.77. Off here rather
    // than via the navigator's `hdrEnabled`, which would take PBR with it.
    toneMappingEnabled={false} {...physicsProps} {...cameraTransformProp} anchorDetectionTypes={anchorDetectionTypes} onTrackingUpdated={handleTrackingUpdated} onAmbientLightUpdate={handleAmbientLightUpdate} onAnchorFound={handleAnchorFound} onAnchorUpdated={handleAnchorUpdated} onAnchorRemoved={handleAnchorRemoved}>
      {children}
    </ViroARScene_1.ViroARScene>);
};
