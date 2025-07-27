/**
 * ViroImage
 *
 * A component for displaying 2D images in 3D space.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  useViroEventListeners,
  convertCommonProps,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroImageProps extends ViroCommonProps {
  // Image source
  source: { uri: string } | number;

  // Image properties
  width?: number;
  height?: number;
  resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
  imageClipMode?: "None" | "ClipToBounds";
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
  format?: "RGBA8" | "RGB565";
  mipmap?: boolean;

  // Placeholder
  placeholderSource?: { uri: string } | number;

  // Materials
  materials?: string | string[];

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;
}

/**
 * ViroImage is a component for displaying 2D images in 3D space.
 */
export const ViroImage: React.FC<ViroImageProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    width: props.width,
    height: props.height,
    resizeMode: props.resizeMode,
    imageClipMode: props.imageClipMode,
    stereoMode: props.stereoMode,
    format: props.format,
    mipmap: props.mipmap,
    placeholderSource: props.placeholderSource,
    materials: props.materials,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("image", nativeProps);

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

  // Image doesn't have children, so just return null
  return null;
};
