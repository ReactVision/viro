/**
 * ViroText
 *
 * A component for rendering 3D text in the Viro scene.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroTextProps extends ViroCommonProps {
  // Text content
  text: string;

  // Text style props
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?:
    | "100"
    | "200"
    | "300"
    | "400"
    | "500"
    | "600"
    | "700"
    | "800"
    | "900"
    | "normal"
    | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  textAlignVertical?: "top" | "center" | "bottom";
  textLineBreakMode?: "wordwrap" | "charwrap" | "justify" | "none";
  textClipMode?: "none" | "clipToBounds";

  // Layout props
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;

  // Material props
  materials?: string | string[];
  extrusionDepth?: number;
  outerStroke?: {
    type?: string;
    width?: number;
    color?: string;
  };

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;
}

/**
 * ViroText is a component for rendering 3D text in the Viro scene.
 */
export const ViroText: React.FC<ViroTextProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    text: props.text,
    color: props.color,
    fontFamily: props.fontFamily,
    fontSize: props.fontSize,
    fontWeight: props.fontWeight,
    fontStyle: props.fontStyle,
    textAlign: props.textAlign,
    textAlignVertical: props.textAlignVertical,
    textLineBreakMode: props.textLineBreakMode,
    textClipMode: props.textClipMode,
    width: props.width,
    height: props.height,
    maxWidth: props.maxWidth,
    maxHeight: props.maxHeight,
    materials: props.materials,
    extrusionDepth: props.extrusionDepth,
    outerStroke: props.outerStroke,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("text", nativeProps);

  // Text doesn't have children, so just return null
  return null;
};
