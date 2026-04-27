"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasOpenXRSupport = exports.isQuest = void 0;
const react_native_1 = require("react-native");
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
function detectQuest() {
    if (react_native_1.Platform.OS !== "android")
        return false;
    const c = (react_native_1.Platform.constants ?? {});
    const manufacturer = (c.Manufacturer ?? "").toLowerCase();
    const brand = (c.Brand ?? "").toLowerCase();
    const model = (c.Model ?? "").toLowerCase();
    if (manufacturer === "oculus" ||
        manufacturer === "meta" ||
        brand === "oculus" ||
        brand === "meta") {
        return true;
    }
    // Defensive: future hardware shipping under new manufacturer strings.
    return /\bquest\b/.test(model);
}
exports.isQuest = detectQuest();
/**
 * True when this app build includes the OpenXR VR native module (i.e. the
 * Quest variant of react-viro is registered in `MainApplication`). Does NOT
 * imply the current device is a Quest — for that, use `isQuest`.
 *
 * Useful when you need to decide whether `ViroVRSceneNavigator` *could* render
 * if you forced VR mode (e.g., for in-app build diagnostics).
 */
exports.hasOpenXRSupport = react_native_1.NativeModules.VRModuleOpenXR !== undefined;
