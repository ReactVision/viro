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
    const { sceneNavigator, sceneData, onReady, onSceneChange, variableStore } = props;
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
            return (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), handleSceneChange, runtimeCtx);
        })
            .filter(Boolean);
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
    const renderedImageTriggeredAssets = (0, react_1.useMemo)(() => {
        if (ViroPlatform_1.isQuest)
            return [];
        return imageTriggeredAssets
            .map((asset) => {
            const targetName = urlToTargetName.get(asset.trigger_image_url);
            if (!targetName)
                return null;
            const node = (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, getCollisionHandler(asset.id), handleSceneChange, runtimeCtx);
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
        handleSceneChange,
        runtimeCtx,
    ]);
    // ─── Plane detection (AR only) ────────────────────────────────────────────
    const planeDetectionMode = (scene.plane_detection ?? "NONE").toUpperCase();
    const planeAlignment = (scene.plane_direction ?? "Horizontal");
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
            return (<ViroARPlaneSelector_1.ViroARPlaneSelector minHeight={0.1} minWidth={0.1} alignment={planeAlignment}>
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
      {assets.length === 0 && (<ViroText_1.ViroText text="No assets to display" position={[0, 0, -2]} style={{
                fontFamily: "Arial",
                fontSize: 16,
                color: "#CCCCCC",
                textAlign: "center",
            }}/>)}
    </>);
    if (ViroPlatform_1.isQuest) {
        return <ViroScene_1.ViroScene {...physicsProps}>{children}</ViroScene_1.ViroScene>;
    }
    return <ViroARScene_1.ViroARScene {...physicsProps}>{children}</ViroARScene_1.ViroARScene>;
};
