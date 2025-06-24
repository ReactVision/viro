import { ConfigPlugin, WarningAggregator } from "@expo/config-plugins";
import { withViroAndroid } from "./withViroAndroid";
import { withViroIos } from "./withViroIos";

const CAMERA_USAGE = "Allow $(PRODUCT_NAME) to use your camera";
const MICROPHONE_USAGE = "Allow $(PRODUCT_NAME) to use your microphone";
const READ_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to access your photos";
const WRITE_PHOTOS_USAGE = "Allow $(PRODUCT_NAME) to save photos";

export type XrMode = "GVR" | "AR" | "OVR_MOBILE";

/**
 * Options interface for configuring expo plugin
 */
export interface ViroConfigurationOptions {
  ios?: {
    /**
     * String for app to use for camera usage.
     *
     * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to use your camera'
     */
    cameraUsagePermission?: string;
    /**
     * String for app to use for microphone usage.
     *
     * DEFAULTS TO: "Allow $(PRODUCT_NAME) to use your microphone"
     */
    microphoneUsagePermission?: string;
    /**
     * String for app to read photos.
     *
     * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to access your photos'
     */
    photosPermission?: string;
    /**
     * String for app to save photos
     *
     * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to save photos'
     */
    savePhotosPermission?: string;
  };
  android?: {
    xRMode?: XrMode[];
  };
}

/**
 * Default options
 */
export const DEFAULTS = {
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
const withViro: ConfigPlugin<ViroConfigurationOptions> = (config, props) => {
  // Validate New Architecture is enabled
  const newArchEnabled =
    config.plugins?.some(
      (plugin) =>
        Array.isArray(plugin) &&
        plugin[0] === "expo-dev-client" &&
        plugin[1]?.newArchEnabled === true
    ) || (config as any).newArchEnabled === true;

  if (!newArchEnabled) {
    WarningAggregator.addWarningAndroid(
      "withViro",
      "ViroReact requires React Native New Architecture (Fabric) to be enabled. " +
        "Please enable New Architecture in your app configuration. " +
        'Add "newArchEnabled": true to your app.json/app.config.js expo configuration, ' +
        "or ensure your React Native project has New Architecture enabled."
    );

    WarningAggregator.addWarningIOS(
      "withViro",
      "ViroReact requires React Native New Architecture (Fabric) to be enabled. " +
        "Please enable New Architecture in your app configuration. " +
        'Add "newArchEnabled": true to your app.json/app.config.js expo configuration, ' +
        "or ensure your React Native project has New Architecture enabled."
    );
  }

  // Apply platform-specific configurations
  config = withViroIos(config, props);
  config = withViroAndroid(config, props);

  return config;
};

export default withViro;
