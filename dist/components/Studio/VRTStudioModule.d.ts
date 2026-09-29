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
/** @internal */
export type StudioAuthMode = "session" | "api_key" | "none";
/**
 * @internal The credentials native would send, for the JS clients that call
 * the platform or the relay themselves. `baseUrl` is what `/functions/v1/`
 * paths are built on, null in mode "none"; `projectId` is the manifest
 * RVProjectId in every mode.
 */
export interface StudioAuthContext {
    mode: StudioAuthMode;
    baseUrl: string | null;
    headers: Record<string, string>;
    projectId: string | null;
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
    /**
     * @internal Re-read per request rather than cached: a session token is
     * replaced when it refreshes. Same method-level guard as rvSetStudioSession.
     */
    rvGetAuthHeaders: () => Promise<StudioAuthContext>;
    /**
     * @internal Points the ReactVision cloud anchor provider at a project other
     * than the manifest's; null clears the override. Call before hosting or
     * resolving. Same method-level guard as rvSetStudioSession.
     */
    rvSetCloudAnchorProject: (projectId: string | null) => Promise<void>;
};
