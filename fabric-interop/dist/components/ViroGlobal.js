"use strict";
/**
 * ViroGlobal
 *
 * A utility to provide type-safe access to the global NativeViro object.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNativeViro = getNativeViro;
exports.isNativeViroAvailable = isNativeViroAvailable;
// Get the NativeViro object with type safety
function getNativeViro() {
    if (typeof global !== "undefined" && global.NativeViro) {
        return global.NativeViro;
    }
    return null;
}
// Check if NativeViro is available
function isNativeViroAvailable() {
    return getNativeViro() !== null;
}
//# sourceMappingURL=ViroGlobal.js.map