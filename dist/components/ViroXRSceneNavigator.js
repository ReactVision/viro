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
const ViroSceneNavigator_1 = require("./ViroSceneNavigator");
const ViroPlatform_1 = require("./Utilities/ViroPlatform");
const ViroImmersiveSpaceGate_1 = require("./VisionOS/ViroImmersiveSpaceGate");
const ViroVisionOSModule_1 = require("./VisionOS/ViroVisionOSModule");
const VRQuestNavigatorBridge_1 = require("./Utilities/VRQuestNavigatorBridge");
const VRModuleOpenXR_1 = require("./Utilities/VRModuleOpenXR");
const ViroSceneNavigatorModule = react_native_1.NativeModules.VRTSceneNavigatorModule;
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
// Declared in the manifest by withViroAndroid.ts, but Horizon OS treats these
// as dangerous runtime permissions — the manifest entry alone doesn't grant
// them. USE_ANCHOR_API/USE_SCENE gate plane & anchor data (needed now that the
// ViroARScene root mounts on Quest too); HEADSET_CAMERA gates the passthrough
// Camera2 feed ViroObjectDetector reads. Requested once before the first VR
// launch; denial degrades gracefully elsewhere (no planes / no passthrough
// feed, see QuestPassthroughCamera) rather than blocking VR.
const QUEST_RUNTIME_PERMISSIONS = [
    "horizonos.permission.USE_ANCHOR_API",
    "com.oculus.permission.USE_SCENE",
    "horizonos.permission.HEADSET_CAMERA",
];
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
 *  - **Apple Vision Pro** → opens the visionOS ImmersiveSpace and renders the scene
 *    through `ViroSceneNavigator`. Unlike Quest, the ImmersiveSpace shares this
 *    React runtime, so the scene tree stays mounted here rather than being forwarded.
 *  - **Meta Quest** → launches VRActivity via `VRLauncher.launchVRScene()` and
 *    forwards all navigator operations (push/pop/etc.) to the
 *    `ViroVRSceneNavigator` running there via `VRQuestNavigatorBridge`.
 *    Render output is null — VRActivity owns the display.
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 *
 * Renderer flags (`hdrEnabled`, `pbrEnabled`, `bloomEnabled`, `shadowsEnabled`,
 * `multisamplingEnabled`) reach ViroARSceneNavigator as props and
 * ViroVRSceneNavigator on Quest via the intent bridge. visionOS gets neither:
 * ViroSceneNavigator does not take them. `passthroughEnabled`, `vrModeEnabled`
 * and `handTrackingEnabled` are Quest-only and go over the bridge alone.
 */
exports.ViroXRSceneNavigator = React.forwardRef(function ViroXRSceneNavigator(props, ref) {
    // Opens the scan the mount effect reads. Here rather than in an effect because a parent
    // renders before its children: this has to run before the scene root does.
    if (ViroPlatform_1.isVisionOS)
        (0, ViroImmersiveSpaceGate_1.beginSceneRootScan)();
    const { initialScene, arInitialScene, vrInitialScene, 
    // Renderer config. Destructured because Quest forwards it over the intent
    // bridge rather than as props; the AR branch passes it on by hand below,
    // and leaving it out of that list is how the AR path silently lost every
    // one of these.
    hdrEnabled, pbrEnabled, bloomEnabled, shadowsEnabled, multisamplingEnabled, vrModeEnabled, passthroughEnabled, handTrackingEnabled, onExitViro, debug, visionOSImmersionStyle = "mixed", ...rest } = props;
    // Inner ref used on the AR path to capture the ViroARSceneNavigator instance.
    const arRef = React.useRef(null);
    // Same idea on visionOS, where the host is a ViroSceneNavigator instead.
    const visionRef = React.useRef(null);
    // Expose navigator interface on the ref.
    // Quest: proxy push/pop/etc. through VRQuestNavigatorBridge to VRActivity.
    // AR:    expose the underlying ViroARSceneNavigator instance directly.
    React.useImperativeHandle(ref, () => {
        if (ViroPlatform_1.isQuest) {
            // project/unproject/recenterTracking can't go through dispatchOp — that
            // queue is fire-and-forget (push/pop/etc. have no return value), while
            // these three need a result back. Instead they reuse the same viewTag
            // handoff VRQuestNavigatorBridge already publishes for VRModuleOpenXR:
            // both activities share one Fabric UIManager, so a tag captured in
            // VRActivity resolves fine from a native module call made here in the
            // panel. recenterTracking goes through VRModuleOpenXR (Quest-specific,
            // already used this way elsewhere); project/unproject reuse the generic
            // VRTSceneNavigatorModule, which already resolves views by raw tag.
            const requireViewTag = () => {
                const tag = VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.getViewTag();
                if (tag == null) {
                    throw new Error("[Viro] Quest VR scene not mounted yet — call this after the VR scene is active.");
                }
                return tag;
            };
            const bridgeNav = {
                push: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "push", scene }),
                replace: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "replace", scene }),
                jump: (scene) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "jump", scene }),
                pop: () => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "pop" }),
                popN: (n) => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.dispatchOp({ type: "popN", n }),
                recenterTracking: () => VRModuleOpenXR_1.VRModuleOpenXR?.recenterTracking?.(requireViewTag()),
                // async so a missing viewTag rejects the returned promise instead of
                // throwing synchronously — callers doing `nav.project(p).catch(...)`
                // without awaiting still get the rejection.
                project: async (point) => ViroSceneNavigatorModule?.project(requireViewTag(), point),
                unproject: async (point) => ViroSceneNavigatorModule?.unproject(requireViewTag(), point),
                // CL-H. These are the two names `metaSpatialAnchorFrameSource` looks for,
                // and their absence here is the whole of why co-location did not work on
                // Quest: the native side has driven Meta's group sharing since the OpenXR
                // session learned it, and nothing forwarded to it. They go through
                // VRModuleOpenXR rather than ARSceneNavigatorModule because that module
                // resolves its view as a VRTARSceneNavigator, which VRActivity does not host.
                rvCreateSharedFrame: async (groupId) => VRModuleOpenXR_1.VRModuleOpenXR?.rvCreateSharedFrame?.(requireViewTag(), groupId) ?? {
                    success: false,
                    error: "VRModuleOpenXR is unavailable — is this a Quest build?",
                },
                rvJoinSharedFrame: async (groupId) => VRModuleOpenXR_1.VRModuleOpenXR?.rvJoinSharedFrame?.(requireViewTag(), groupId) ?? {
                    success: false,
                    error: "VRModuleOpenXR is unavailable — is this a Quest build?",
                },
            };
            return { sceneNavigator: bridgeNav, arSceneNavigator: bridgeNav };
        }
        if (ViroPlatform_1.isVisionOS) {
            // Expose the instance under both names, as the Quest branch does. Callers written for
            // the AR path reach for `arSceneNavigator` (Studio does), and there is no reason for
            // them to learn a third spelling just because the host underneath changed.
            const nav = visionRef.current;
            return { sceneNavigator: nav, arSceneNavigator: nav };
        }
        return arRef.current;
    }, []);
    // Track AppState so we can detect background → active transitions.
    const appStateRef = React.useRef(react_native_1.AppState.currentState);
    // Identity of this navigator for ImmersiveSpace ownership. A symbol rather than a
    // counter: it cannot collide, and it means nothing outside this comparison.
    const visionOSOwnerRef = React.useRef(Symbol("ViroXRSceneNavigator"));
    // Timestamp at which AppState last left "active". Lets us distinguish a
    // genuine Quest-menu return (background lasts seconds) from racy
    // background→active bounces caused by the dual-Activity ReactHost
    // transitioning state (background lasts <500ms). Only the former should
    // re-launch VR; the latter would trigger a no-op startActivity that can
    // contribute to the lifecycle storm in some configurations.
    const leftActiveAtRef = React.useRef(0);
    // On visionOS: open the ImmersiveSpace on mount and close it on unmount.
    //
    // This mirrors what the Quest branch does with VRActivity — in both cases something other
    // than the React view hierarchy owns the display. The difference is that VRActivity runs its
    // own React host, so Quest forwards the scene across a bridge and renders null here, whereas
    // the visionOS ImmersiveSpace shares this runtime: the scene tree below stays mounted, and
    // the native side hands its VRTScene to the CompositorServices render loop.
    React.useEffect(() => {
        if (!ViroPlatform_1.isVisionOS)
            return;
        // An AR-rooted scene has nothing to put in the space — ViroARScene cannot mount on visionOS
        // and rendered null just above. Opening it anyway dims the room and shows an empty world.
        if ((0, ViroImmersiveSpaceGate_1.sawARSceneRoot)()) {
            console.warn("[Viro] The scene given to ViroXRSceneNavigator is rooted in ViroARScene, which " +
                "visionOS does not support, so the ImmersiveSpace was not opened. Root the scene " +
                "in ViroScene, or pass one through `vrInitialScene`.");
            return;
        }
        // Ownership, as on Quest. There VRActivity is the single display and `setVRActive` names
        // who has it; here the ImmersiveSpace is, and this is the same flag. The last navigator to
        // claim it is the one driving it, and only that one may close it again.
        const owner = visionOSOwnerRef.current;
        (0, ViroImmersiveSpaceGate_1.claimImmersiveSpace)(owner);
        let cancelled = false;
        const open = () => (0, ViroVisionOSModule_1.enterImmersiveSpace)(visionOSImmersionStyle).then((opened) => {
            if (!opened && !cancelled) {
                console.warn("[Viro] Could not open the visionOS ImmersiveSpace. Check that the host app's " +
                    "SwiftUI App declares `ImmersiveSpace(id: ViroImmersiveSpace.id)` and applies " +
                    "`.viroImmersiveSpaceController()` to the React Native root view.");
            }
        });
        open();
        // Quest re-launches VRActivity when the app comes back from the system menu, because the
        // Activity finishes on the way out. visionOS closes the ImmersiveSpace on the same
        // transition, so it is reopened for the same reason — and only by whoever owns it, or two
        // mounted navigators would both reopen and fight over the one surface.
        const appStateSub = react_native_1.AppState.addEventListener("change", (nextState) => {
            if (nextState === "active" && (0, ViroImmersiveSpaceGate_1.ownsImmersiveSpace)(owner)) {
                open();
            }
        });
        return () => {
            cancelled = true;
            appStateSub.remove();
            // Not on the way out of a screen that no longer owns the space: another navigator has
            // taken it over, and closing it would blank what the wearer is actually looking at.
            if ((0, ViroImmersiveSpaceGate_1.releaseImmersiveSpace)(owner)) {
                (0, ViroImmersiveSpaceGate_1.scheduleImmersiveSpaceExit)(() => {
                    (0, ViroVisionOSModule_1.exitImmersiveSpace)();
                });
            }
        };
    }, []);
    // On Quest: register the intent (scene + renderer config) then launch VRActivity.
    // Also re-launch when the app returns from background (e.g. Quest system menu),
    // because VRActivity auto-finishes when MainActivity resumes.
    React.useEffect(() => {
        if (!ViroPlatform_1.isQuest)
            return;
        checkRNVersionForVR();
        const registerIntentAndLaunch = () => {
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
        };
        // Request the runtime grants once before the first launch. Caught and
        // ignored on failure — a denied/unavailable permission should degrade
        // (no planes, no passthrough camera), not block VR from opening at all.
        react_native_1.PermissionsAndroid.requestMultiple(QUEST_RUNTIME_PERMISSIONS)
            .catch(() => undefined)
            .then(registerIntentAndLaunch);
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
    if (ViroPlatform_1.isVisionOS) {
        // The visionOS renderer has no AR subsystem — every VROAR* class is excluded from the
        // xros build, so a ViroARScene root has no view manager and fails at mount with
        // "View config not found for component `VRTARScene`". The scene root has to be a plain
        // ViroScene, which is what the Quest VR scene already is, so `vrInitialScene` is the
        // right source and `arInitialScene` is deliberately not consulted.
        const visionScene = vrInitialScene ?? initialScene;
        if (!visionScene) {
            console.warn("[Viro] ViroXRSceneNavigator on visionOS requires `vrInitialScene` or `initialScene`, " +
                "rooted in a ViroScene (not a ViroARScene).");
            return null;
        }
        // Zero-sized and hidden on purpose. This view is not a render surface on visionOS — the
        // ImmersiveSpace is — so anything it occupies in the window is space the app cannot use,
        // showing nothing. Left at its natural size it fills the window and the result reads as a
        // black panel floating in front of the immersive content, because an empty React Native
        // window is black. The scene tree still mounts, which is what matters: that is how the
        // native VRTScene reaches the renderer.
        const { style: _ignoredStyle, ...visionRest } = rest;
        return (<react_native_1.View style={styles.visionOSHost} pointerEvents="none">
          <ViroSceneNavigator_1.ViroSceneNavigator ref={visionRef} initialScene={visionScene} {...visionRest}/>
        </react_native_1.View>);
    }
    const scene = arInitialScene ?? initialScene;
    if (!scene) {
        console.warn("[Viro] ViroXRSceneNavigator requires `arInitialScene` or `initialScene`.");
        return null;
    }
    return (<ViroARSceneNavigator_1.ViroARSceneNavigator ref={arRef} initialScene={scene} hdrEnabled={hdrEnabled} pbrEnabled={pbrEnabled} bloomEnabled={bloomEnabled} shadowsEnabled={shadowsEnabled} multisamplingEnabled={multisamplingEnabled} {...rest}/>);
});
const styles = react_native_1.StyleSheet.create({
    /** See the visionOS branch above: present in the tree, absent from the layout. */
    visionOSHost: {
        position: "absolute",
        width: 0,
        height: 0,
        opacity: 0,
    },
});
