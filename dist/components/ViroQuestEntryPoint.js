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
exports.ViroQuestEntryPoint = ViroQuestEntryPoint;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const VRQuestNavigatorBridge_1 = require("./Utilities/VRQuestNavigatorBridge");
const VRModuleOpenXR_1 = require("./Utilities/VRModuleOpenXR");
const ViroVRSceneNavigator_1 = require("./ViroVRSceneNavigator");
const StudioSceneErrorBoundary_1 = require("./Studio/StudioSceneErrorBoundary");
const ViroScene_1 = require("./ViroScene");
const ViroAmbientLight_1 = require("./ViroAmbientLight");
const ViroText_1 = require("./ViroText");
// Rendered in place of the crashed scene. Has to be a full, valid Viro scene
// (not a plain RN <View>) — VRActivity's display is exclusively driven by the
// OpenXR compositor, so a bare 2D view would never appear.
function QuestCrashFallbackScene() {
    return (<ViroScene_1.ViroScene>
      <ViroAmbientLight_1.ViroAmbientLight color="#ffffff" intensity={1000}/>
      <ViroText_1.ViroText text="Something went wrong loading this scene." position={[0, 0, -2]} width={3} height={1} style={{ fontFamily: "Arial", fontSize: 20, color: "#FFFFFF", textAlign: "center" }}/>
    </ViroScene_1.ViroScene>);
}
/**
 * Drop-in root component for VRActivity on Meta Quest.
 *
 * The library auto-registers this as 'VRQuestScene' when imported, so most
 * apps need no manual setup. ViroXRSceneNavigator (panel side) calls
 * setIntent() with the initial scene and renderer config before launching
 * VRActivity. This component reads that intent, mounts ViroVRSceneNavigator
 * with key={intentKey} (fresh stack per intent), and populates the bridge
 * viewTag so VRModuleOpenXR ops (recenterTracking, setPassthroughEnabled)
 * work without a direct ref to ViroVRSceneNavigator.
 */
function ViroQuestEntryPoint() {
    const [intent, setIntent] = React.useState(() => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.getIntent());
    const navRef = React.useRef(null);
    React.useEffect(() => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.onIntent(setIntent), []);
    // Wire hardware back button to exit VR. Apps that need custom back behaviour
    // can call AppRegistry.registerComponent('VRQuestScene', ...) to override.
    //
    // Reads the intent from the bridge at press time (not the `intent` state
    // closed over above) so a VR relaunch that swaps in a new onExitViro after
    // this effect's first run is still honoured — exitVRScene() posts the
    // native finish() to the main looper asynchronously, so calling
    // onExitViro() first here still runs before VRActivity actually finishes.
    React.useEffect(() => {
        const sub = react_native_1.BackHandler.addEventListener("hardwareBackPress", () => {
            VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.getIntent()?.rendererConfig?.onExitViro?.();
            (0, VRModuleOpenXR_1.exitVRScene)();
            return true;
        });
        return () => sub.remove();
    }, []);
    // Forward bridge ops (push/pop/etc.) to the live navigator.
    React.useEffect(() => {
        if (!intent)
            return;
        return VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.subscribeOps((op) => {
            const nav = navRef.current;
            if (!nav)
                return;
            if (op.type === "push")
                nav.push(op.scene);
            else if (op.type === "pop")
                nav.pop();
            else if (op.type === "popN")
                nav.popN(op.n);
            else if (op.type === "replace")
                nav.replace(op.scene);
            else if (op.type === "jump")
                nav.jump(op.scene);
        });
    }, [intent?.intentKey]);
    // Publish the native view tag so VRModuleOpenXR callers can target this view.
    React.useEffect(() => {
        if (!intent)
            return;
        const t = setTimeout(() => {
            const tag = (0, react_native_1.findNodeHandle)(navRef.current);
            if (tag != null)
                VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.setViewTag(tag);
        }, 100);
        return () => {
            clearTimeout(t);
            VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.setViewTag(null);
        };
    }, [intent?.intentKey]);
    if (!intent)
        return null;
    const { initialScene, rendererConfig } = intent;
    return (<StudioSceneErrorBoundary_1.StudioSceneErrorBoundary onError={(error) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.reportQuestError(error)} renderError={() => (<ViroVRSceneNavigator_1.ViroVRSceneNavigator initialScene={{ scene: QuestCrashFallbackScene }} style={react_native_1.StyleSheet.absoluteFill}/>)}>
      <ViroVRSceneNavigator_1.ViroVRSceneNavigator ref={navRef} key={intent.intentKey} initialScene={initialScene} {...rendererConfig} style={react_native_1.StyleSheet.absoluteFill}/>
    </StudioSceneErrorBoundary_1.StudioSceneErrorBoundary>);
}
