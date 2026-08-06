import { ViroTrackingState, type ViroWebRenderer, type ViroSceneApi, type ViroHandle, type ViroArSession, type ArPlaneAnchor } from "@reactvision/viro-web-renderer";
export declare const ViroRendererContext: import("react").Context<ViroWebRenderer | null>;
/**
 * AR session state, provided by ViroARSceneNavigator.web and consumed by
 * ViroARScene / ViroARPlane. `anchors` is the latest detected plane set;
 * `session` exposes hit-testing.
 */
export interface ViroARState {
    session: ViroArSession | null;
    anchors: ArPlaneAnchor[];
    trackingState: ViroTrackingState;
}
export declare const ViroARContext: import("react").Context<ViroARState>;
export declare function useViroAR(): ViroARState;
/**
 * Coordinates which ViroARPlane owns which detected anchor, so multiple
 * auto-matching planes don't claim the same one. Provided by ViroARScene.
 */
export interface ViroARPlaneClaims {
    /** Claim the first unclaimed candidate for this component; returns its id or null. */
    claim(componentId: string, candidateIds: string[]): string | null;
    /** Release this component's claim. */
    release(componentId: string): void;
    /** The anchor id currently claimed by this component, if any. */
    claimed(componentId: string): string | null;
}
export declare const ViroARPlaneClaimsContext: import("react").Context<ViroARPlaneClaims | null>;
/** The parent node handle for the current subtree (0 = scene root not yet available). */
export declare const ViroParentNodeContext: import("react").Context<number>;
export declare function useViroRenderer(): ViroWebRenderer;
export declare function useViroScene(): ViroSceneApi;
export declare function useViroParentNode(): ViroHandle;
