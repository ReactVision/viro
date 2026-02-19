import { ConfigPlugin } from "@expo/config-plugins";
export type XrMode = "GVR" | "AR" | "OVR_MOBILE";
/**
 * Cloud Anchors provider type.
 * - "none": Cloud Anchors disabled
 * - "arcore": Use ARCore Cloud Anchors (works on both iOS and Android)
 * - "reactvision": Use ReactVision Cloud Anchors backend (requires libreactvisioncca)
 */
export type CloudAnchorProvider = "none" | "arcore" | "reactvision";
/**
 * Geospatial Anchor provider type.
 * - "none": Geospatial API disabled
 * - "arcore": Use ARCore Geospatial API (works on both iOS and Android)
 * - "reactvision": Use ReactVision GPS-based anchor backend (requires libreactvisioncca)
 */
export type GeospatialAnchorProvider = "none" | "arcore" | "reactvision";
/**
 * iOS framework linkage type.
 * - "dynamic": Use dynamic frameworks (required for ARCore SDK)
 * - "static": Use static frameworks (smaller binary size, faster launch)
 */
export type IosLinkage = "dynamic" | "static";
/**
 * Options interface for configuring expo plugin
 */
export interface ViroConfigurationOptions {
    /**
     * iOS framework linkage type.
     * When set to "dynamic", uses dynamic frameworks which is required for ARCore SDK.
     * When set to "static", uses static frameworks for smaller binary size.
     *
     * Note: If using cloudAnchorProvider or geospatialAnchorProvider with "arcore",
     * this will be automatically set to "dynamic" regardless of the configured value.
     *
     * DEFAULTS TO: undefined (uses project default, typically static)
     */
    iosLinkage?: IosLinkage;
    /**
     * Google Cloud API key for ARCore Cloud Anchors and Geospatial API.
     * Required if using cloudAnchorProvider: "arcore" or geospatialAnchorProvider: "arcore"
     *
     * Get your API key from Google Cloud Console:
     * https://console.cloud.google.com/apis/credentials
     *
     * Make sure to enable the ARCore API for your project.
     */
    googleCloudApiKey?: string;
    /**
     * ReactVision API key for ReactVision Cloud Anchors and Geospatial API.
     * Required if using cloudAnchorProvider: "reactvision" or geospatialAnchorProvider: "reactvision".
     *
     * Written to AndroidManifest as com.reactvision.RVApiKey and to Info.plist as RVApiKey.
     */
    rvApiKey?: string;
    /**
     * ReactVision Project ID for ReactVision Cloud Anchors and Geospatial API.
     * Required if using cloudAnchorProvider: "reactvision" or geospatialAnchorProvider: "reactvision".
     *
     * Written to AndroidManifest as com.reactvision.RVProjectId and to Info.plist as RVProjectId.
     */
    rvProjectId?: string;
    /**
     * Cloud Anchors provider for cross-platform anchor sharing.
     * When set to "arcore", enables ARCore Cloud Anchors on both iOS and Android.
     *
     * DEFAULTS TO: "none"
     */
    cloudAnchorProvider?: CloudAnchorProvider;
    /**
     * Geospatial Anchor provider for location-based AR.
     * When set to "arcore", enables ARCore Geospatial API on both iOS and Android.
     * Requires googleCloudApiKey to be set.
     *
     * DEFAULTS TO: "none"
     */
    geospatialAnchorProvider?: GeospatialAnchorProvider;
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
        /**
         * String for app to use location (required for Geospatial API)
         *
         * DEFAULTS TO: 'Allow $(PRODUCT_NAME) to use your location for AR experiences'
         */
        locationUsagePermission?: string;
        /**
         * Whether to include ARCore SDK pods.
         * When true, adds ARCore/CloudAnchors, ARCore/Geospatial, and ARCore/Semantics pods.
         * This is automatically set to true when using cloudAnchorProvider or geospatialAnchorProvider with "arcore".
         *
         * ViroKit is built with weak linking, so ARCore pods are optional.
         * Without ARCore pods, cloud anchors, geospatial, and semantics features will be disabled at runtime.
         *
         * DEFAULTS TO: false (unless cloudAnchorProvider or geospatialAnchorProvider is "arcore")
         */
        includeARCore?: boolean;
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
        locationUsagePermission: string;
    };
    android: {
        xRMode: string[];
    };
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
declare const withViro: ConfigPlugin<ViroConfigurationOptions>;
export default withViro;
