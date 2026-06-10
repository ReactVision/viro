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
exports.StudioSceneNavigator = StudioSceneNavigator;
const React = __importStar(require("react"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const ViroARScene_1 = require("../AR/ViroARScene");
const ViroScene_1 = require("../ViroScene");
const ViroXRSceneNavigator_1 = require("../ViroXRSceneNavigator");
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
const animationRegistry_1 = require("./domain/animationRegistry");
const studioMaterials_1 = require("./domain/studioMaterials");
const variableStore_1 = require("./domain/variableStore");
const StudioARScene_1 = require("./StudioARScene");
const VRTStudioModule_1 = require("./VRTStudioModule");
function LoadingARScene() { return <ViroARScene_1.ViroARScene />; }
function LoadingVRScene() { return <ViroScene_1.ViroScene />; }
const styles = react_native_1.StyleSheet.create({
    loader: {
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000000",
    },
});
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
function StudioSceneNavigator({ sceneId, worldAlignment = "Gravity", autofocus = true, style, onSceneReady, onError, onSceneChange, onExitViro, }) {
    const navigatorRef = (0, react_1.useRef)(null);
    const loadedSceneIdRef = (0, react_1.useRef)(null);
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
    const onSceneReadyRef = (0, react_1.useRef)(onSceneReady);
    const onErrorRef = (0, react_1.useRef)(onError);
    const onSceneChangeRef = (0, react_1.useRef)(onSceneChange);
    onSceneReadyRef.current = onSceneReady;
    onErrorRef.current = onError;
    onSceneChangeRef.current = onSceneChange;
    // On Quest: holds the resolved scene entry. ViroXRSceneNavigator is not
    // rendered until this is non-null, so VRActivity always launches into content.
    const [vrSceneEntry, setVrSceneEntry] = (0, react_1.useState)(null);
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
        // On Quest: pre-register animations and materials before VRActivity launches.
        // This mirrors the module-level registration pattern used by XRSceneContent —
        // native registrations complete before any Viro components mount, eliminating
        // the race between registerAnimations/createMaterials native calls and the
        // Fabric commit that creates those components.
        if (ViroPlatform_1.isQuest) {
            (0, animationRegistry_1.registerSceneAnimations)(sceneData.animations);
            (0, studioMaterials_1.registerStudioMaterialsForAssets)(sceneData.assets);
        }
        const entry = {
            scene: StudioARScene_1.StudioARScene,
            passProps: {
                sceneData,
                onReady: onSceneReadyRef.current,
                onSceneChange: onSceneChangeRef.current,
                variableStore: variableStoreRef.current,
            },
        };
        if (ViroPlatform_1.isQuest) {
            // On Quest: setting vrSceneEntry triggers ViroXRSceneNavigator to mount
            // with StudioARScene as vrInitialScene — VRActivity gets content immediately.
            setVrSceneEntry(entry);
        }
        else {
            navigatorRef.current?.arSceneNavigator?.push(entry);
        }
    }, [resolveSceneId]);
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
        return () => { cancelled = true; };
    }, [sceneId, loadScene]);
    // On Quest: show a spinner until scene data is ready, then mount
    // ViroXRSceneNavigator (which launches VRActivity with content immediately).
    if (ViroPlatform_1.isQuest && !vrSceneEntry) {
        return (<react_native_1.View style={styles.loader}>
        <react_native_1.ActivityIndicator size="large" color="#ffffff"/>
      </react_native_1.View>);
    }
    return (<ViroXRSceneNavigator_1.ViroXRSceneNavigator ref={navigatorRef} arInitialScene={{ scene: LoadingARScene }} vrInitialScene={vrSceneEntry ?? { scene: LoadingVRScene }} worldAlignment={worldAlignment} autofocus={autofocus} onExitViro={onExitViro} style={style ?? react_native_1.StyleSheet.absoluteFill}/>);
}
