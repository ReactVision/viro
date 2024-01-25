import { ConfigPlugin } from "@expo/config-plugins";
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
export declare const DEFAULTS: {
    ios: {
        cameraUsagePermission: string;
        microphoneUsagePermission: string;
        photosPermission: string;
        savePhotosPermission: string;
    };
    android: {
        xRMode: string[];
    };
};
/**
 * Configures Viro to work with Expo projects.
 *
 * @param config Expo ConfigPlugin
 * @returns expo configuration
 */
declare const withViro: ConfigPlugin<ViroConfigurationOptions>;
export default withViro;
