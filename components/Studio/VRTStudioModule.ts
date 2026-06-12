import { NativeModules } from "react-native";

export interface StudioModuleResult {
  success: boolean;
  data?: string;
  error?: string;
}

interface StudioNativeModule {
  rvGetScene(sceneId: string): Promise<StudioModuleResult>;
  rvGetProject(): Promise<StudioModuleResult>;
  rvGetProjectId(): Promise<string | null>;
  rvStudioApiRequest(bodyJson: string): Promise<StudioModuleResult>;
}

const native = NativeModules.VRTStudio as StudioNativeModule | undefined;

const NOT_AVAILABLE: StudioModuleResult = {
  success: false,
  error: "VRTStudio native module not available",
};

export const VRTStudioModule = {
  rvGetScene: (sceneId: string): Promise<StudioModuleResult> => {
    if (!native) return Promise.resolve(NOT_AVAILABLE);
    return native.rvGetScene(sceneId);
  },
  /**
   * Fetches the project configured in the app manifest (Android: `com.reactvision.RVProjectId`,
   * iOS: `RVProjectId`). The project ID is baked in by the Expo plugin at build time.
   */
  rvGetProject: (): Promise<StudioModuleResult> => {
    if (!native) return Promise.resolve(NOT_AVAILABLE);
    return native.rvGetProject();
  },
  /** Returns the configured project ID, or null if not set. */
  rvGetProjectId: (): Promise<string | null> => {
    if (!native) return Promise.resolve(null);
    return native.rvGetProjectId();
  },
  /**
   * POSTs a pre-serialised scene-api-request body ({function_id, variables})
   * to the egress proxy, authenticated with the app's RVApiKey. The resolved
   * `data` is the proxy's outcome envelope JSON.
   */
  rvStudioApiRequest: (bodyJson: string): Promise<StudioModuleResult> => {
    if (!native) return Promise.resolve(NOT_AVAILABLE);
    return native.rvStudioApiRequest(bodyJson);
  },
};
