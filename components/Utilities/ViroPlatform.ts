import { NativeModules, Platform } from "react-native";

/**
 * True when running on the web platform (react-native-web). Web uses the
 * WASM/WebGL2 renderer via @reactvision/viro-web-renderer and the .web.tsx
 * bridge instead of the native view managers.
 */
export const isWeb: boolean = Platform.OS === "web";

type AndroidBuildInfo = {
  Manufacturer?: string;
  Brand?: string;
  Model?: string;
};

/**
 * True only on actual Meta Quest hardware (Quest 1/2/Pro/3/3S).
 *
 * Detection is based on `Platform.constants` (Android `Build.MANUFACTURER`,
 * `BRAND`, `MODEL`) — NOT on the presence of `NativeModules.VRModuleOpenXR`.
 * The OpenXR module ships with any app built against the Quest variant of
 * react-viro and is therefore present on regular Android phones too when the
 * same APK targets both phone and Quest. Branding strings are the
 * authoritative signal for "is the user wearing a Quest right now".
 *
 * Quest 1/2/Pro:  Manufacturer="Oculus", Brand="oculus"
 * Quest 3/3S:     Manufacturer="Meta",   Brand="meta"
 */
function detectQuest(): boolean {
  if (Platform.OS !== "android") return false;
  const c = (Platform.constants ?? {}) as AndroidBuildInfo;
  const manufacturer = (c.Manufacturer ?? "").toLowerCase();
  const brand = (c.Brand ?? "").toLowerCase();
  const model = (c.Model ?? "").toLowerCase();

  if (
    manufacturer === "oculus" ||
    manufacturer === "meta" ||
    brand === "oculus" ||
    brand === "meta"
  ) {
    return true;
  }
  // Defensive: future hardware shipping under new manufacturer strings.
  return /\bquest\b/.test(model);
}

export const isQuest: boolean = detectQuest();

/**
 * True when this app build includes the OpenXR VR native module (i.e. the
 * Quest variant of react-viro is registered in `MainApplication`). Does NOT
 * imply the current device is a Quest — for that, use `isQuest`.
 *
 * Useful when you need to decide whether `ViroVRSceneNavigator` *could* render
 * if you forced VR mode (e.g., for in-app build diagnostics).
 */
export const hasOpenXRSupport: boolean =
  NativeModules.VRModuleOpenXR !== undefined;

/**
 * True on Apple Vision Pro (visionOS).
 *
 * Sits here next to `isQuest` and `isWeb` so platform branching reads the same way everywhere.
 * `Platform.OS` is `"ios"` on visionOS — react-native-visionos is an out-of-tree platform that
 * keeps the iOS identity — so it cannot be used to tell the two apart. React Native 0.83+ sets
 * `Platform.isVision`; the native module constant covers builds where it is absent.
 *
 * `ViroVisionOSModule.isVisionOS()` computes the same thing and remains the public API; this is
 * the constant form, evaluated once at import, matching `isQuest`.
 */
function detectVisionOS(): boolean {
  if ((Platform as any).isVision === true) return true;
  return NativeModules.VRTVisionOSModule?.isVisionOS === true;
}

export const isVisionOS: boolean = detectVisionOS();
