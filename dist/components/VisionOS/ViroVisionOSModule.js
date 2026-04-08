"use strict";
/**
 * ViroVisionOSModule
 *
 * JavaScript API for controlling the visionOS ImmersiveSpace.
 * On iOS / Android the calls are no-ops (module returns false / resolves silently).
 *
 * ── Host-app setup required ──────────────────────────────────────────────────
 *
 * 1. Add the ImmersiveSpace to your SwiftUI App struct (visionOS only):
 *
 *    #if os(visionOS)
 *    import ViroReact
 *    #endif
 *
 *    @main struct MyApp: App {
 *      var body: some Scene {
 *        WindowGroup {
 *          ContentView()
 *            #if os(visionOS)
 *            .viroImmersiveSpaceController()
 *            #endif
 *        }
 *        #if os(visionOS)
 *        ImmersiveSpace(id: "ViroImmersive") {
 *          ViroImmersiveSpaceView()
 *        }
 *        .immersionStyle(selection: .constant(.mixed), in: .mixed, .full, .progressive)
 *        #endif
 *      }
 *    }
 *
 * 2. Call from JavaScript:
 *
 *    import { ViroVisionOSModule } from '@reactvision/react-viro';
 *
 *    await ViroVisionOSModule.enterImmersiveSpace('mixed');
 *    // ... render Viro scene inside ImmersiveSpace ...
 *    await ViroVisionOSModule.exitImmersiveSpace();
 * ─────────────────────────────────────────────────────────────────────────────
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVisionOSModule = void 0;
exports.isVisionOS = isVisionOS;
exports.enterImmersiveSpace = enterImmersiveSpace;
exports.exitImmersiveSpace = exitImmersiveSpace;
const react_native_1 = require("react-native");
/** @internal — raw NativeModule reference */
const { VRTVisionOSModule } = react_native_1.NativeModules;
/**
 * Returns true if the app is running on Apple Vision Pro (visionOS).
 * Uses the native module constant; falls back to Platform.isVision when
 * available (React Native 0.83+).
 */
function isVisionOS() {
    // React Native 0.83+ exposes Platform.isVision on visionOS builds.
    if (react_native_1.Platform.isVision === true)
        return true;
    // Fallback: check the native module constant.
    return VRTVisionOSModule?.isVisionOS === true;
}
/**
 * Opens the Viro ImmersiveSpace on visionOS.
 *
 * @param style  "mixed" (default) — virtual content blended over passthrough
 *               "full"  — fully virtual, passthrough hidden
 *               "progressive" — graduated immersion with crown dial
 */
async function enterImmersiveSpace(style = "mixed") {
    if (!VRTVisionOSModule) {
        if (__DEV__) {
            console.warn("[Viro] VRTVisionOSModule not available on this platform");
        }
        return false;
    }
    return VRTVisionOSModule.enterImmersiveSpace(style);
}
/**
 * Dismisses the Viro ImmersiveSpace and returns to the window layer.
 */
async function exitImmersiveSpace() {
    if (!VRTVisionOSModule)
        return false;
    return VRTVisionOSModule.exitImmersiveSpace();
}
/** Convenience object matching the typical NativeModules pattern. */
exports.ViroVisionOSModule = {
    isVisionOS,
    enterImmersiveSpace,
    exitImmersiveSpace,
};
