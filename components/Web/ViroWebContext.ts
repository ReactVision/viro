/**
 * Web bridge contexts. The renderer host (Viro3DSceneNavigator.web) provides the
 * ViroWebRenderer; each node component provides its own handle as the parent for
 * its children, so the React tree maps onto the native scene graph.
 */
import { createContext, useContext } from "react";
import type {
  ViroWebRenderer,
  ViroSceneApi,
  ViroHandle,
} from "@reactvision/viro-web-renderer";

export const ViroRendererContext = createContext<ViroWebRenderer | null>(null);

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
