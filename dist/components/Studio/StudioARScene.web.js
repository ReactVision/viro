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
const React = __importStar(require("react"));
const react_1 = require("react");
const ViroAmbientLight_web_1 = require("../ViroAmbientLight.web");
const ViroARPlane_web_1 = require("../AR/ViroARPlane.web");
const ViroARScene_web_1 = require("../AR/ViroARScene.web");
const ViroScene_web_1 = require("../ViroScene.web");
const ViroText_web_1 = require("../ViroText.web");
const animationRegistry_1 = require("./domain/animationRegistry");
const viroNodeFactory_1 = require("./domain/viroNodeFactory");
const sceneNavigationHandler_1 = require("./domain/sceneNavigationHandler");
const variableStore_1 = require("./domain/variableStore");
const visibilityStore_1 = require("./domain/visibilityStore");
const soundManager_1 = require("./domain/soundManager");
const StudioSounds_1 = require("./domain/StudioSounds");
const studioMaterials_1 = require("./domain/studioMaterials");
/** Outer gate: keep hooks out of the tree until sceneData exists. */
const StudioARScene = (props) => {
    if (!props.sceneData) {
        return props.mode === "3d" ? <ViroScene_web_1.ViroScene /> : <ViroARScene_web_1.ViroARScene />;
    }
    return <StudioARSceneInner {...props} sceneData={props.sceneData}/>;
};
exports.StudioARScene = StudioARScene;
const StudioARSceneInner = (props) => {
    const { sceneData, mode = "ar", apiRequestExecutor, navigate, onReady, onSceneChange, onPlaneDetected, onUnsupported, noAssetsMessage, variableStore, } = props;
    const { scene, assets, animations, functions } = sceneData;
    // ─── Runtime singletons (per scene) ───────────────────────────────────────
    const schedulerRef = (0, react_1.useRef)(null);
    if (schedulerRef.current === null)
        schedulerRef.current = new sceneNavigationHandler_1.SequenceScheduler();
    const soundManagerRef = (0, react_1.useRef)(null);
    if (soundManagerRef.current === null)
        soundManagerRef.current = new soundManager_1.StudioSoundManager();
    (0, react_1.useEffect)(() => {
        return () => {
            schedulerRef.current?.dispose();
            schedulerRef.current = null;
            soundManagerRef.current?.reset();
        };
    }, []);
    const variableStoreRef = (0, react_1.useRef)(null);
    if (variableStoreRef.current === null) {
        variableStoreRef.current = variableStore ?? new variableStore_1.StudioVariableStore();
        variableStoreRef.current.seed(sceneData.variables ?? []);
    }
    const visibilityStoreRef = (0, react_1.useRef)(null);
    if (visibilityStoreRef.current === null) {
        visibilityStoreRef.current = new visibilityStore_1.StudioVisibilityStore();
        visibilityStoreRef.current.seed(assets);
    }
    (0, react_1.useEffect)(() => {
        visibilityStoreRef.current?.reseed(assets);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    (0, react_1.useEffect)(() => {
        soundManagerRef.current?.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    const getAssetPosition = (0, react_1.useCallback)((assetId) => {
        const a = assets.find((x) => x.id === assetId);
        return a ? [a.position_x ?? 0, a.position_y ?? 0, a.position_z ?? -2] : undefined;
    }, [assets]);
    const runtimeCtx = (0, react_1.useMemo)(() => ({
        scheduler: schedulerRef.current,
        variableStore: variableStoreRef.current,
        apiRequestExecutor,
        visibilityStore: visibilityStoreRef.current,
        soundManager: soundManagerRef.current,
        getAssetPosition,
        navigate,
    }), [getAssetPosition, apiRequestExecutor, navigate]);
    const handleSceneChange = (0, react_1.useCallback)((sceneId, sceneName) => {
        schedulerRef.current?.cancelAll();
        onSceneChange?.(sceneId, sceneName);
    }, [onSceneChange]);
    // ─── Material + animation registration ────────────────────────────────────
    const materialsRegisteredRef = (0, react_1.useRef)(false);
    if (!materialsRegisteredRef.current) {
        (0, studioMaterials_1.registerStudioMaterialsForAssets)(assets);
        materialsRegisteredRef.current = true;
    }
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
        setLoadedAssetIds((prev) => (prev[assetId] ? prev : { ...prev, [assetId]: true }));
    }, []);
    const triggerHandlesRef = (0, react_1.useRef)(new Set());
    (0, react_1.useEffect)(() => {
        return () => {
            triggerHandlesRef.current.forEach((id) => cancelAnimationFrame(id));
            triggerHandlesRef.current.clear();
        };
    }, []);
    const triggerAnimation = (0, react_1.useCallback)((targetAssetId, animationKey) => {
        setAnimOverrides((prev) => ({ ...prev, [targetAssetId]: { key: animationKey, run: false } }));
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
    const animationStates = (0, react_1.useMemo)(() => {
        const states = {};
        const byAsset = new Map();
        for (const anim of animations) {
            const list = byAsset.get(anim.target_asset_id) ?? [];
            list.push(anim);
            byAsset.set(anim.target_asset_id, list);
        }
        for (const [assetId, anims] of byAsset) {
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
            const runOnLoad = (fnId) => (0, sceneNavigationHandler_1.executeOnLoadFunction)(fnId, functions, undefined, animations, (id, key) => triggerAnimationRef.current(id, key), handleSceneChange, runtimeCtx);
            states[assetId] = {
                name: activeAnim.animation_key,
                run,
                loop: activeAnim.loop,
                interruptible: activeAnim.interruptible,
                delay: activeAnim.delay_ms ?? 0,
                onStart: activeAnim.on_start_function ? () => runOnLoad(activeAnim.on_start_function) : undefined,
                onFinish: activeAnim.on_finish_function ? () => runOnLoad(activeAnim.on_finish_function) : undefined,
            };
        }
        return states;
    }, [animations, animOverrides, loadedAssetIds, functions, handleSceneChange, runtimeCtx]);
    // ─── on_load_function ─────────────────────────────────────────────────────
    const onLoadExecutedRef = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => {
        if (scene.on_load_function && !onLoadExecutedRef.current) {
            onLoadExecutedRef.current = true;
            (0, sceneNavigationHandler_1.executeOnLoadFunction)(scene.on_load_function, functions, undefined, animations, (id, key) => triggerAnimationRef.current(id, key), handleSceneChange, runtimeCtx);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    // ─── Capability report (features that won't render on web) ────────────────
    (0, react_1.useEffect)(() => {
        const unsupported = [];
        if (assets.some((a) => a.trigger_image_url))
            unsupported.push("image markers");
        if (scene.physics_world_config)
            unsupported.push("physics");
        if ((scene.plane_detection ?? "").toUpperCase() === "MANUAL")
            unsupported.push("manual plane selection");
        if (unsupported.length > 0)
            onUnsupported?.(unsupported);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.id]);
    // ─── Ready ────────────────────────────────────────────────────────────────
    (0, react_1.useEffect)(() => {
        onReady?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ─── Node mapping (plane assets only; image-triggered are skipped on web) ──
    const planeAssets = (0, react_1.useMemo)(() => assets.filter((a) => !a.trigger_image_url), [assets]);
    const renderedAssets = (0, react_1.useMemo)(() => {
        return planeAssets
            .map((asset) => (0, viroNodeFactory_1.createNode)(asset, undefined, // sceneNavigator: web navigates via runtimeCtx.navigate
        animations, scene, (id, key) => triggerAnimationRef.current(id, key), animationStates, handleAssetLoaded, undefined, // onCollision: no physics on web
        undefined, // isDragActive
        undefined, // notifyPhysicsDrag
        handleSceneChange, runtimeCtx))
            .filter(Boolean);
    }, [planeAssets, animations, scene, animationStates, handleAssetLoaded, handleSceneChange, runtimeCtx]);
    // ─── Plane wrapping (AR mode only) ────────────────────────────────────────
    const planeMode = (scene.plane_detection ?? "NONE").toUpperCase();
    const planeAlignment = (scene.plane_direction ?? "Horizontal");
    const usePlane = mode === "ar" && (planeMode === "AUTOMATIC" || planeMode === "MANUAL");
    const body = usePlane ? (<ViroARPlane_web_1.ViroARPlane minHeight={0.1} minWidth={0.1} alignment={planeAlignment} onAnchorFound={() => onPlaneDetected?.()}>
      {renderedAssets}
    </ViroARPlane_web_1.ViroARPlane>) : (<>{renderedAssets}</>);
    const children = (<>
      <ViroAmbientLight_web_1.ViroAmbientLight color="#ffffff" intensity={1000}/>
      {body}
      <StudioSounds_1.StudioSounds manager={soundManagerRef.current}/>
      {assets.length === 0 && (<ViroText_web_1.ViroText text={noAssetsMessage ?? "No assets to display"} position={[0, 0, -2]} style={{ fontFamily: "Arial", fontSize: 16, color: "#CCCCCC", textAlign: "center" }}/>)}
    </>);
    return mode === "3d" ? <ViroScene_web_1.ViroScene>{children}</ViroScene_web_1.ViroScene> : <ViroARScene_web_1.ViroARScene>{children}</ViroARScene_web_1.ViroARScene>;
};
