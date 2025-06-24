/**
 * ViroSkyBox
 *
 * A component for creating skybox environments.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSkyBoxProps extends ViroCommonProps {
  // Skybox source
  source: {
    nx: { uri: string } | number;
    px: { uri: string } | number;
    ny: { uri: string } | number;
    py: { uri: string } | number;
    nz: { uri: string } | number;
    pz: { uri: string } | number;
  };

  // Skybox properties
  format?: "RGBA8" | "RGB565";
  isHdr?: boolean;

  // Events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * ViroSkyBox is a component for creating skybox environments.
 * It uses six cube faces to create an immersive 360-degree environment.
 */
export const ViroSkyBox: React.FC<ViroSkyBoxProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    format: props.format,
    isHdr: props.isHdr,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("skyBox", nativeProps);

  
  // Register event handlers using our new event system
  useViroEventListeners(nodeId, {
    onHover: props.onHover,
    onClick: props.onClick,
    onClickState: props.onClickState,
    onTouch: props.onTouch,
    onScroll: props.onScroll,
    onSwipe: props.onSwipe,
    onDrag: props.onDrag,
    onPinch: props.onPinch,
    onRotate: props.onRotate,
    onFuse:
      typeof props.onFuse === "function"
        ? props.onFuse
        : props.onFuse?.callback,
    onCollision: props.onCollision,
    onTransformUpdate: props.onTransformUpdate,
  });

  // Component doesn't have children, so just return null
  return null;
};
