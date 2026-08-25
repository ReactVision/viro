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
const React = __importStar(require("react"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const ViroARScene_1 = require("../AR/ViroARScene");
const ViroScene_1 = require("../ViroScene");
const ViroXRSceneNavigator_1 = require("../ViroXRSceneNavigator");
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
const StudioRecordingIndicator_1 = require("./StudioRecordingIndicator");
const StudioPlacementIndicator_1 = require("./StudioPlacementIndicator");
const placementBannerStore_1 = require("./domain/placementBannerStore");
const animationRegistry_1 = require("./domain/animationRegistry");
const studioMaterials_1 = require("./domain/studioMaterials");
const variableStore_1 = require("./domain/variableStore");
const placementStore_1 = require("./domain/placementStore");
const StudioARScene_1 = require("./StudioARScene");
const StudioSceneErrorBoundary_1 = require("./StudioSceneErrorBoundary");
const VRTStudioModule_1 = require("./VRTStudioModule");
function LoadingARScene() {
    return <ViroARScene_1.ViroARScene />;
}
function LoadingVRScene() {
    return <ViroScene_1.ViroScene />;
}
function mapOcclusionMode(dbValue) {
    switch (dbValue) {
        case "PEOPLEONLY":
            return "peopleOnly";
        case "DEPTHBASED":
            return "depthBased";
        default:
            return undefined;
    }
}
// Approximate top inset for the built-in recording indicator. Dependency-free
// (viro takes no safe-area-context peer dep); hosts wanting exact placement set
// recordingIndicator={false} and render <StudioRecordingIndicator /> themselves.
const DEFAULT_RECORDING_TOP = react_native_1.Platform.OS === "android" ? (react_native_1.StatusBar.currentHeight ?? 24) + 8 : 52;
const styles = react_native_1.StyleSheet.create({
    loader: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000000",
    },
    recordingOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
    },
    placementBanner: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingHorizontal: 24,
    },
});
const PLACEMENT_BANNER_TOP = react_native_1.Platform.OS === "android" ? (react_native_1.StatusBar.currentHeight ?? 24) + 12 : 64;
/**
 * Mobile AR placement layer: a full-screen tap catcher shown while a tap-to-place
 * asset is awaiting placement. Each tap hit-tests a real surface (via the scene's
 * placement API); a miss prompts the user to scan more of the space. Rendered only
 * when an asset is active, so normal object interaction is untouched otherwise.
 * Headset placement is in-scene (controller trigger), so this never mounts there.
 *
 * The visible prompt is a separate position-agnostic indicator; this layer only
 * publishes active/name/miss state to the banner store so the host can render the
 * prompt in its own chrome.
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
    const handleRelease = (0, react_1.useCallback)((evt) => {
        const api = apiRef.current;
        if (!api)
            return;
        const { locationX, locationY } = evt.nativeEvent;
        const ratio = react_native_1.PixelRatio.get();
        void api
            .placeAtScreenPoint(locationX * ratio, locationY * ratio)
            .then((result) => {
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
    return (<react_native_1.View style={react_native_1.StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onResponderRelease={handleRelease}/>);
};
/**
 * Cross-reality Studio scene navigator. Renders a Studio-authored scene on
 * both AR devices (iOS / non-Quest Android) and Meta Quest (VR).
 *
 * Opening-scene resolution order:
 *   1. `sceneId` prop → use it directly
 *   2. Native project (RVProjectId from manifest) → use `opening_scene.id`
 *   3. Fallback → first scene in the project's scene list
 *
 * On Quest, ViroXRSceneNavigator is not rendered until the scene data is
 * ready. This means VRActivity always launches with the actual content scene
 * as its initial scene, avoiding the LoadingVRScene → replace timing race.
 */
exports.StudioSceneNavigator = (0, react_1.forwardRef)(function StudioSceneNavigator({ sceneId, worldAlignment = "Gravity", autofocus = true, style, onSceneReady, onError, onSceneChange, onExitViro, onSceneLoaded, onPlaneDetected, onPlaneSelected, noAssetsMessage, loadingView, renderError, recordingIndicator = true, placementIndicator = true, }, ref) {
    const navigatorRef = (0, react_1.useRef)(null);
    const loadedSceneIdRef = (0, react_1.useRef)(null);
    const [isSceneReady, setIsSceneReady] = (0, react_1.useState)(false);
    // Session-scoped variable store: outlives every scene push, resets when the
    // navigator (= the AR/VR session) unmounts.
    const variableStoreRef = (0, react_1.useRef)(null);
    if (variableStoreRef.current === null) {
        variableStoreRef.current = new variableStore_1.StudioVariableStore();
    }
    (0, react_1.useEffect)(() => {
        return () => {
            variableStoreRef.current?.reset();
            variableStoreRef.current = null;
        };
    }, []);
    // Tap-to-place: the store is owned here so the mobile overlay can read active
    // state; StudioARScene re-seeds it per scene. placementApiRef receives the
    // scene's hit-test bridge. placementNamesRef maps asset id → name for the
    // overlay prompt. All ephemeral — placement never persists.
    const placementStoreRef = (0, react_1.useRef)(null);
    if (placementStoreRef.current === null) {
        placementStoreRef.current = new placementStore_1.StudioPlacementStore();
    }
    const placementApiRef = (0, react_1.useRef)(null);
    const placementNamesRef = (0, react_1.useRef)(new Map());
    const getPlacementName = (0, react_1.useCallback)((assetId) => placementNamesRef.current.get(assetId) ?? null, []);
    const onSceneReadyRef = (0, react_1.useRef)(onSceneReady);
    const onErrorRef = (0, react_1.useRef)(onError);
    const onSceneChangeRef = (0, react_1.useRef)(onSceneChange);
    const onSceneLoadedRef = (0, react_1.useRef)(onSceneLoaded);
    const onPlaneDetectedRef = (0, react_1.useRef)(onPlaneDetected);
    const onPlaneSelectedRef = (0, react_1.useRef)(onPlaneSelected);
    const noAssetsMessageRef = (0, react_1.useRef)(noAssetsMessage);
    onSceneReadyRef.current = onSceneReady;
    onErrorRef.current = onError;
    onSceneChangeRef.current = onSceneChange;
    onSceneLoadedRef.current = onSceneLoaded;
    onPlaneDetectedRef.current = onPlaneDetected;
    onPlaneSelectedRef.current = onPlaneSelected;
    noAssetsMessageRef.current = noAssetsMessage;
    // Stable so passProps stays referentially steady across renders. Idempotent,
    // so StrictMode's dev double-invoke of StudioARScene's onReady effect is safe.
    const handleSceneReady = (0, react_1.useCallback)(() => {
        setIsSceneReady(true);
        onSceneReadyRef.current?.();
    }, []);
    // On Quest: holds the resolved scene entry. ViroXRSceneNavigator is not
    // rendered until this is non-null, so VRActivity always launches into content.
    const [vrSceneEntry, setVrSceneEntry] = (0, react_1.useState)(null);
    // Host config derived from the loaded scene; native setters apply post-mount,
    // so setting these after the navigator mounts is fine.
    const [occlusionMode, setOcclusionMode] = (0, react_1.useState)(undefined);
    const [numberOfTrackedImages, setNumberOfTrackedImages] = (0, react_1.useState)(undefined);
    (0, react_1.useImperativeHandle)(ref, () => ({
        takeScreenshot: (fileName, saveToCameraRoll) => {
            // On AR the handle is the ViroARSceneNavigator instance (has
            // arSceneNavigator.takeScreenshot); on Quest it's a bridge without it.
            const nav = navigatorRef.current?.arSceneNavigator;
            if (typeof nav?.takeScreenshot !== "function") {
                return Promise.resolve({ success: false });
            }
            return nav.takeScreenshot(fileName, saveToCameraRoll);
        },
    }), []);
    const resolveSceneId = (0, react_1.useCallback)(async () => {
        if (sceneId)
            return sceneId;
        const projectResult = await VRTStudioModule_1.VRTStudioModule.rvGetProject();
        if (!projectResult.success) {
            throw new Error(projectResult.error ?? "rvGetProject failed");
        }
        if (typeof projectResult.data !== "string") {
            throw new Error("rvGetProject returned no data");
        }
        const { project } = JSON.parse(projectResult.data);
        if (project.opening_scene?.id) {
            return project.opening_scene.id;
        }
        if (project.scenes.length > 0) {
            return project.scenes[0].id;
        }
        throw new Error(`Project ${project.id} has no scenes`);
    }, [sceneId]);
    const loadScene = (0, react_1.useCallback)(async (isCancelled) => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        if (isCancelled())
            return;
        const resolvedSceneId = await resolveSceneId();
        if (isCancelled())
            return;
        if (loadedSceneIdRef.current === resolvedSceneId)
            return;
        const result = await VRTStudioModule_1.VRTStudioModule.rvGetScene(resolvedSceneId);
        if (isCancelled())
            return;
        if (!result.success) {
            throw new Error(result.error ?? "rvGetScene failed");
        }
        if (typeof result.data !== "string") {
            throw new Error("rvGetScene returned no data");
        }
        const sceneData = JSON.parse(result.data);
        if (isCancelled())
            return;
        loadedSceneIdRef.current = resolvedSceneId;
        // Names for the tap-to-place prompt (overlay reads this on placement).
        placementNamesRef.current = new Map(sceneData.assets
            .filter((a) => a.tap_to_place)
            .map((a) => [a.id, a.name ?? ""]));
        const triggerImageCount = sceneData.assets.filter((a) => !!a.trigger_image_url).length;
        setNumberOfTrackedImages(triggerImageCount > 0 ? Math.min(triggerImageCount, 5) : undefined);
        setOcclusionMode(mapOcclusionMode(sceneData.project?.occlusion_mode));
        onSceneLoadedRef.current?.(sceneData);
        // On Quest, pre-register animations and materials before VRActivity
        // launches so the native registrations land before any Viro component
        // mounts; otherwise registerAnimations/createMaterials races the Fabric
        // commit that creates those components. visionOS is the same shape of
        // problem: the ImmersiveSpace renderer starts outside this commit.
        if (ViroPlatform_1.isQuest || ViroPlatform_1.isVisionOS) {
            (0, animationRegistry_1.registerSceneAnimations)(sceneData.animations);
            (0, studioMaterials_1.registerStudioMaterialsForAssets)(sceneData.assets);
        }
        const entry = {
            scene: StudioARScene_1.StudioARScene,
            passProps: {
                sceneData,
                onReady: handleSceneReady,
                onSceneChange: onSceneChangeRef.current,
                onPlaneDetected: onPlaneDetectedRef.current,
                onPlaneSelected: onPlaneSelectedRef.current,
                noAssetsMessage: noAssetsMessageRef.current,
                variableStore: variableStoreRef.current,
                placementStore: placementStoreRef.current,
                placementApiRef,
            },
        };
        if (ViroPlatform_1.isQuest || ViroPlatform_1.isVisionOS) {
            // Setting vrSceneEntry mounts ViroXRSceneNavigator with StudioARScene as
            // vrInitialScene, so VRActivity launches straight into content. visionOS reads the
            // same prop — its ImmersiveSpace cannot host a ViroARScene either — so it takes this
            // path rather than pushing onto a navigator that starts on the loading scene.
            setVrSceneEntry(entry);
        }
        else {
            navigatorRef.current?.arSceneNavigator?.push(entry);
        }
    }, [resolveSceneId, handleSceneReady]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const isCancelled = () => cancelled;
        loadScene(isCancelled).catch((e) => {
            if (cancelled)
                return;
            const err = e instanceof Error ? e : new Error(String(e));
            const handler = onErrorRef.current;
            if (handler)
                handler(err);
            else
                console.error("[Studio] Failed to load scene:", err);
        });
        return () => {
            cancelled = true;
        };
    }, [sceneId, loadScene]);
    // Quest has no camera passthrough, so during load it always needs something
    // on screen: the caller's loadingView, else a built-in spinner. (AR shows the
    // live camera, so its overlay stays opt-in.) visionOS needs it for a different
    // reason with the same effect — its passthrough is in the ImmersiveSpace, not in
    // this window, so the window would otherwise be blank while the scene loads.
    if ((ViroPlatform_1.isQuest || ViroPlatform_1.isVisionOS) && !vrSceneEntry) {
        return (<react_native_1.View style={styles.loader}>
        {loadingView ?? <react_native_1.ActivityIndicator size="large" color="#ffffff"/>}
      </react_native_1.View>);
    }
    return (<StudioSceneErrorBoundary_1.StudioSceneErrorBoundary sceneId={sceneId} onError={onError} renderError={renderError}>
      <react_native_1.View style={style ?? react_native_1.StyleSheet.absoluteFill}>
        <ViroXRSceneNavigator_1.ViroXRSceneNavigator ref={navigatorRef} arInitialScene={{ scene: LoadingARScene }} vrInitialScene={vrSceneEntry ?? { scene: LoadingVRScene }} worldAlignment={worldAlignment} autofocus={autofocus} numberOfTrackedImages={numberOfTrackedImages} occlusionMode={occlusionMode} onExitViro={onExitViro} style={react_native_1.StyleSheet.absoluteFill}/>
        {/* Absolutely filled so the overlay covers the navigator instead of
            taking flow space beneath it. */}
        {!isSceneReady && loadingView && (<react_native_1.View style={react_native_1.StyleSheet.absoluteFill}>{loadingView}</react_native_1.View>)}
        {recordingIndicator && (<react_native_1.View pointerEvents="box-none" style={[styles.recordingOverlay, { top: DEFAULT_RECORDING_TOP }]}>
            <StudioRecordingIndicator_1.StudioRecordingIndicator />
          </react_native_1.View>)}
        {!ViroPlatform_1.isQuest && placementStoreRef.current && (<StudioPlacementOverlay store={placementStoreRef.current} apiRef={placementApiRef} getName={getPlacementName}/>)}
        {placementIndicator && (<react_native_1.View pointerEvents="none" style={[styles.placementBanner, { top: PLACEMENT_BANNER_TOP }]}>
            <StudioPlacementIndicator_1.StudioPlacementIndicator />
          </react_native_1.View>)}
      </react_native_1.View>
    </StudioSceneErrorBoundary_1.StudioSceneErrorBoundary>);
});
