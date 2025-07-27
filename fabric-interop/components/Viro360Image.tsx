/**
 * Viro360Image
 *
 * A component for displaying 360-degree images.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface Viro360ImageProps extends ViroCommonProps {
  // Image source
  source: { uri: string } | number;

  // Image properties
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
  format?: "RGBA8" | "RGB565";
  isHdr?: boolean;

  // Events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * Viro360Image is a component for displaying 360-degree images.
 * It creates an immersive environment using spherical panoramic images.
 */
export const Viro360Image: React.FC<Viro360ImageProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    stereoMode: props.stereoMode,
    format: props.format,
    isHdr: props.isHdr,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("360Image", nativeProps);

  
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
