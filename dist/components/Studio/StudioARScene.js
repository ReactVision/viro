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
const react_native_1 = require("react-native");
const ViroAmbientLight_1 = require("../ViroAmbientLight");
const ViroARImageMarker_1 = require("../AR/ViroARImageMarker");
const ViroARPlane_1 = require("../AR/ViroARPlane");
const ViroARPlaneSelector_1 = require("../AR/ViroARPlaneSelector");
const ViroARScene_1 = require("../AR/ViroARScene");
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
const viroNodeFactory_1 = require("./domain/viroNodeFactory");
const defaultApiRequestExecutor_1 = require("./domain/defaultApiRequestExecutor");
const sceneNavigationHandler_1 = require("./domain/sceneNavigationHandler");
const variableStore_1 = require("./domain/variableStore");
const visibilityStore_1 = require("./domain/visibilityStore");
const placementStore_1 = require("./domain/placementStore");
const soundManager_1 = require("./domain/soundManager");
const StudioSounds_1 = require("./domain/StudioSounds");
const studioMaterials_1 = require("./domain/studioMaterials");
const useStudioShaderTimeUniforms_1 = require("./domain/useStudioShaderTimeUniforms");
const useStudioShaderViewportUniforms_1 = require("./domain/useStudioShaderViewportUniforms");
const physicsConfig_1 = require("./domain/physicsConfig");
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
        return ViroPlatform_1.isQuest ? <ViroScene_1.ViroScene /> : <ViroARScene_1.ViroARScene />;
    }
    return <StudioARSceneInner {...props} sceneData={props.sceneData}/>;
};
exports.StudioARScene = StudioARScene;
const StudioARSceneInner = (props) => {
    const { sceneNavigator, sceneData, onReady, onSceneChange, onPlaneDetected, onPlaneSelected, noAssetsMessage, variableStore, placementStore, placementApiRef, } = props;
    const { scene, assets, animations, collision_bindings, functions } = sceneData;
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
    // Position for a spatial PLAY: look up the placed target asset (matches the
    // node factory's position derivation, position_z defaulting to -2).
    const getAssetPosition = (0, react_1.useCallback)((assetId) => {
        const a = assets.find((x) => x.id === assetId);
        if (!a)
            return undefined;
        return [a.position_x ?? 0, a.position_y ?? 0, a.position_z ?? -2];
    }, [assets]);
    const runtimeCtx = (0, react_1.useMemo)(() => ({
        scheduler: schedulerRef.current,
        variableStore: variableStoreRef.current,
        apiRequestExecutor: defaultApiRequestExecutor_1.defaultApiRequestExecutor,
        visibilityStore: visibilityStoreRef.current,
        placementStore: placementStoreRef.current,
        soundManager: soundManagerRef.current,
        getAssetPosition,
    }), [getAssetPosition]);
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
    // ─── Drag-active state (debounced) ────────────────────────────────────────
    // Viro's onDrag fires per-frame. Track a Record<assetId, true> cleared 220ms
    // after the last drag event; the node factory reads isDragActive to pass
    // kinematicDragOverride so Dynamic-physics bodies don't fight the gesture.
    // The onDrag callback's mere presence is also what unlocks native drag.
    const [dragActiveByAssetId, setDragActiveByAssetId] = (0, react_1.useState)({});
    const dragTimersRef = (0, react_1.useRef)(new Map());
    const notifyPhysicsDrag = (0, react_1.useCallback)((assetId) => {
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
    const triggerAnimation = (0, react_1.useCallback)((targetAssetId, animationKey) => {
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
    }, []);
    const triggerAnimationRef = (0, react_1.useRef)(triggerAnimation);
    triggerAnimationRef.current = triggerAnimation;
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
                interruptible: activeAnim.interruptible,
                delay: activeAnim.delay_ms ?? 0,
                onStart: activeAnim.on_start_function
                    ? () => (0, sceneNavigationHandler_1.executeOnLoadFunction)(activeAnim.on_start_function, functions, sceneNavigator, animations, (id, key) => triggerAnimationRef.current(id, key), handleSceneChange, runtimeCtx)
                    : undefined,
                onFinish: activeAnim.on_finish_function
                    ? () => (0, sceneNavigationHandler_1.executeOnLoadFunction)(activeAnim.on_finish_function, functions, sceneNavigator, animations, (id, key) => triggerAnimationRef.current(id, key), handleSceneChange, runtimeCtx)
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
    const onLoadExecutedRef = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => {
        if (scene.on_load_function && !onLoadExecutedRef.current) {
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
    const getCollisionHandler = (0, react_1.useCallback)((placementId) => {
        if (!collisionAssetIds.has(placementId))
            return undefined;
        return (0, collisionBindingsRuntime_1.createPlacementCollisionHandler)(placementId, bindingsByPairKey, sceneNavigator, animations, collisionCooldownRef, (id, key) => triggerAnimationRef.current(id, key), handleSceneChange, runtimeCtx);
    }, [
        bindingsByPairKey,
        collisionAssetIds,
        sceneNavigator,
        animations,
        handleSceneChange,
        runtimeCtx,
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
    }, [proximityBindings, sceneNavigator, animations, handleSceneChange, runtimeCtx]);
    // Mobile AR: hit-test the tapped screen point and place the active asset on the
    // best real surface. Returns "miss" when nothing usable is under the tap so the
    // overlay can prompt the user to scan more of the space.
    const placeAtScreenPoint = (0, react_1.useCallback)(async (x, y) => {
        const store = placementStoreRef.current;
        const activeId = store?.activeAssetId();
        if (!store || !activeId || !arSceneRef.current)
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
        store.place(activeId, best.transform.position, cameraPoseRef.current?.forward, cameraPoseRef.current?.up);
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
        const pos = isUsablePoint(hitPosition)
            ? hitPosition
            : projectAlongCameraForward(cameraPoseRef.current);
        if (!pos)
            return;
        store.place(activeId, pos, cameraPoseRef.current?.forward, cameraPoseRef.current?.up);
    }, []);
    // ─── Trigger image targets ────────────────────────────────────────────────
    // Three groups: image-triggered (anchored to a tracked image), tap-to-place
    // (withheld until the user places them at scene root), and the rest (plane
    // assets, rendered inside the plane wrapper). Image triggering wins over
    // tap-to-place since a marker already dictates the anchor.
    const { planeAssets, imageTriggeredAssets, tapToPlaceAssets } = (0, react_1.useMemo)(() => {
        const imgTriggered = assets.filter((a) => !!a.trigger_image_url);
        const tapToPlace = assets.filter((a) => !a.trigger_image_url && a.tap_to_place);
        const plane = assets.filter((a) => !a.trigger_image_url && !a.tap_to_place);
        return {
            planeAssets: plane,
            imageTriggeredAssets: imgTriggered,
            tapToPlaceAssets: tapToPlace,
        };
    }, [assets]);
    const [urlToTargetName, setUrlToTargetName] = (0, react_1.useState)(() => new Map());
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
            setUrlToTargetName(new Map());
            return;
        }
        const map = (0, triggerImageRegistry_1.registerTriggerImageTargets)(imageTriggeredAssets);
        const targetNames = [...map.values()];
        prevTargetNamesRef.current = targetNames;
        setUrlToTargetName(map);
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
    // ─── Render helpers ───────────────────────────────────────────────────────
    const maxModels = react_native_1.Platform.OS === "android" ? ANDROID_MAX_3D_MODELS : IOS_MAX_3D_MODELS;
    const renderedPlaneAssets = (0, react_1.useMemo)(() => {
        let modelCount = 0;
        return planeAssets
            .map((asset) => {
            if (asset.asset_type_name === "3D-MODEL") {
                modelCount++;
                if (modelCount > maxModels) {
                    console.warn(`[Studio] Skipping 3D model "${asset.name}" — ${react_native_1.Platform.OS} limit (${maxModels}) reached`);
                    return null;
                }
            }
            return (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id)
                ? registerProximityTarget
                : undefined, getGazeHandler(asset.id));
        })
            .filter(Boolean);
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
        getGazeHandler,
    ]);
    // Tap-to-place nodes render at scene root (world space); each is gated by the
    // placement store (null until placed, then mounted at the placed world point).
    const renderedTapToPlaceAssets = (0, react_1.useMemo)(() => {
        let modelCount = 0;
        return tapToPlaceAssets
            .map((asset) => {
            if (asset.asset_type_name === "3D-MODEL") {
                modelCount++;
                if (modelCount > maxModels) {
                    console.warn(`[Studio] Skipping 3D model "${asset.name}" — ${react_native_1.Platform.OS} limit (${maxModels}) reached`);
                    return null;
                }
            }
            return (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id)
                ? registerProximityTarget
                : undefined, getGazeHandler(asset.id));
        })
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
        maxModels,
        handleSceneChange,
        runtimeCtx,
        proximityTargetIds,
        registerProximityTarget,
        getGazeHandler,
    ]);
    const renderedImageTriggeredAssets = (0, react_1.useMemo)(() => {
        if (ViroPlatform_1.isQuest)
            return [];
        return imageTriggeredAssets
            .map((asset) => {
            const targetName = urlToTargetName.get(asset.trigger_image_url);
            if (!targetName)
                return null;
            const node = (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id)
                ? registerProximityTarget
                : undefined, getGazeHandler(asset.id));
            if (!node)
                return null;
            return (<ViroARImageMarker_1.ViroARImageMarker key={asset.id} target={targetName}>
            {node}
          </ViroARImageMarker_1.ViroARImageMarker>);
        })
            .filter(Boolean);
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
    const anchorDetectionTypes = (0, react_1.useMemo)(() => {
        if (planeDetectionMode !== "AUTOMATIC" && planeDetectionMode !== "MANUAL") {
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
    }, [planeDetectionMode, scene.plane_direction, tapToPlaceAssets]);
    // ViroARPlaneSelector (react-viro 2.54+) no longer receives scene anchors
    // automatically; ViroARScene forwards them here via ref. Also surfaces
    // onPlaneDetected / onPlaneSelected to the host.
    const planeSelectorRef = (0, react_1.useRef)(null);
    const handleAnchorFound = (0, react_1.useCallback)((anchor) => {
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
        }
        catch (error) {
            console.error("[Studio] handleAnchorFound failed:", error);
        }
    }, [planeDetectionMode, onPlaneDetected, refreshAllTargetTransforms]);
    const handleAnchorUpdated = (0, react_1.useCallback)((anchor) => {
        try {
            if (planeDetectionMode === "MANUAL") {
                planeSelectorRef.current?.handleAnchorUpdated(anchor);
            }
            refreshAllTargetTransforms();
        }
        catch (error) {
            console.error("[Studio] handleAnchorUpdated failed:", error);
        }
    }, [planeDetectionMode, refreshAllTargetTransforms]);
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
    const handlePlaneSelected = (0, react_1.useCallback)(() => {
        onPlaneSelected?.();
    }, [onPlaneSelected]);
    // ViroARPlaneSelector.onPlaneDetected must return a boolean (accept the plane).
    const handlePlaneDetectedForSelector = (0, react_1.useCallback)(() => {
        onPlaneDetected?.();
        return true;
    }, [onPlaneDetected]);
    const renderAssets = () => {
        if (ViroPlatform_1.isQuest) {
            if (planeDetectionMode !== "NONE") {
                console.warn(`[Studio] Plane detection (${planeDetectionMode}) is not supported on Quest — rendering assets without plane anchor.`);
            }
            return <>{renderedPlaneAssets}</>;
        }
        if (planeDetectionMode === "AUTOMATIC") {
            return (<ViroARPlane_1.ViroARPlane minHeight={0.1} minWidth={0.1} alignment={planeAlignment}>
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
      <ViroAmbientLight_1.ViroAmbientLight color="#ffffff" intensity={1000}/>
      {trackingReady && renderAssets()}
      {renderedTapToPlaceAssets}
      {renderedImageTriggeredAssets}
      {ViroPlatform_1.isQuest && activePlacementId && (<ViroText_1.ViroText text={`Point and pull the trigger to place: ${activePlacementName ?? "object"}`} position={[0, 0.2, -2]} width={3} height={1} style={{
                fontFamily: "Arial",
                fontSize: 14,
                color: "#FFFFFF",
                textAlign: "center",
            }}/>)}
      <StudioSounds_1.StudioSounds manager={soundManagerRef.current}/>
      {assets.length === 0 && (<ViroText_1.ViroText text={noAssetsMessage ?? "No assets to display"} position={[0, 0, -2]} style={{
                fontFamily: "Arial",
                fontSize: 16,
                color: "#CCCCCC",
                textAlign: "center",
            }}/>)}
    </>);
    // Wire the camera event when a proximity trigger needs it OR tap-to-place needs
    // the cached camera pose for headset placement — native gates the per-frame
    // transform stream on this prop being present.
    const cameraTransformProp = proximityBindings.length || tapToPlaceAssets.length
        ? { onCameraTransformUpdate: handleCameraTransformUpdate }
        : {};
    if (ViroPlatform_1.isQuest) {
        return (<ViroScene_1.ViroScene {...physicsProps} {...cameraTransformProp}>
        {children}
      </ViroScene_1.ViroScene>);
    }
    return (<ViroARScene_1.ViroARScene ref={arSceneRef} {...physicsProps} {...cameraTransformProp} anchorDetectionTypes={anchorDetectionTypes} onTrackingUpdated={handleTrackingUpdated} onAnchorFound={handleAnchorFound} onAnchorUpdated={handleAnchorUpdated} onAnchorRemoved={handleAnchorRemoved}>
      {children}
    </ViroARScene_1.ViroARScene>);
};
