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
exports.StudioSceneNavigator = void 0;
/**
 * Web host/navigator for Studio scenes. Web counterpart of StudioSceneNavigator
 * (native): instead of pushing StudioARScene onto ViroXRSceneNavigator via the
 * native VRTStudioModule, it holds the scene data in state and renders
 * StudioARScene.web inside a web navigator — ViroARSceneNavigator (AR via slam)
 * or Viro3DSceneNavigator (non-AR 3D), chosen from the scene's plane detection.
 *
 * Data source is injected (out of the renderer's scope): pass `sceneData`
 * directly, or a `loadScene(id)` fetcher (also used for NAVIGATION between
 * scenes via the runtime's injectable `navigate` seam). `apiRequestExecutor`
 * (for API_REQUEST functions) is likewise injected.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const Viro3DSceneNavigator_web_1 = require("../Viro3DSceneNavigator.web");
const ViroARSceneNavigator_web_1 = require("../AR/ViroARSceneNavigator.web");
const StudioARScene_web_1 = require("./StudioARScene.web");
const variableStore_1 = require("./domain/variableStore");
const StudioPlacementIndicator_web_1 = require("./StudioPlacementIndicator.web");
const StudioRecordingIndicator_web_1 = require("./StudioRecordingIndicator.web");
function isARScene(sceneData) {
    const mode = (sceneData?.scene?.plane_detection ?? "NONE").toUpperCase();
    return mode === "AUTOMATIC" || mode === "MANUAL";
}
exports.StudioSceneNavigator = (0, react_1.forwardRef)((props, ref) => {
    const { recordingIndicator = true, placementIndicator = true, arOptions, onSessionReady, sceneData: injectedSceneData, loadScene, sceneId, apiRequestExecutor, mode, webRendererOptions, slamScriptUrl, onSceneReady, onError, onSceneChange, onSceneLoaded, onPlaneDetected, onUnsupported, noAssetsMessage, loadingView, renderError, } = props;
    const containerRef = (0, react_1.useRef)(null);
    // Session-scoped variable store (survives NAVIGATION between scenes).
    const variableStoreRef = (0, react_1.useRef)(null);
    if (variableStoreRef.current === null)
        variableStoreRef.current = new variableStore_1.StudioVariableStore();
    const [sceneData, setSceneData] = (0, react_1.useState)(injectedSceneData);
    const [error, setError] = (0, react_1.useState)(null);
    const onSceneLoadedRef = (0, react_1.useRef)(onSceneLoaded);
    onSceneLoadedRef.current = onSceneLoaded;
    const applyScene = (0, react_1.useCallback)((next) => {
        setSceneData(next);
        onSceneLoadedRef.current?.(next);
    }, []);
    // Initial load: prefer injected data, else fetch by id.
    (0, react_1.useEffect)(() => {
        if (injectedSceneData) {
            applyScene(injectedSceneData);
            return;
        }
        if (!sceneId || !loadScene)
            return;
        let cancelled = false;
        loadScene(sceneId)
            .then((data) => !cancelled && applyScene(data))
            .catch((err) => {
            if (cancelled)
                return;
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            onError?.(e);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneId, injectedSceneData]);
    // NAVIGATION seam: fetch the target scene and re-render.
    const navigate = (0, react_1.useCallback)((targetSceneId) => {
        if (!loadScene) {
            console.warn("[Studio web] navigate ignored: no loadScene provided");
            return;
        }
        loadScene(targetSceneId)
            .then((data) => applyScene(data))
            .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))));
    }, [loadScene, applyScene, onError]);
    (0, react_1.useImperativeHandle)(ref, () => ({
        takeScreenshot: async (fileName) => {
            const canvas = containerRef.current?.querySelector("canvas");
            if (!canvas)
                return { success: false };
            try {
                return { success: true, url: canvas.toDataURL("image/png") };
            }
            catch {
                return { success: false };
            }
        },
    }), []);
    if (error && renderError)
        return <>{renderError(error)}</>;
    if (!sceneData)
        return <>{loadingView ?? null}</>;
    const resolvedMode = mode ?? (isARScene(sceneData) ? "ar" : "3d");
    const SceneComponent = () => (<StudioARScene_web_1.StudioARScene key={sceneData.scene.id} sceneData={sceneData} mode={resolvedMode} apiRequestExecutor={apiRequestExecutor} navigate={navigate} onReady={onSceneReady} onSceneChange={onSceneChange} onPlaneDetected={onPlaneDetected} onUnsupported={onUnsupported} noAssetsMessage={noAssetsMessage} variableStore={variableStoreRef.current ?? undefined}/>);
    // The two HUD pills sit over the canvas rather than in it: they are DOM
    // siblings, so neither the WebGL capture nor a canvas recorder sees them,
    // which is the same guarantee the native ones give. Offsets mirror the
    // native constants (iOS branch — there is no status bar to measure on web).
    const overlay = {
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
    };
    return (<div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {resolvedMode === "ar" ? (<ViroARSceneNavigator_web_1.ViroARSceneNavigator initialScene={{ scene: SceneComponent }} webRendererOptions={webRendererOptions} slamScriptUrl={slamScriptUrl} arOptions={{ detectPlanes: true, ...arOptions }} onSessionReady={onSessionReady}/>) : (<Viro3DSceneNavigator_web_1.Viro3DSceneNavigator initialScene={{ scene: SceneComponent }} webRendererOptions={webRendererOptions}/>)}
      {recordingIndicator && (<div style={{ ...overlay, top: 52 }}>
          <StudioRecordingIndicator_web_1.StudioRecordingIndicator />
        </div>)}
      {placementIndicator && (<div style={{ ...overlay, top: 64, padding: "0 24px" }}>
          <StudioPlacementIndicator_web_1.StudioPlacementIndicator />
        </div>)}
    </div>);
});
exports.StudioSceneNavigator.displayName = "StudioSceneNavigator";
