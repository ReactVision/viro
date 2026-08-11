/**
 * Web host/navigator for Studio scenes. Web counterpart of StudioSceneNavigator
 * (native): instead of pushing StudioARScene onto ViroXRSceneNavigator via the
 * native VRTStudioModule, it holds the scene data in state and renders
 * StudioARScene.web inside a web navigator — ViroARSceneNavigator (AR via slam)
 * or Viro3DSceneNavigator (non-AR 3D), chosen from the scene's plane detection.
 *
 * Data source is injected (out of the renderer's scope): pass `sceneData`
 * directly, or a `loadScene(id)` fetcher (also used for NAVIGATION between
 * scenes via the runtime's injectable `navigate` seam). `apiRequestExecutor`
 * (for API_REQUEST functions) is likewise injected.
 */
import * as React from "react";
import type { SequenceRuntimeContext } from "./domain/sceneNavigationHandler";
import type { StudioSceneResponse } from "./types";
export interface StudioSceneNavigatorWebHandle {
    takeScreenshot: (fileName: string) => Promise<{
        success: boolean;
        url?: string;
    }>;
}
export interface StudioSceneNavigatorWebProps {
    /** Scene data injected directly (single scene, no fetching). */
    sceneData?: StudioSceneResponse;
    /** Fetch a scene by id — used for the initial load (if `sceneData` omitted) and NAVIGATION. */
    loadScene?: (sceneId: string) => Promise<StudioSceneResponse>;
    /** Initial scene id (when using `loadScene`). */
    sceneId?: string;
    /** API_REQUEST transport for scene functions. */
    apiRequestExecutor?: SequenceRuntimeContext["apiRequestExecutor"];
    /** Force a mode; default derives from the scene (AR if plane detection is on). */
    mode?: "ar" | "3d";
    /** Passed to the underlying web navigator (WASM asset loading). */
    webRendererOptions?: any;
    /** slam-wasm loading for AR mode (see ViroARSceneNavigator.web). */
    slamScriptUrl?: string;
    onSceneReady?: () => void;
    onError?: (err: Error) => void;
    onSceneChange?: (sceneId: string, sceneName: string) => void;
    onSceneLoaded?: (sceneData: StudioSceneResponse) => void;
    onPlaneDetected?: () => void;
    onUnsupported?: (features: string[]) => void;
    /**
     * Render the REC pill while a RECORD_VIDEO toggle is running. Default true,
     * matching native. Hosts with their own chrome set this false and render
     * <StudioRecordingIndicator /> where it fits.
     */
    recordingIndicator?: boolean;
    /**
     * Render the tap-to-place prompt while a scene asset awaits placement.
     * Default true, matching native.
     */
    placementIndicator?: boolean;
    /**
     * Capture/tuning options forwarded to the AR session. Merged over the
     * defaults this component sets, so a caller can add without restating them.
     * Passing `playback` here replays a recording instead of opening a camera.
     */
    arOptions?: Record<string, unknown>;
    /**
     * Called with the AR session once it is running, for hosts that drive it
     * rather than only observe it — stepping a replay, for instance.
     */
    onSessionReady?: (session: any) => void;
    noAssetsMessage?: string;
    loadingView?: React.ReactNode;
    renderError?: (error: Error) => React.ReactNode;
}
export declare const StudioSceneNavigator: React.ForwardRefExoticComponent<StudioSceneNavigatorWebProps & React.RefAttributes<StudioSceneNavigatorWebHandle>>;
