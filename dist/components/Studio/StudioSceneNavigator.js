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
const jsx_runtime_1 = require("react/jsx-runtime");
const React = __importStar(require("react"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const ViroARScene_1 = require("../AR/ViroARScene");
const ViroScene_1 = require("../ViroScene");
const ViroXRSceneNavigator_1 = require("../ViroXRSceneNavigator");
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
const VRQuestNavigatorBridge_1 = require("../Utilities/VRQuestNavigatorBridge");
const StudioRecordingIndicator_1 = require("./StudioRecordingIndicator");
const StudioPlacementIndicator_1 = require("./StudioPlacementIndicator");
const StudioColocationIndicator_1 = require("./StudioColocationIndicator");
const placementBannerStore_1 = require("./domain/placementBannerStore");
const colocationStore_1 = require("./domain/colocationStore");
const controller_1 = require("./colocation/controller");
const animationRegistry_1 = require("./domain/animationRegistry");
const studioMaterials_1 = require("./domain/studioMaterials");
const variableStore_1 = require("./domain/variableStore");
const placementStore_1 = require("./domain/placementStore");
const studioApiError_1 = require("./domain/studioApiError");
const StudioARScene_1 = require("./StudioARScene");
const StudioSceneErrorBoundary_1 = require("./StudioSceneErrorBoundary");
const VRTStudioModule_1 = require("./VRTStudioModule");
// Tone mapping off here too, or the camera feed takes the default Hable curve for
// the moment a scene is loading and then snaps when the authored scene mounts.
function LoadingARScene() {
    return (0, jsx_runtime_1.jsx)(ViroARScene_1.ViroARScene, { toneMappingEnabled: false });
}
function LoadingVRScene() {
    return (0, jsx_runtime_1.jsx)(ViroScene_1.ViroScene, { toneMappingEnabled: false });
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
    colocationOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        paddingHorizontal: 24,
    },
});
const PLACEMENT_BANNER_TOP = react_native_1.Platform.OS === "android" ? (react_native_1.StatusBar.currentHeight ?? 24) + 12 : 64;
// Bottom-centre, clear of the top pills; approximate, like the top insets.
const COLOCATION_INDICATOR_BOTTOM = react_native_1.Platform.OS === "android" ? 24 : 40;
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
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: react_native_1.StyleSheet.absoluteFill, onStartShouldSetResponder: () => true, onResponderRelease: handleRelease }));
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
exports.StudioSceneNavigator = (0, react_1.forwardRef)(function StudioSceneNavigator({ sceneId, worldAlignment = "Gravity", autofocus = true, style, onSceneReady, onError, onSceneChange, onExitViro, onSceneLoaded, onPlaneDetected, onPlaneSelected, noAssetsMessage, loadingView, renderError, recordingIndicator = true, placementIndicator = true, colocation, colocationIndicator = true, onColocationStateChange, onColocationRoom, }, ref) {
    const navigatorRef = (0, react_1.useRef)(null);
    const loadedSceneIdRef = (0, react_1.useRef)(null);
    const [isSceneReady, setIsSceneReady] = (0, react_1.useState)(false);
    // A failed load has to be state, not just an onError callback: the loading
    // overlay is gated on isSceneReady, which never flips when the load throws,
    // so without this the host is left showing its loadingView forever.
    const [loadError, setLoadError] = (0, react_1.useState)(null);
    const [loadAttempt, setLoadAttempt] = (0, react_1.useState)(0);
    // Deliberately does not clear loadedSceneIdRef: it is only assigned after a
    // successful parse, so it is already null on the path that can fail. Leaving
    // it means a retry after a scene did load is a no-op rather than a second
    // push of the same scene onto the navigator.
    const retryLoad = (0, react_1.useCallback)(() => {
        setLoadError(null);
        setIsSceneReady(false);
        setLoadAttempt((attempt) => attempt + 1);
    }, []);
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
    const rememberPlacementNames = (0, react_1.useCallback)((sceneData) => {
        placementNamesRef.current = new Map(sceneData.assets
            .filter((a) => (0, placementStore_1.isTapToPlaceAsset)(a))
            .map((a) => [a.id, a.name ?? ""]));
    }, []);
    const onColocationStateChangeRef = (0, react_1.useRef)(onColocationStateChange);
    const onColocationRoomRef = (0, react_1.useRef)(onColocationRoom);
    onColocationStateChangeRef.current = onColocationStateChange;
    onColocationRoomRef.current = onColocationRoom;
    // One controller for the navigator's lifetime, handed to every scene like
    // the variable store, so a session survives scene pushes. The AR session
    // persists across a push too, so nothing re-resolves on NAVIGATE.
    const colocationRef = (0, react_1.useRef)(null);
    // This navigator's token in the module-level store, which another mounted
    // navigator may be writing too.
    const [colocationStoreOwner] = (0, react_1.useState)(() => ({}));
    if (colocationRef.current === null) {
        const controller = new controller_1.StudioColocationController();
        controller.setNavigatorAccessor(() => navigatorRef.current?.arSceneNavigator);
        controller.onStateChange = (state) => {
            colocationStore_1.studioColocationStore.set(state, colocationStoreOwner);
            onColocationStateChangeRef.current?.(state);
        };
        controller.onRoom = (room) => onColocationRoomRef.current?.(room);
        controller.onOriginPrompt = (prompt) => colocationStore_1.studioColocationStore.setOriginPrompt(prompt, colocationStoreOwner);
        colocationRef.current = controller;
    }
    (0, react_1.useEffect)(() => {
        const controller = colocationRef.current;
        colocationStore_1.studioColocationStore.setFinishScanHandler(() => controller?.finishScan() ?? false, colocationStoreOwner);
        return () => {
            controller?.dispose();
            colocationStore_1.studioColocationStore.reset(colocationStoreOwner);
        };
    }, [colocationStoreOwner]);
    (0, react_1.useEffect)(() => {
        colocationStore_1.studioColocationStore.setBuiltInIndicatorShown(colocationIndicator, colocationStoreOwner);
    }, [colocationIndicator, colocationStoreOwner]);
    (0, react_1.useEffect)(() => {
        colocationRef.current?.request(colocation ?? null, {
            restartFailed: false,
        });
    }, [colocation]);
    // The tap-to-place overlay would catch taps for content that is withheld
    // while a shared session is set up.
    const [colocationPending, setColocationPending] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const controller = colocationRef.current;
        if (!controller)
            return;
        const update = () => setColocationPending(controller.getFrame().phase === "pending");
        update();
        return controller.subscribe(update);
    }, []);
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
    // VRActivity is a separate React root — its own error boundary
    // (ViroQuestEntryPoint) can't reach this component's onError prop directly,
    // so it relays crashes through VRQuestNavigatorBridge instead. Forwarding
    // here means a host's existing onError → Sentry wiring for phone-AR errors
    // picks up Quest scene crashes too, with no changes needed on the host side.
    React.useEffect(() => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.onQuestError((error) => onErrorRef.current?.(error)), []);
    // Stable so passProps stays referentially steady across renders. Idempotent,
    // so StrictMode's dev double-invoke of StudioARScene's onReady effect is safe.
    const handleSceneReady = (0, react_1.useCallback)(() => {
        setIsSceneReady(true);
        onSceneReadyRef.current?.();
    }, []);
    // What every scene the navigator pushes is given. The first-scene callbacks
    // reach the initial scene alone, as their props say.
    const sceneEntry = (0, react_1.useCallback)((sceneData, initial, skipOnLoadFunction = false) => ({
        scene: StudioARScene_1.StudioARScene,
        passProps: {
            sceneData,
            ...(initial
                ? {
                    onReady: handleSceneReady,
                    onPlaneDetected: onPlaneDetectedRef.current,
                    onPlaneSelected: onPlaneSelectedRef.current,
                }
                : {}),
            onSceneChange: onSceneChangeRef.current,
            noAssetsMessage: noAssetsMessageRef.current,
            variableStore: variableStoreRef.current,
            placementStore: placementStoreRef.current,
            placementApiRef,
            colocation: colocationRef.current,
            ...(skipOnLoadFunction ? { skipOnLoadFunction } : {}),
        },
    }), [handleSceneReady]);
    // A shared session navigates through here, on the device that ran the
    // NAVIGATE and on every device that follows it.
    (0, react_1.useEffect)(() => {
        const controller = colocationRef.current;
        controller?.setScenePusher((sceneData, { skipOnLoadFunction }) => {
            rememberPlacementNames(sceneData);
            navigatorRef.current?.arSceneNavigator?.push(sceneEntry(sceneData, false, skipOnLoadFunction));
            onSceneChangeRef.current?.(sceneData.scene.id, sceneData.scene.name ?? sceneData.scene.id);
        });
        return () => controller?.setScenePusher(null);
    }, [sceneEntry, rememberPlacementNames]);
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
            // arSceneNavigator.takeScreenshot); on Quest it's the XR navigator's
            // bridge, which forwards it to VRModuleOpenXR.
            const nav = navigatorRef.current?.arSceneNavigator;
            if (typeof nav?.takeScreenshot !== "function") {
                return Promise.resolve({ success: false });
            }
            return nav.takeScreenshot(fileName, saveToCameraRoll);
        },
        leaveColocation: () => colocationRef.current?.leave(),
        retryColocation: () => colocationRef.current?.retry() ?? false,
        getColocationRoom: () => colocationRef.current?.getRoom() ?? null,
        finishColocationScan: () => colocationRef.current?.finishScan() ?? false,
    }), []);
    const resolveSceneId = (0, react_1.useCallback)(async () => {
        if (sceneId)
            return sceneId;
        const projectResult = await VRTStudioModule_1.VRTStudioModule.rvGetProject();
        if (!projectResult.success) {
            throw (0, studioApiError_1.studioApiError)("rvGetProject", projectResult.error);
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
        // Id on a field, not in the message: interpolated it would open a new
        // group per project in the host's error reporter.
        throw Object.assign(new Error("Project has no scenes"), {
            projectId: project.id,
        });
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
            throw (0, studioApiError_1.studioApiError)("rvGetScene", result.error);
        }
        if (typeof result.data !== "string") {
            throw new Error("rvGetScene returned no data");
        }
        const sceneData = JSON.parse(result.data);
        if (isCancelled())
            return;
        loadedSceneIdRef.current = resolvedSceneId;
        // Names for the tap-to-place prompt (overlay reads this on placement).
        rememberPlacementNames(sceneData);
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
        const entry = sceneEntry(sceneData, true);
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
    }, [resolveSceneId, sceneEntry, rememberPlacementNames]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const isCancelled = () => cancelled;
        loadScene(isCancelled).catch((e) => {
            if (cancelled)
                return;
            const err = e instanceof Error ? e : new Error(String(e));
            setLoadError(err);
            const handler = onErrorRef.current;
            if (handler)
                handler(err);
            else
                console.error("[Studio] Failed to load scene:", err);
        });
        return () => {
            cancelled = true;
        };
        // loadAttempt is the retry trigger: loadScene is stable within a mount, so
        // bumping it is what re-runs the fetch without remounting the AR session.
    }, [sceneId, loadScene, loadAttempt]);
    // Falls back to loadingView when the host passes no renderError, so callers
    // that never opted in keep exactly their previous behaviour.
    const loadErrorView = loadError ? renderError?.(loadError, retryLoad) : null;
    const overlay = isSceneReady ? null : (loadErrorView ?? loadingView ?? null);
    // Before vrSceneEntry resolves, VRActivity hasn't been launched yet (Quest)
    // or the ImmersiveSpace hasn't opened yet (visionOS), so this window has
    // nothing of its own to show — it always needs something on screen: the
    // caller's loadingView, else a built-in spinner. (Phone AR shows the live
    // camera during load, so its overlay stays opt-in.) This branch sits above
    // the error boundary, which is why it has to handle loadError itself.
    // (Quest 3/3S do have colour passthrough once the scene mounts — this branch
    // is about the pre-launch panel window, not about passthrough support.)
    //
    // visionOS needs the same treatment for a different reason: its passthrough lives in
    // the ImmersiveSpace, not in this window, so the window would otherwise sit blank
    // while the scene loads.
    if ((ViroPlatform_1.isQuest || ViroPlatform_1.isVisionOS) && !vrSceneEntry) {
        return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.loader, children: overlay ?? (0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { size: "large", color: "#ffffff" }) }));
    }
    return ((0, jsx_runtime_1.jsx)(StudioSceneErrorBoundary_1.StudioSceneErrorBoundary, { sceneId: sceneId, onError: onError, renderError: renderError, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: style ?? react_native_1.StyleSheet.absoluteFill, children: [(0, jsx_runtime_1.jsx)(ViroXRSceneNavigator_1.ViroXRSceneNavigator, { ref: navigatorRef, arInitialScene: { scene: LoadingARScene }, vrInitialScene: vrSceneEntry ?? { scene: LoadingVRScene }, worldAlignment: worldAlignment, autofocus: autofocus, numberOfTrackedImages: numberOfTrackedImages, occlusionMode: occlusionMode, 
                    // Bloom defaults on natively and the editor does not preview it, so a
                    // bright material glows on the phone and nowhere else.
                    //
                    // HDR stays ON even though its default tone curve is the other half of
                    // that problem, because PBR rides on it: VROChoreographer::isPBREnabled
                    // is `_hdrEnabled && _pbrEnabled`, and the whole PBR branch of
                    // VROShaderFactory goes with it, so roughness, metalness and the ambient
                    // occlusion map are read by nothing and a PBR material falls back to
                    // Blinn. The tone curve is switched off per scene instead, which is what
                    // `toneMappingEnabled` on StudioARScene does. Passed explicitly rather
                    // than left to the native default, so this cannot be switched off again
                    // without meeting the reason it is on.
                    //
                    // Off on Quest, and only there: the HDR composite occludes the
                    // passthrough layer on that OpenXR compositor, so the room disappears
                    // behind the scene. PBR on Quest goes with it, which is the trade — a
                    // headset that shows nothing of the room is the worse of the two.
                    hdrEnabled: !ViroPlatform_1.isQuest, bloomEnabled: false, onExitViro: onExitViro, 
                    // Quest-only (no-op on phones). Quest mounts a ViroScene root rather
                    // than ViroARScene outside a shared session (see StudioARScene for
                    // why), and a virtual root turns none of this on by itself, so both
                    // are asked for outright.
                    // They reach VRActivity through the navigator bridge and do not depend
                    // on which root the scene uses.
                    passthroughEnabled: ViroPlatform_1.isQuest ? true : undefined, handTrackingEnabled: ViroPlatform_1.isQuest ? true : undefined, style: react_native_1.StyleSheet.absoluteFill }), overlay && (0, jsx_runtime_1.jsx)(react_native_1.View, { style: react_native_1.StyleSheet.absoluteFill, children: overlay }), recordingIndicator && ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: [styles.recordingOverlay, { top: DEFAULT_RECORDING_TOP }], children: (0, jsx_runtime_1.jsx)(StudioRecordingIndicator_1.StudioRecordingIndicator, {}) })), !ViroPlatform_1.isQuest && placementStoreRef.current && !colocationPending && ((0, jsx_runtime_1.jsx)(StudioPlacementOverlay, { store: placementStoreRef.current, apiRef: placementApiRef, getName: getPlacementName })), placementIndicator && ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [styles.placementBanner, { top: PLACEMENT_BANNER_TOP }], children: (0, jsx_runtime_1.jsx)(StudioPlacementIndicator_1.StudioPlacementIndicator, {}) })), colocationIndicator && ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: [
                        styles.colocationOverlay,
                        { bottom: COLOCATION_INDICATOR_BOTTOM },
                    ], children: (0, jsx_runtime_1.jsx)(StudioColocationIndicator_1.StudioColocationIndicator, {}) }))] }) }));
});
