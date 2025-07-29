"use strict";
/**
 * Viro React Native - New Architecture Required
 *
 * This library requires React Native's New Architecture (Fabric) to be enabled.
 * Legacy architecture support has been removed as of version 2.43.1.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Strict New Architecture validation
function validateNewArchitecture() {
    // Check for New Architecture indicators
    const hasFabricUIManager = !!global.nativeFabricUIManager;
    const hasTurboModules = !!global.__turboModuleProxy;
    if (!hasFabricUIManager && !hasTurboModules) {
        throw new Error("ViroReact: New Architecture (Fabric) is required but not detected.\n\n" +
            "This library requires React Native 0.76.9+ with New Architecture enabled.\n" +
            "Please enable New Architecture in your app:\n\n" +
            "1. Set 'newArchEnabled=true' in android/gradle.properties\n" +
            "2. Set 'RCT_NEW_ARCH_ENABLED=1' in ios/.xcode.env\n" +
            "3. Ensure you're using React Native 0.76.9 or higher\n\n" +
            "For more information, visit: https://reactnative.dev/docs/new-architecture-intro");
    }
    console.log("ViroReact: New Architecture (Fabric) detected ✓");
}
// Validate New Architecture on module load
validateNewArchitecture();
// Export main components
module.exports = require("./index");
