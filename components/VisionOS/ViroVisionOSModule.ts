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

import { NativeModules, Platform } from "react-native";

export type ImmersiveSpaceStyle = "mixed" | "full" | "progressive";

/** @internal — raw NativeModule reference */
const { VRTVisionOSModule } = NativeModules;

/**
 * Returns true if the app is running on Apple Vision Pro (visionOS).
 * Uses the native module constant; falls back to Platform.isVision when
 * available (React Native 0.83+).
 */
export function isVisionOS(): boolean {
  // React Native 0.83+ exposes Platform.isVision on visionOS builds.
  if ((Platform as any).isVision === true) return true;
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
export async function enterImmersiveSpace(
  style: ImmersiveSpaceStyle = "mixed"
): Promise<boolean> {
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
export async function exitImmersiveSpace(): Promise<boolean> {
  if (!VRTVisionOSModule) return false;
  return VRTVisionOSModule.exitImmersiveSpace();
}

/** Convenience object matching the typical NativeModules pattern. */
export const ViroVisionOSModule = {
  isVisionOS,
  enterImmersiveSpace,
  exitImmersiveSpace,
} as const;
