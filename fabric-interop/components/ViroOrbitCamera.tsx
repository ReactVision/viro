/**
 * ViroOrbitCamera
 *
 * A component for orbital camera controls.
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

export interface ViroOrbitCameraProps extends ViroCommonProps {
  // Orbit properties
  focalPoint?: [number, number, number];
  distance?: number;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroOrbitCamera is a component for orbital camera controls.
 * It allows the camera to orbit around a focal point.
 */
export const ViroOrbitCamera: React.FC<ViroOrbitCameraProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    focalPoint: props.focalPoint,
    distance: props.distance,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("orbitCamera", nativeProps);

  // Render children with this orbit camera as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
