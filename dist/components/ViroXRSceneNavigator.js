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
exports.ViroXRSceneNavigator = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroARSceneNavigator_1 = require("./AR/ViroARSceneNavigator");
const ViroPlatform_1 = require("./Utilities/ViroPlatform");
const VRQuestNavigatorBridge_1 = require("./Utilities/VRQuestNavigatorBridge");
const VRLauncher = react_native_1.NativeModules.VRLauncher;
// Quest VR requires a lifecycle-correct VRActivity that drives
// ReactHostImpl.onHostResume(VRActivity) on entry. The skipActivityIdentity
// AssertionOnHostPause feature flag (used to suppress the racy MainActivity.
// onPause assertion when currentActivity has been promoted to VR) is only
// honored on RN >= 0.83. Without it, MainActivity.onPause hard-crashes via
// Assertions.assertCondition, so the entire VR path requires RN 0.83+.
// AR continues to work on RN >= 0.81 (Expo 54+) — only the Quest VR launch
// is gated.
const MIN_RN_FOR_VR = { major: 0, minor: 83 };
function checkRNVersionForVR() {
    let version = "unknown";
    try {
        version = require("react-native/package.json").version;
        const [maj, min] = version.split(".").map((n) => parseInt(n, 10));
        if (Number.isFinite(maj) &&
            Number.isFinite(min) &&
            (maj > MIN_RN_FOR_VR.major ||
                (maj === MIN_RN_FOR_VR.major && min >= MIN_RN_FOR_VR.minor))) {
            return;
        }
    }
    catch {
        // fall through to throw with version="unknown"
    }
    throw new Error(`[Viro] Meta Quest VR requires React Native >= ${MIN_RN_FOR_VR.major}.${MIN_RN_FOR_VR.minor} ` +
        `(Expo SDK >= 55). Detected: ${version}. ` +
        `AR features still work on this version — only ViroXRSceneNavigator's VR path on Quest is gated.`);
}
/**
 * Cross-reality scene navigator. Picks the right underlying navigator at runtime:
 *
 *  - **iOS / non-Quest Android** → `ViroARSceneNavigator` (rendered inline)
 *  - **Meta Quest** → launches VRActivity via `VRLauncher.launchVRScene()` and
 *    forwards all navigator operations (push/pop/etc.) to the
 *    `ViroVRSceneNavigator` running there via `VRQuestNavigatorBridge`.
 *    Render output is null — VRActivity owns the display.
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 *
 * Renderer flags (`hdrEnabled`, `pbrEnabled`, `bloomEnabled`, `shadowsEnabled`,
 * `passthroughEnabled`, etc.) are forwarded to ViroVRSceneNavigator on Quest
 * via the intent bridge.
 */
exports.ViroXRSceneNavigator = React.forwardRef(function ViroXRSceneNavigator(props, ref) {
    const { initialScene, arInitialScene, vrInitialScene, 
    // VR-only renderer config — forwarded via bridge on Quest
    hdrEnabled, pbrEnabled, bloomEnabled, shadowsEnabled, multisamplingEnabled, vrModeEnabled, passthroughEnabled, handTrackingEnabled, onExitViro, debug, ...rest } = props;
    // Inner ref used on the AR path to capture the ViroARSceneNavigator instance.
    const arRef = React.useRef(null);
    // Expose navigator interface on the ref.
    // Quest: proxy push/pop/etc. through VRQuestNavigatorBridge to VRActivity.
    // AR:    expose the underlying ViroARSceneNavigator instance directly.
    React.useImperativeHandle(ref, () => {
        if (ViroPlatform_1.isQuest) {
            const bridgeNav = {
                push: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "push", scene }),
                replace: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "replace", scene }),
                jump: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "jump", scene }),
                pop: () => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "pop" }),
                popN: (n) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "popN", n }),
            };
            return { sceneNavigator: bridgeNav, arSceneNavigator: bridgeNav };
        }
        return arRef.current;
    }, []);
    // Track AppState so we can detect background → active transitions.
    const appStateRef = React.useRef(react_native_1.AppState.currentState);
    // Timestamp at which AppState last left "active". Lets us distinguish a
    // genuine Quest-menu return (background lasts seconds) from racy
    // background→active bounces caused by the dual-Activity ReactHost
    // transitioning state (background lasts <500ms). Only the former should
    // re-launch VR; the latter would trigger a no-op startActivity that can
    // contribute to the lifecycle storm in some configurations.
    const leftActiveAtRef = React.useRef(0);
    // On Quest: register the intent (scene + renderer config) then launch VRActivity.
    // Also re-launch when the app returns from background (e.g. Quest system menu),
    // because VRActivity auto-finishes when MainActivity resumes.
    React.useEffect(() => {
        if (!ViroPlatform_1.isQuest)
            return;
        checkRNVersionForVR();
        const scene = vrInitialScene ?? initialScene;
        if (scene) {
            VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.setIntent(scene, {
                hdrEnabled,
                pbrEnabled,
                bloomEnabled,
                shadowsEnabled,
                multisamplingEnabled,
                vrModeEnabled,
                passthroughEnabled,
                handTrackingEnabled,
                onExitViro,
                debug,
            });
        }
        VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.setVRActive(true);
        VRLauncher?.launchVRScene?.();
        const sub = react_native_1.AppState.addEventListener("change", (nextState) => {
            const prev = appStateRef.current;
            appStateRef.current = nextState;
            if (prev === "active" && nextState !== "active") {
                leftActiveAtRef.current = Date.now();
            }
            // Re-launch VR when the app returns from being backgrounded by the system
            // (Quest menu, home, recents). Explicit exitVRScene() clears isVRActive()
            // before finishing VRActivity, so Activity-transition-driven background→active
            // cycles are ignored here.
            if (prev !== "active" && nextState === "active" && VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.isVRActive()) {
                // Skip if we were only briefly out of "active" — that's a racy
                // dual-Activity ReactHost bounce, not a genuine menu return.
                const backgroundedFor = Date.now() - leftActiveAtRef.current;
                if (leftActiveAtRef.current > 0 && backgroundedFor < 1500)
                    return;
                VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.setVRActive(true);
                VRLauncher?.launchVRScene?.();
            }
        });
        return () => sub.remove();
    }, []);
    // Quest renders nothing here — VRActivity owns the display.
    if (ViroPlatform_1.isQuest)
        return null;
    const scene = arInitialScene ?? initialScene;
    if (!scene) {
        console.warn("[Viro] ViroXRSceneNavigator requires `arInitialScene` or `initialScene`.");
        return null;
    }
    return (<ViroARSceneNavigator_1.ViroARSceneNavigator ref={arRef} initialScene={scene} {...rest}/>);
});
