import { ConfigPlugin } from "@expo/config-plugins";
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
 * @param config Expo ConfigPlugin
 * @returns expo configuration
 */
const withViro: ConfigPlugin<ViroConfigurationOptions> = (config, props) => {
  config = withViroIos(config, props);
  config = withViroAndroid(config, props);

  return config;
};

export default withViro;
