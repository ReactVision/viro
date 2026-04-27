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
const ViroText_1 = require("../ViroText");
const animationRegistry_1 = require("./domain/animationRegistry");
const collisionBindingsRuntime_1 = require("./domain/collisionBindingsRuntime");
const collisionPairKey_1 = require("./domain/collisionPairKey");
const triggerImageRegistry_1 = require("./domain/triggerImageRegistry");
const viroNodeFactory_1 = require("./domain/viroNodeFactory");
const sceneNavigationHandler_1 = require("./domain/sceneNavigationHandler");
const studioMaterials_1 = require("./domain/studioMaterials");
const useStudioShaderTimeUniforms_1 = require("./domain/useStudioShaderTimeUniforms");
const useStudioShaderViewportUniforms_1 = require("./domain/useStudioShaderViewportUniforms");
const physicsConfig_1 = require("./domain/physicsConfig");
const ANDROID_MAX_3D_MODELS = 3;
const IOS_MAX_3D_MODELS = 10;
/**
 * AR scene component driven by a StudioSceneResponse.
 * Passed as `scene` to ViroARSceneNavigator.initialScene and also
 * to sceneNavigator.push() when navigating between scenes.
 */
const StudioARScene = (props) => {
    const { sceneNavigator, sceneData, onReady, onSceneChange } = props;
    // Guard: sceneData may be null during the brief push animation.
    if (!sceneData)
        return <ViroARScene_1.ViroARScene />;
    const { scene, assets, animations, collision_bindings, functions } = sceneData;
    // ─── Material registration ────────────────────────────────────────────────
    // Must run synchronously before first render so shaderOverrides resolve.
    const materialsRegisteredRef = (0, react_1.useRef)(false);
    if (!materialsRegisteredRef.current) {
        (0, studioMaterials_1.registerStudioMaterialsForAssets)(assets);
        materialsRegisteredRef.current = true;
    }
    // Drive `time` uniform for animated shader presets (~60fps).
    (0, useStudioShaderTimeUniforms_1.useStudioShaderTimeUniforms)(assets);
    // Push _rf_vpw / _rf_vph viewport uniforms for shaders sampling the camera feed.
    (0, useStudioShaderViewportUniforms_1.useStudioShaderViewportUniforms)(assets);
    // ─── Animation registration ───────────────────────────────────────────────
    // Done synchronously at render time so the registry is populated before
    // any Viro component reads the animation prop.
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
    const triggerRafsRef = (0, react_1.useRef)(new Set());
    (0, react_1.useEffect)(() => {
        return () => {
            triggerRafsRef.current.forEach((id) => cancelAnimationFrame(id));
            triggerRafsRef.current.clear();
        };
    }, []);
    /** Two-step rAF animation trigger: set run:false then run:true on next frame. */
    const triggerAnimation = (0, react_1.useCallback)((targetAssetId, animationKey) => {
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
    }, []);
    const triggerAnimationRef = (0, react_1.useRef)(triggerAnimation);
    triggerAnimationRef.current = triggerAnimation;
    // ─── Computed animation props per asset ──────────────────────────────────
    const animationStates = (0, react_1.useMemo)(() => {
        const states = {};
        // Group animations by target asset
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
                    ? () => (0, sceneNavigationHandler_1.executeOnLoadFunction)(activeAnim.on_start_function, functions, sceneNavigator, animations, (id, key) => triggerAnimationRef.current(id, key))
                    : undefined,
                onFinish: activeAnim.on_finish_function
                    ? () => (0, sceneNavigationHandler_1.executeOnLoadFunction)(activeAnim.on_finish_function, functions, sceneNavigator, animations, (id, key) => triggerAnimationRef.current(id, key))
                    : undefined,
            };
        }
        return states;
    }, [animations, animOverrides, loadedAssetIds, functions, sceneNavigator]);
    // ─── on_load_function ─────────────────────────────────────────────────────
    const onLoadExecutedRef = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => {
        if (scene.on_load_function && !onLoadExecutedRef.current) {
            onLoadExecutedRef.current = true;
            (0, sceneNavigationHandler_1.executeOnLoadFunction)(scene.on_load_function, functions, sceneNavigator, animations, (id, key) => triggerAnimationRef.current(id, key), onSceneChange);
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
        return (0, collisionBindingsRuntime_1.createPlacementCollisionHandler)(placementId, bindingsByPairKey, sceneNavigator, animations, collisionCooldownRef, (id, key) => triggerAnimationRef.current(id, key), onSceneChange);
    }, [bindingsByPairKey, collisionAssetIds, sceneNavigator, animations]);
    // ─── Trigger image targets ────────────────────────────────────────────────
    const { planeAssets, imageTriggeredAssets } = (0, react_1.useMemo)(() => {
        const plane = assets.filter((a) => !a.trigger_image_url);
        const imgTriggered = assets.filter((a) => !!a.trigger_image_url);
        return { planeAssets: plane, imageTriggeredAssets: imgTriggered };
    }, [assets]);
    const [urlToTargetName, setUrlToTargetName] = (0, react_1.useState)(() => new Map());
    const prevTargetNamesRef = (0, react_1.useRef)([]);
    (0, react_1.useEffect)(() => {
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
            return (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded);
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
    ]);
    const renderedImageTriggeredAssets = (0, react_1.useMemo)(() => {
        return imageTriggeredAssets
            .map((asset) => {
            const targetName = urlToTargetName.get(asset.trigger_image_url);
            if (!targetName)
                return null;
            const node = (0, viroNodeFactory_1.createNode)(asset, sceneNavigator, animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded);
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
    ]);
    // ─── Plane detection mode ─────────────────────────────────────────────────
    const planeDetectionMode = (scene.plane_detection ?? "NONE").toUpperCase();
    const planeAlignment = (scene.plane_direction ?? "Horizontal");
    // ─── Physics world ────────────────────────────────────────────────────────
    const physicsWorldConfig = (0, physicsConfig_1.parsePhysicsWorldConfig)(scene.physics_world_config);
    const physicsWorld = physicsWorldConfig?.enabled
        ? (0, physicsConfig_1.buildViroPhysicsWorld)(physicsWorldConfig)
        : undefined;
    // ─── Render ───────────────────────────────────────────────────────────────
    return (<ViroARScene_1.ViroARScene {...(physicsWorld ? { physicsWorld: physicsWorld } : {})}>
      <ViroAmbientLight_1.ViroAmbientLight color="#ffffff" intensity={1000}/>

      {planeDetectionMode === "AUTOMATIC" ? (<ViroARPlane_1.ViroARPlane minHeight={0.1} minWidth={0.1} alignment={planeAlignment}>
          {renderedPlaneAssets}
        </ViroARPlane_1.ViroARPlane>) : planeDetectionMode === "MANUAL" ? (<ViroARPlaneSelector_1.ViroARPlaneSelector minHeight={0.1} minWidth={0.1} alignment={planeAlignment}>
          {renderedPlaneAssets}
        </ViroARPlaneSelector_1.ViroARPlaneSelector>) : (<>{renderedPlaneAssets}</>)}

      {renderedImageTriggeredAssets}

      {assets.length === 0 && (<ViroText_1.ViroText text="No assets to display" position={[0, 0, -2]} style={{
                fontFamily: "Arial",
                fontSize: 16,
                color: "#CCCCCC",
                textAlign: "center",
            }}/>)}
    </ViroARScene_1.ViroARScene>);
};
exports.StudioARScene = StudioARScene;
