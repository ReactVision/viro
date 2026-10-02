"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioSceneNavigator = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Viro3DSceneNavigator_web_1 = require("../Viro3DSceneNavigator.web");
const ViroARSceneNavigator_web_1 = require("../AR/ViroARSceneNavigator.web");
const StudioARScene_web_1 = require("./StudioARScene.web");
const placementStore_1 = require("./domain/placementStore");
const placementBannerStore_1 = require("./domain/placementBannerStore");
const studioRendererEffects_1 = require("./domain/studioRendererEffects");
const variableStore_1 = require("./domain/variableStore");
const StudioPlacementIndicator_web_1 = require("./StudioPlacementIndicator.web");
const StudioRecordingIndicator_web_1 = require("./StudioRecordingIndicator.web");
const StudioColocationIndicator_web_1 = require("./StudioColocationIndicator.web");
const colocationStore_1 = require("./domain/colocationStore");
/**
 * What the navigators mount as the scene. At module scope on purpose: it used to
 * be a closure built in the render body, so every navigator render handed React
 * a new component type, which unmounts and remounts the whole scene subtree and
 * rebuilds every node in the renderer. A three-image scene rendered three times
 * on first load, and a 29 MB model was fetched twice, doubling peak heap. The
 * props now travel through `viroAppProps`, which both navigators spread onto it.
 */
function StudioSceneRoot({ sceneNavigator: _sceneNavigator, ...props }) {
    return (0, jsx_runtime_1.jsx)(StudioARScene_web_1.StudioARScene, { ...props }, props.sceneData?.scene.id);
}
const STUDIO_SCENE = { scene: StudioSceneRoot };
function isARScene(sceneData) {
    const mode = (sceneData?.scene?.plane_detection ?? "NONE").toUpperCase();
    return mode === "AUTOMATIC" || mode === "MANUAL";
}
/**
 * The tap surface for guided placement, and the only writer of the prompt state.
 *
 * Mounted only while the queue is waiting on an asset, so it never swallows a
 * tap meant for the scene's own click handlers. The visible pill is a separate
 * indicator the host positions in its own chrome; this publishes what it shows.
 *
 * Screen point to canvas pixels: the hit test works in the renderer's drawing
 * buffer, which is not the element's CSS size on a scaled display or under a
 * `devicePixelRatio` other than 1.
 */
const StudioPlacementOverlay = ({ store, apiRef, getName }) => {
    const [activeId, setActiveId] = (0, react_1.useState)(() => store.activeAssetId());
    const missTimerRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        setActiveId(store.activeAssetId());
        return store.subscribeActive(() => setActiveId(store.activeAssetId()));
    }, [store]);
    (0, react_1.useEffect)(() => {
        placementBannerStore_1.studioPlacementBannerStore.set(!!activeId, activeId ? getName(activeId) : null);
    }, [activeId, getName]);
    (0, react_1.useEffect)(() => () => {
        if (missTimerRef.current)
            clearTimeout(missTimerRef.current);
        placementBannerStore_1.studioPlacementBannerStore.reset();
    }, []);
    const handlePointerUp = (0, react_1.useCallback)((evt) => {
        const api = apiRef.current;
        if (!api)
            return;
        const target = evt.currentTarget;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0)
            return;
        const canvas = target.parentElement?.querySelector("canvas");
        const bufferW = canvas?.width ?? rect.width;
        const bufferH = canvas?.height ?? rect.height;
        const x = ((evt.clientX - rect.left) / rect.width) * bufferW;
        const y = ((evt.clientY - rect.top) / rect.height) * bufferH;
        void api.placeAtScreenPoint(x, y).then((result) => {
            if (result !== "miss") {
                placementBannerStore_1.studioPlacementBannerStore.setShowMiss(false);
                return;
            }
            placementBannerStore_1.studioPlacementBannerStore.setShowMiss(true);
            if (missTimerRef.current)
                clearTimeout(missTimerRef.current);
            missTimerRef.current = setTimeout(() => placementBannerStore_1.studioPlacementBannerStore.setShowMiss(false), 2500);
        });
    }, [apiRef]);
    if (!activeId)
        return null;
    return ((0, jsx_runtime_1.jsx)("div", { onPointerUp: handlePointerUp, style: {
            position: "absolute",
            inset: 0,
            // Above the canvas and below the pills, which set pointerEvents none.
            zIndex: 1,
            touchAction: "none",
        } }));
};
exports.StudioSceneNavigator = (0, react_1.forwardRef)((props, ref) => {
    const { recordingIndicator = true, placementIndicator = true, colocation, colocationIndicator = true, onColocationStateChange, arOptions, onSessionReady, onMotionUnavailable, sceneData: injectedSceneData, loadScene, sceneId, apiRequestExecutor, mode, webRendererOptions, slamScriptUrl, onSceneReady, onError, onAssetError, onRendererAbort, onSceneChange, onSceneLoaded, onPlaneDetected, onUnsupported, noAssetsMessage, loadingView, renderError, } = props;
    const containerRef = (0, react_1.useRef)(null);
    // Session-scoped variable store (survives NAVIGATION between scenes).
    const variableStoreRef = (0, react_1.useRef)(null);
    if (variableStoreRef.current === null)
        variableStoreRef.current = new variableStore_1.StudioVariableStore();
    // The guided placement queue, and the scene's imperative handle onto it.
    const placementStoreRef = (0, react_1.useRef)(null);
    const placementApiRef = (0, react_1.useRef)(null);
    const [sceneData, setSceneData] = (0, react_1.useState)(injectedSceneData);
    const [error, setError] = (0, react_1.useState)(null);
    const onSceneLoadedRef = (0, react_1.useRef)(onSceneLoaded);
    onSceneLoadedRef.current = onSceneLoaded;
    const onColocationStateChangeRef = (0, react_1.useRef)(onColocationStateChange);
    onColocationStateChangeRef.current = onColocationStateChange;
    const colocationRequested = colocation !== undefined;
    // Idle is only news after a failure was reported, as on native.
    const colocationReportedRef = (0, react_1.useRef)(false);
    const [colocationStoreOwner] = (0, react_1.useState)(() => ({}));
    (0, react_1.useEffect)(() => {
        if (!colocationRequested && !colocationReportedRef.current)
            return;
        colocationReportedRef.current = colocationRequested;
        const state = colocationRequested
            ? {
                status: "failed",
                code: "FRAME_KIND_UNSUPPORTED",
                message: "Co-location rooms need a phone or headset: a browser cannot align with a device's scan.",
            }
            : { status: "idle" };
        colocationStore_1.studioColocationStore.set(state, colocationStoreOwner);
        onColocationStateChangeRef.current?.(state);
    }, [colocationRequested, colocationStoreOwner]);
    (0, react_1.useEffect)(() => () => colocationStore_1.studioColocationStore.reset(colocationStoreOwner), [colocationStoreOwner]);
    // The navigators read their renderer options once, when they create it.
    const onRendererAbortRef = (0, react_1.useRef)(onRendererAbort);
    onRendererAbortRef.current = onRendererAbort;
    const rendererOptions = (0, react_1.useMemo)(() => ({
        ...webRendererOptions,
        onAbort: (err) => {
            webRendererOptions?.onAbort?.(err);
            onRendererAbortRef.current?.(err);
            setError(err);
        },
    }), [webRendererOptions]);
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
        leaveColocation: () => { },
        retryColocation: () => false,
        getColocationRoom: () => null,
        finishColocationScan: () => false,
    }), []);
    // Owned here rather than in the scene so the prompt can read the same queue
    // the tap surface drives, and so neither survives a scene change.
    const placementStore = (placementStoreRef.current ??= new placementStore_1.StudioPlacementStore());
    const placementNames = new Map((sceneData?.assets ?? [])
        .filter(placementStore_1.isTapToPlaceAsset)
        .map((a) => [a.id, a.name ?? ""]));
    const getPlacementName = (assetId) => placementNames.get(assetId) ?? null;
    if (error && renderError)
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: renderError(error) });
    if (!sceneData)
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: loadingView ?? null });
    const resolvedMode = mode ?? (isARScene(sceneData) ? "ar" : "3d");
    const sceneProps = {
        placementApiRef,
        placementStore,
        sceneData,
        mode: resolvedMode,
        apiRequestExecutor,
        navigate,
        onReady: onSceneReady,
        onSceneChange,
        onPlaneDetected,
        onUnsupported,
        onAssetError,
        noAssetsMessage,
        variableStore: variableStoreRef.current ?? undefined,
    };
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
    return ((0, jsx_runtime_1.jsxs)("div", { ref: containerRef, style: { width: "100%", height: "100%", position: "relative" }, children: [resolvedMode === "ar" ? ((0, jsx_runtime_1.jsx)(ViroARSceneNavigator_web_1.ViroARSceneNavigator, { initialScene: STUDIO_SCENE, viroAppProps: sceneProps, webRendererOptions: rendererOptions, slamScriptUrl: slamScriptUrl, arOptions: { detectPlanes: true, ...arOptions }, onSessionReady: onSessionReady, onMotionUnavailable: onMotionUnavailable, ...studioRendererEffects_1.STUDIO_RENDERER_EFFECTS })) : ((0, jsx_runtime_1.jsx)(Viro3DSceneNavigator_web_1.Viro3DSceneNavigator, { initialScene: STUDIO_SCENE, viroAppProps: sceneProps, webRendererOptions: rendererOptions, ...studioRendererEffects_1.STUDIO_RENDERER_EFFECTS })), recordingIndicator && ((0, jsx_runtime_1.jsx)("div", { style: { ...overlay, top: 52 }, children: (0, jsx_runtime_1.jsx)(StudioRecordingIndicator_web_1.StudioRecordingIndicator, {}) })), resolvedMode === "ar" && ((0, jsx_runtime_1.jsx)(StudioPlacementOverlay, { store: placementStore, apiRef: placementApiRef, getName: getPlacementName })), placementIndicator && ((0, jsx_runtime_1.jsx)("div", { style: { ...overlay, top: 64, padding: "0 24px", zIndex: 2 }, children: (0, jsx_runtime_1.jsx)(StudioPlacementIndicator_web_1.StudioPlacementIndicator, {}) })), colocationIndicator && ((0, jsx_runtime_1.jsx)("div", { style: { ...overlay, bottom: 40, padding: "0 24px", zIndex: 2 }, children: (0, jsx_runtime_1.jsx)(StudioColocationIndicator_web_1.StudioColocationIndicator, {}) }))] }));
});
exports.StudioSceneNavigator.displayName = "StudioSceneNavigator";
