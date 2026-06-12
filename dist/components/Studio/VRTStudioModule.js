"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VRTStudioModule = void 0;
const react_native_1 = require("react-native");
const native = react_native_1.NativeModules.VRTStudio;
const NOT_AVAILABLE = {
    success: false,
    error: "VRTStudio native module not available",
};
exports.VRTStudioModule = {
    rvGetScene: (sceneId) => {
        if (!native)
            return Promise.resolve(NOT_AVAILABLE);
        return native.rvGetScene(sceneId);
    },
    /**
     * Fetches the project configured in the app manifest (Android: `com.reactvision.RVProjectId`,
     * iOS: `RVProjectId`). The project ID is baked in by the Expo plugin at build time.
     */
    rvGetProject: () => {
        if (!native)
            return Promise.resolve(NOT_AVAILABLE);
        return native.rvGetProject();
    },
    /** Returns the configured project ID, or null if not set. */
    rvGetProjectId: () => {
        if (!native)
            return Promise.resolve(null);
        return native.rvGetProjectId();
    },
    /**
     * POSTs a pre-serialised scene-api-request body ({function_id, variables})
     * to the egress proxy, authenticated with the app's RVApiKey. The resolved
     * `data` is the proxy's outcome envelope JSON.
     */
    rvStudioApiRequest: (bodyJson) => {
        if (!native)
            return Promise.resolve(NOT_AVAILABLE);
        return native.rvStudioApiRequest(bodyJson);
    },
};
