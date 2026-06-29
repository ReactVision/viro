"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULTS = void 0;
const withViroAndroid_1 = require("./withViroAndroid");
const withViroIos_1 = require("./withViroIos");
const CAMERA_USAGE = "Allow $(PRODUCT_NAME) to use your camera";
const MICROPHONE_USAGE = "Allow $(PRODUCT_NAME) to use your microphone";
const READ_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to access your photos";
const WRITE_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to save photos";
const LOCATION_USAGE = "Allow $(PRODUCT_NAME) to use your location for AR experiences";
/**
 * Default options
 */
exports.DEFAULTS = {
    ios: {
        cameraUsagePermission: CAMERA_USAGE,
        microphoneUsagePermission: MICROPHONE_USAGE,
        photosPermission: READ_PHOTOS_USAGE,
        savePhotosPermission: WRITE_PHOTOS_USAGE,
        locationUsagePermission: LOCATION_USAGE,
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
    // New Architecture is the only architecture in Expo SDK 53+ (and the React
    // Native versions ViroReact supports), so there is nothing to validate here.
    // Apply platform-specific configurations
    config = (0, withViroIos_1.withViroIos)(config, props);
    config = (0, withViroAndroid_1.withViroAndroid)(config, props);
    return config;
};
exports.default = withViro;
