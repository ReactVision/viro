export interface StudioModuleResult {
    success: boolean;
    data?: string;
    error?: string;
}
export declare const VRTStudioModule: {
    rvGetScene: (sceneId: string) => Promise<StudioModuleResult>;
    /**
     * Fetches the project configured in the app manifest (Android: `com.reactvision.RVProjectId`,
     * iOS: `RVProjectId`). The project ID is baked in by the Expo plugin at build time.
     */
    rvGetProject: () => Promise<StudioModuleResult>;
    /** Returns the configured project ID, or null if not set. */
    rvGetProjectId: () => Promise<string | null>;
    /**
     * POSTs a pre-serialised scene-api-request body ({function_id, variables})
     * to the egress proxy, authenticated with the app's RVApiKey. The resolved
     * `data` is the proxy's outcome envelope JSON.
     */
    rvStudioApiRequest: (bodyJson: string) => Promise<StudioModuleResult>;
};
