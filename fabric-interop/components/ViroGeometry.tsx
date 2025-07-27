/**
 * ViroGeometry
 *
 * A component for rendering custom 3D geometry.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroGeometryProps extends ViroCommonProps {
  // Geometry data
  vertices: [number, number, number][];
  normals?: [number, number, number][];
  texcoords?: [number, number][];
  triangleIndices: number[][];

  // Materials
  materials?: string | string[];

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Physics props
  type?: "Dynamic" | "Kinematic" | "Static";
}

/**
 * ViroGeometry is a component for rendering custom 3D geometry.
 * It allows you to create custom 3D shapes by specifying vertices, normals,
 * texture coordinates, and triangle indices.
 */
export const ViroGeometry: React.FC<ViroGeometryProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    vertices: props.vertices,
    normals: props.normals,
    texcoords: props.texcoords,
    triangleIndices: props.triangleIndices,
    materials: props.materials,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
    type: props.type,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("geometry", nativeProps);

  
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
