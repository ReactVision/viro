export interface StudioModuleResult {
    success: boolean;
    data?: string;
    error?: string;
}
/**
 * @internal — session auth for first-party apps (e.g. StudioGo). Deliberately
 * not exported from the package root; the server's org-membership check is the
 * real boundary.
 */
export interface StudioSessionConfig {
    baseUrl: string;
    accessToken: string;
    clientTag?: string;
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
    /**
     * @internal — sets/clears an internal session so the fetch methods use
     * `${baseUrl}/functions/v1/...` with `Authorization: Bearer` (and no
     * `x-api-key`) instead of the manifest RVApiKey. Pass null to revert to
     * API-key mode. Session auth wins over any manifest key.
     */
    rvSetStudioSession: (config: StudioSessionConfig | null) => Promise<void>;
};
