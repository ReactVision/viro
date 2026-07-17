/**
 * Web bridge contexts. The renderer host (Viro3DSceneNavigator.web) provides the
 * ViroWebRenderer; each node component provides its own handle as the parent for
 * its children, so the React tree maps onto the native scene graph.
 */
import { createContext, useContext } from "react";
import {
  ViroTrackingState,
  type ViroWebRenderer,
  type ViroSceneApi,
  type ViroHandle,
  type ViroArSession,
  type ArPlaneAnchor,
} from "@reactvision/viro-web-renderer";

export const ViroRendererContext = createContext<ViroWebRenderer | null>(null);

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

export const ViroARContext = createContext<ViroARState>({
  session: null,
  anchors: [],
  trackingState: ViroTrackingState.Unavailable,
});

export function useViroAR(): ViroARState {
  return useContext(ViroARContext);
}

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

export const ViroARPlaneClaimsContext = createContext<ViroARPlaneClaims | null>(null);

/** The parent node handle for the current subtree (0 = scene root not yet available). */
export const ViroParentNodeContext = createContext<ViroHandle>(0);

export function useViroRenderer(): ViroWebRenderer {
  const renderer = useContext(ViroRendererContext);
  if (!renderer) {
    throw new Error(
      "Viro web components must be rendered inside a Viro scene navigator (no renderer in context).",
    );
  }
  return renderer;
}

export function useViroScene(): ViroSceneApi {
  return useViroRenderer().scene;
}

export function useViroParentNode(): ViroHandle {
  return useContext(ViroParentNodeContext);
}
