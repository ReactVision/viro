/**
 * Web host for Studio scenes. Mirrors StudioARScene (native) but adapted to the
 * web renderer: it reuses the entire shared runtime (domain/ — scheduler, stores,
 * sound manager, sceneNavigationHandler, viroNodeFactory) and mounts the nodes
 * with the `.web` Viro components.
 *
 * Web adaptations vs native:
 *  - Root is ViroARScene (AR via slam) in `mode="ar"`, else ViroScene (3D).
 *  - AUTOMATIC/MANUAL plane detection → wrap plane assets in ViroARPlane (slam).
 *    (MANUAL degrades to auto-match; there is no web plane-selector UI yet.)
 *  - Tap-to-place runs off the AR session's hit test rather than a native one,
 *    and the navigator supplies the tap surface.
 *  - Physics and collision triggers run here: Bullet is compiled into the web
 *    binary and this host drives it, honouring the scene's own switch.
 *  - Dropped (no web equivalent): Quest/ViroController, image-triggered assets
 *    (ViroARImageMarker), drag, and the gaze bindings. `webCapabilities`
 *    reports them through `onUnsupported` so the caller can warn.
 *  - apiRequestExecutor + navigate are injected (no native VRTStudioModule).
 */
import * as React from "react";
import { type StudioAssetErrorHandler } from "./domain/viroNodeFactory";
import { type SequenceRuntimeContext } from "./domain/sceneNavigationHandler";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioPlacementStore } from "./domain/placementStore";
import type { StudioSceneResponse } from "./types";
/**
 * Imperative placement surface the navigator's tap overlay drives. Mirrors the
 * native host's, so the overlay is the same component on both.
 */
export type StudioPlacementApi = {
    placeAtScreenPoint: (x: number, y: number) => Promise<"placed" | "miss">;
};
export interface StudioApiRequestExecutorLike {
    (body: string): Promise<{
        success: boolean;
        data?: string;
        error?: string;
    }>;
}
interface Props {
    sceneData: StudioSceneResponse | null;
    /** "ar" mounts ViroARScene (slam camera+pose+planes); "3d" mounts ViroScene. */
    mode?: "ar" | "3d";
    /** Injected API_REQUEST transport (replaces native VRTStudioModule). */
    apiRequestExecutor?: SequenceRuntimeContext["apiRequestExecutor"];
    /** Injected scene navigation (fetch + re-render); wired by the web navigator. */
    navigate?: (targetSceneId: string) => void;
    onReady?: () => void;
    onSceneChange?: (sceneId: string, sceneName: string) => void;
    onPlaneDetected?: () => void;
    /** Reports scene features that won't render on web (for a capability warning). */
    onUnsupported?: (features: string[]) => void;
    noAssetsMessage?: string;
    variableStore?: StudioVariableStore;
    /** Receives the placement API so the navigator's tap overlay can drive it. */
    placementApiRef?: React.MutableRefObject<StudioPlacementApi | null>;
    /** Injected so the navigator can drive its own prompt off the same queue. */
    placementStore?: StudioPlacementStore;
    /** Told when an asset's model, image or video fails to load. */
    onAssetError?: StudioAssetErrorHandler;
}
/** Outer gate: keep hooks out of the tree until sceneData exists. */
export declare const StudioARScene: React.FC<Props>;
export {};
