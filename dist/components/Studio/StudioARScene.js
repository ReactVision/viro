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
const animationRegistry_1 = require("./domain/animationRegistry");
const collisionBindingsRuntime_1 = require("./domain/collisionBindingsRuntime");
const collisionPairKey_1 = require("./domain/collisionPairKey");
const proximityBindingsRuntime_1 = require("./domain/proximityBindingsRuntime");
const triggerImageRegistry_1 = require("./domain/triggerImageRegistry");
const viroNodeFactory_1 = require("./domain/viroNodeFactory");
const defaultApiRequestExecutor_1 = require("./domain/defaultApiRequestExecutor");
const sceneNavigationHandler_1 = require("./domain/sceneNavigationHandler");
const variableStore_1 = require("./domain/variableStore");
const visibilityStore_1 = require("./domain/visibilityStore");
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
    const { sceneNavigator, sceneData, onReady, onSceneChange, onPlaneDetected, onPlaneSelected, noAssetsMessage, variableStore, } = props;
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
                name: activeAnim.animation_key,
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
    const lastProximityEvalRef = (0, react_1.useRef)(0);
    const handleCameraTransformUpdate = (0, react_1.useCallback)((t) => {
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
    // ─── Trigger image targets ────────────────────────────────────────────────
    const { planeAssets, imageTriggeredAssets } = (0, react_1.useMemo)(() => {
        const plane = assets.filter((a) => !a.trigger_image_url);
        const imgTriggered = assets.filter((a) => !!a.trigger_image_url);
        return { planeAssets: plane, imageTriggeredAssets: imgTriggered };
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
    // ─── Ready callback ───────────────────────────────────────────────────────
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
            return (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id) ? registerProximityTarget : undefined);
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
    ]);
    const renderedImageTriggeredAssets = (0, react_1.useMemo)(() => {
        if (ViroPlatform_1.isQuest)
            return [];
        return imageTriggeredAssets
            .map((asset) => {
            const targetName = urlToTargetName.get(asset.trigger_image_url);
            if (!targetName)
                return null;
            const node = (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), isDragActive, notifyPhysicsDrag, handleSceneChange, runtimeCtx, proximityTargetIds.has(asset.id) ? registerProximityTarget : undefined);
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
    ]);
    // ─── Plane detection (AR only) ────────────────────────────────────────────
    const planeDetectionMode = (scene.plane_detection ?? "NONE").toUpperCase();
    const planeAlignment = (scene.plane_direction ?? "Horizontal");
    // Native plane anchor types for ViroARScene (lowercase matches Viro defaults).
    const anchorDetectionTypes = (0, react_1.useMemo)(() => {
        if (planeDetectionMode !== "AUTOMATIC" && planeDetectionMode !== "MANUAL") {
            return undefined;
        }
        const dir = (scene.plane_direction ?? "Horizontal").toLowerCase();
        if (dir === "vertical")
            return ["planesVertical"];
        if (dir.includes("horizontal"))
            return ["planesHorizontal"];
        return ["planesHorizontal", "planesVertical"];
    }, [planeDetectionMode, scene.plane_direction]);
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
      {ViroPlatform_1.isQuest && <ViroController_1.ViroController controllerVisibility reticleVisibility/>}
      <ViroAmbientLight_1.ViroAmbientLight color="#ffffff" intensity={1000}/>
      {renderAssets()}
      {renderedImageTriggeredAssets}
      <StudioSounds_1.StudioSounds manager={soundManagerRef.current}/>
      {assets.length === 0 && (<ViroText_1.ViroText text={noAssetsMessage ?? "No assets to display"} position={[0, 0, -2]} style={{
                fontFamily: "Arial",
                fontSize: 16,
                color: "#CCCCCC",
                textAlign: "center",
            }}/>)}
    </>);
    // Only wire the camera event when a proximity trigger needs it — native gates
    // the per-frame transform stream on this prop being present.
    const cameraTransformProp = proximityBindings.length
        ? { onCameraTransformUpdate: handleCameraTransformUpdate }
        : {};
    if (ViroPlatform_1.isQuest) {
        return (<ViroScene_1.ViroScene {...physicsProps} {...cameraTransformProp}>
        {children}
      </ViroScene_1.ViroScene>);
    }
    return (<ViroARScene_1.ViroARScene {...physicsProps} {...cameraTransformProp} {...(anchorDetectionTypes != null ? { anchorDetectionTypes } : {})} onAnchorFound={handleAnchorFound} onAnchorUpdated={handleAnchorUpdated} onAnchorRemoved={handleAnchorRemoved}>
      {children}
    </ViroARScene_1.ViroARScene>);
};
