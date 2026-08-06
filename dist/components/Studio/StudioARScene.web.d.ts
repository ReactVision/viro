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
 *  - Dropped (no web equivalent): Quest/ViroController, image-triggered assets
 *    (ViroARImageMarker), native physics, drag, collisions. These are reported
 *    via `onUnsupported` so the caller can warn.
 *  - apiRequestExecutor + navigate are injected (no native VRTStudioModule).
 */
import * as React from "react";
import { type SequenceRuntimeContext } from "./domain/sceneNavigationHandler";
import { StudioVariableStore } from "./domain/variableStore";
import type { StudioSceneResponse } from "./types";
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
}
/** Outer gate: keep hooks out of the tree until sceneData exists. */
export declare const StudioARScene: React.FC<Props>;
export {};
