"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULTS = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const withViroAndroid_1 = require("./withViroAndroid");
const withViroIos_1 = require("./withViroIos");
const CAMERA_USAGE = "Allow $(PRODUCT_NAME) to use your camera";
const MICROPHONE_USAGE = "Allow $(PRODUCT_NAME) to use your microphone";
const READ_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to access your photos";
const WRITE_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to save photos";
/**
 * Default options
 */
exports.DEFAULTS = {
    ios: {
        cameraUsagePermission: CAMERA_USAGE,
        microphoneUsagePermission: MICROPHONE_USAGE,
        photosPermission: READ_PHOTOS_USAGE,
        savePhotosPermission: WRITE_PHOTOS_USAGE,
    },
    android: {
        xRMode: ["GVR", "AR"],
    },
};
/**
 * Configures Viro to work with Expo projects.
 *
 * IMPORTANT: This plugin requires React Native New Architecture (Fabric) to be enabled.
 * ViroReact 2.43.1+ only supports New Architecture.
 *
 * @param config Expo ConfigPlugin
 * @returns expo configuration
 */
const withViro = (config, props) => {
    // Validate New Architecture is enabled
    const newArchEnabled = config.plugins?.some((plugin) => Array.isArray(plugin) &&
        plugin[0] === "expo-dev-client" &&
        plugin[1]?.newArchEnabled === true) || config.newArchEnabled === true;
    if (!newArchEnabled) {
        config_plugins_1.WarningAggregator.addWarningAndroid("withViro", "ViroReact requires React Native New Architecture (Fabric) to be enabled. " +
            "Please enable New Architecture in your app configuration. " +
            'Add "newArchEnabled": true to your app.json/app.config.js expo configuration, ' +
            "or ensure your React Native project has New Architecture enabled.");
        config_plugins_1.WarningAggregator.addWarningIOS("withViro", "ViroReact requires React Native New Architecture (Fabric) to be enabled. " +
            "Please enable New Architecture in your app configuration. " +
            'Add "newArchEnabled": true to your app.json/app.config.js expo configuration, ' +
            "or ensure your React Native project has New Architecture enabled.");
    }
    // Apply platform-specific configurations
    config = (0, withViroIos_1.withViroIos)(config, props);
    config = (0, withViroAndroid_1.withViroAndroid)(config, props);
    return config;
};
exports.default = withViro;
