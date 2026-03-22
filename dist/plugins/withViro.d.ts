import { ConfigPlugin } from "@expo/config-plugins";
export type XrMode = "GVR" | "AR" | "OVR_MOBILE";
/**
 * Anchor provider type.
 * - "none": Disabled
 * - "arcore": Use ARCore Cloud Anchors / Geospatial API
 * - "reactvision": Use ReactVision backend (requires libreactvisioncca)
 */
export type Provider = "none" | "arcore" | "reactvision";
/** @deprecated Use Provider */
export type CloudAnchorProvider = Provider;
/** @deprecated Use Provider */
export type GeospatialAnchorProvider = Provider;
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
     * Note: If using provider: "arcore", this will be automatically set to "dynamic".
     *
     * DEFAULTS TO: undefined (uses project default, typically static)
     */
    iosLinkage?: IosLinkage;
    /**
     * Google Cloud API key for ARCore Cloud Anchors and Geospatial API.
     * Required if using provider: "arcore".
     *
     * Get your API key from Google Cloud Console:
     * https://console.cloud.google.com/apis/credentials
     *
     * Make sure to enable the ARCore API for your project.
     */
    googleCloudApiKey?: string;
    /**
     * ReactVision API key for ReactVision Cloud Anchors and Geospatial API.
     * Required if using provider: "reactvision" (the default).
     *
     * Written to AndroidManifest as com.reactvision.RVApiKey and to Info.plist as RVApiKey.
     */
    rvApiKey?: string;
    /**
     * ReactVision Project ID for ReactVision Cloud Anchors and Geospatial API.
     * Required if using provider: "reactvision" (the default).
     *
     * Written to AndroidManifest as com.reactvision.RVProjectId and to Info.plist as RVProjectId.
     */
    rvProjectId?: string;
    /**
     * Anchor provider for both cloud anchors and geospatial anchors.
     * Replaces the deprecated cloudAnchorProvider + geospatialAnchorProvider props.
     *
     * - "reactvision": Use ReactVision backend (requires rvApiKey + rvProjectId)
     * - "arcore": Use ARCore Cloud Anchors / Geospatial API (requires googleCloudApiKey)
     * - "none": Disable both
     *
     * DEFAULTS TO: "reactvision"
     */
    provider?: Provider;
    /**
     * @deprecated Use provider instead.
     * Cloud Anchors provider. Overrides provider for cloud anchors only if set.
     */
    cloudAnchorProvider?: CloudAnchorProvider;
    /**
     * @deprecated Use provider instead.
     * Geospatial Anchor provider. Overrides provider for geospatial only if set.
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
         * This is automatically set to true when using provider: "arcore".
         *
         * ViroKit is built with weak linking, so ARCore pods are optional.
         * Without ARCore pods, cloud anchors, geospatial, and semantics features will be disabled at runtime.
         *
         * DEFAULTS TO: false (unless provider is "arcore")
         */
        includeARCore?: boolean;
        /**
         * Whether to include the ARCore/Semantics pod for scene semantic segmentation.
         * When true, adds the ARCore/Semantics pod (and ARCore/CloudAnchors as a base dependency)
         * without enabling cloud anchors or geospatial features.
         *
         * Use this when you want semantic masking (ViroMaterial.semanticMask) but do NOT need
         * cloud anchors or geospatial anchors. If includeARCore is already true, this has no effect.
         *
         * DEFAULTS TO: false
         */
        includeSemantics?: boolean;
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
