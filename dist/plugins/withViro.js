"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULTS = void 0;
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
 * @param config Expo ConfigPlugin
 * @returns expo configuration
 */
const withViro = (config, props) => {
    config = (0, withViroIos_1.withViroIos)(config, props);
    config = (0, withViroAndroid_1.withViroAndroid)(config, props);
    return config;
};
exports.default = withViro;
