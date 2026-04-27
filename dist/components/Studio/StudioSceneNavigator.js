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
const ViroARSceneNavigator_1 = require("../AR/ViroARSceneNavigator");
const StudioARScene_1 = require("./StudioARScene");
// Minimal placeholder rendered while rvGetScene is in-flight.
function LoadingScene() { return <ViroARScene_1.ViroARScene />; }
/**
 * Drop-in AR scene component that fetches and renders a Studio-authored scene.
 *
 * Auth is handled by the ReactVision API key wired through the Expo plugin
 * (rvProjectId in app.json). No Supabase client needed.
 *
 * Usage:
 *   <StudioSceneNavigator sceneId="abc-123-uuid" style={StyleSheet.absoluteFill} />
 */
function StudioSceneNavigator({ sceneId, worldAlignment = "Gravity", autofocus = true, style, onSceneReady, onError, onSceneChange, }) {
    const navigatorRef = (0, react_1.useRef)(null);
    const loadedSceneIdRef = (0, react_1.useRef)(null);
    const onSceneReadyRef = (0, react_1.useRef)(onSceneReady);
    const onErrorRef = (0, react_1.useRef)(onError);
    const onSceneChangeRef = (0, react_1.useRef)(onSceneChange);
    onSceneReadyRef.current = onSceneReady;
    onErrorRef.current = onError;
    onSceneChangeRef.current = onSceneChange;
    const loadScene = (0, react_1.useCallback)(async (id, isCancelled) => {
        // Wait one frame to ensure the native view is mounted and has a node handle.
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        if (isCancelled())
            return;
        const nav = navigatorRef.current?.arSceneNavigator;
        if (!nav) {
            throw new Error("ViroARSceneNavigator not mounted");
        }
        const result = await nav.rvGetScene(id);
        if (isCancelled())
            return;
        if (!result?.success) {
            throw new Error(result?.error ?? "rvGetScene failed");
        }
        if (typeof result.data !== "string") {
            throw new Error("rvGetScene returned no data");
        }
        let sceneData;
        try {
            sceneData = JSON.parse(result.data);
        }
        catch (parseErr) {
            throw new Error(`Failed to parse scene response: ${parseErr.message}`);
        }
        if (isCancelled())
            return;
        loadedSceneIdRef.current = id;
        nav.push({
            scene: StudioARScene_1.StudioARScene,
            passProps: {
                sceneData,
                onReady: onSceneReadyRef.current,
                onSceneChange: onSceneChangeRef.current,
            },
        });
    }, []);
    (0, react_1.useEffect)(() => {
        if (loadedSceneIdRef.current === sceneId)
            return;
        let cancelled = false;
        const isCancelled = () => cancelled;
        loadScene(sceneId, isCancelled).catch((e) => {
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
    return (<ViroARSceneNavigator_1.ViroARSceneNavigator ref={navigatorRef} initialScene={{ scene: LoadingScene }} worldAlignment={worldAlignment} autofocus={autofocus} style={style ?? react_native_1.StyleSheet.absoluteFill}/>);
}
