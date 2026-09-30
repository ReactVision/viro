"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsupportedCapture = exports.VRCapture = exports.VRModuleOpenXR = void 0;
exports.exitVRScene = exitVRScene;
exports.setPassthroughStyle = setPassthroughStyle;
exports.useVRViewTag = useVRViewTag;
const react_1 = require("react");
const react_native_1 = require("react-native");
const VRQuestNavigatorBridge_1 = require("./VRQuestNavigatorBridge");
const ViroConstants_1 = require("../ViroConstants");
/**
 * Finishes VRActivity and returns the user to the panel (MainActivity).
 * Safe to call on any platform — no-op when VRLauncher is unavailable.
 */
function exitVRScene() {
    VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.setVRActive(false);
    react_native_1.NativeModules.VRLauncher
        ?.exitVRScene?.();
}
/**
 * Style the Quest passthrough layer (XR_FB_passthrough). No-op off-Quest.
 *
 * ```tsx
 * const viewTag = useVRViewTag();
 * if (viewTag != null) {
 *   setPassthroughStyle(viewTag, { opacity: 0.8, edgeColor: [0, 1, 1, 1] });
 * }
 * ```
 */
function setPassthroughStyle(viewTag, style) {
    const opacity = style.opacity ?? 1;
    const [r, g, b, a] = style.edgeColor ?? [0, 0, 0, 0];
    exports.VRModuleOpenXR?.setPassthroughStyle?.(viewTag, opacity, r, g, b, a);
}
/**
 * Typed reference to the VRModuleOpenXR native module.
 * undefined when not running on Meta Quest (no-op calls are safe via optional chaining).
 */
exports.VRModuleOpenXR = react_native_1.NativeModules.VRModuleOpenXR ?? undefined;
/**
 * Returns the live viewTag of the ViroVRSceneNavigator running in VRActivity,
 * kept in sync via VRQuestNavigatorBridge.  null until ViroQuestEntryPoint has
 * mounted and published the tag.
 *
 * Use this inside VR scenes when you need to call VRModuleOpenXR methods:
 *
 * ```tsx
 * function MyVRScene() {
 *   const viewTag = useVRViewTag();
 *   const recenter = () => {
 *     if (viewTag != null) VRModuleOpenXR?.recenterTracking?.(viewTag);
 *   };
 *   return <ViroScene>...</ViroScene>;
 * }
 * ```
 */
function useVRViewTag() {
    const [tag, setTag] = (0, react_1.useState)(() => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.getViewTag());
    (0, react_1.useEffect)(() => VRQuestNavigatorBridge_1.VRQuestNavigatorBridge.onViewTag(setTag), []);
    return tag;
}
function captureFailure(errorCode) {
    return { success: false, url: null, errorCode };
}
/**
 * Screen capture on the Quest navigator, by view tag, with the same arguments
 * and results as ViroARSceneNavigator's. What the VR scene navigator and the
 * Quest branch of ViroXRSceneNavigator hand scenes as
 * `sceneNavigator.takeScreenshot` / `startVideoRecording` / `stopVideoRecording`.
 *
 * Off Quest (iOS, visionOS, Cardboard on Android) there is no VRModuleOpenXR
 * and every call reports `RECORD_ERROR_UNSUPPORTED_PLATFORM`. A null tag —
 * the VR scene has not mounted — reports `RECORD_ERROR_NOT_READY`, as native
 * does while the XR session has no swapchains.
 *
 * The capture is the left eye, sized to its swapchain. Passthrough is
 * composited by the OS beneath the app's layer, so a mixed-reality capture
 * holds the virtual content only, over black.
 */
exports.VRCapture = {
    takeScreenshot(viewTag, fileName, saveToCameraRoll) {
        const fn = exports.VRModuleOpenXR?.takeScreenshot;
        if (typeof fn !== "function") {
            return Promise.resolve(captureFailure(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM));
        }
        if (viewTag == null) {
            return Promise.resolve(captureFailure(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY));
        }
        return fn(viewTag, fileName, saveToCameraRoll);
    },
    startVideoRecording(viewTag, fileName, saveToCameraRoll, onError) {
        const fn = exports.VRModuleOpenXR?.startVideoRecording;
        if (typeof fn !== "function") {
            onError?.(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
            return;
        }
        if (viewTag == null) {
            onError?.(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY);
            return;
        }
        // Native invokes the callback on failure only; a caller without one still
        // records, it just cannot hear why a recording failed.
        fn(viewTag, fileName, saveToCameraRoll, onError ?? (() => { }));
    },
    stopVideoRecording(viewTag) {
        const fn = exports.VRModuleOpenXR?.stopVideoRecording;
        if (typeof fn !== "function") {
            return Promise.resolve(captureFailure(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM));
        }
        if (viewTag == null) {
            return Promise.resolve(captureFailure(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY));
        }
        return fn(viewTag);
    },
};
/**
 * The same three calls for a navigator that can never capture — the generic
 * ViroSceneNavigator, which visionOS and iOS VR host. They report
 * `RECORD_ERROR_UNSUPPORTED_PLATFORM` rather than leaving a scene written for
 * AR or Quest to call something undefined.
 */
exports.unsupportedCapture = {
    takeScreenshot: (_fileName, _saveToCameraRoll) => Promise.resolve(captureFailure(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)),
    startVideoRecording: (_fileName, _saveToCameraRoll, onError) => {
        onError?.(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM);
    },
    stopVideoRecording: () => Promise.resolve(captureFailure(ViroConstants_1.ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM)),
};
