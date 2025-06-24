/**
 * ViroCamera
 *
 * A component for controlling the scene camera.
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

export interface ViroCameraProps extends ViroCommonProps {
  // Camera properties
  fieldOfView?: number;
  focalPoint?: [number, number, number];

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroCamera is a component for controlling the scene camera.
 * It allows customization of camera properties and behavior.
 */
export const ViroCamera: React.FC<ViroCameraProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    fieldOfView: props.fieldOfView,
    focalPoint: props.focalPoint,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("camera", nativeProps);

  // Render children with this camera as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
