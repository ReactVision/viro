/**
 * ViroPortalScene
 *
 * A component for portal scene content.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  ViroContextProvider,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroPortalSceneProps extends ViroCommonProps {
  // Portal scene properties
  passable?: boolean;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroPortalScene is a component for portal scene content.
 * It defines the content that appears inside a portal.
 */
export const ViroPortalScene: React.FC<ViroPortalSceneProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    passable: props.passable,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("portalScene", nativeProps);

  // Render children with this portal scene as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
