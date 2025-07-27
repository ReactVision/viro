/**
 * Viro3DObject
 *
 * A component for loading and displaying 3D models in various formats.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface Viro3DObjectProps extends ViroCommonProps {
  // 3D model source
  source: { uri: string } | number;

  // Resources
  resources?: ({ uri: string } | number)[];

  // Model properties
  type: "OBJ" | "VRX" | "GLTF" | "GLB" | "FBX";
  position?: [number, number, number];
  scale?: [number, number, number] | number;
  rotation?: [number, number, number];

  // Materials
  materials?: string | string[];

  // Morphing
  morphTargets?: {
    [key: string]: number;
  };

  // Animation
  animation?: {
    name?: string;
    delay?: number;
    loop?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
    run?: boolean;
    interruptible?: boolean;
  };

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Physics props
  highAccuracyEvents?: boolean;
  physicsBody?: {
    type: "Dynamic" | "Kinematic" | "Static";
    mass?: number;
    restitution?: number;
    shape?: {
      type: "Box" | "Sphere" | "Compound";
      params?: number[];
    };
    friction?: number;
    useGravity?: boolean;
    enabled?: boolean;
    velocity?: [number, number, number];
    force?: {
      value: [number, number, number];
      position: [number, number, number];
    };
    torque?: [number, number, number];
  };

  // Events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * Viro3DObject is a component for loading and displaying 3D models in various formats.
 */
export const Viro3DObject: React.FC<Viro3DObjectProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    resources: props.resources,
    type: props.type,
    materials: props.materials,
    morphTargets: props.morphTargets,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
    highAccuracyEvents: props.highAccuracyEvents,
    physicsBody: props.physicsBody,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("object", nativeProps);

  
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
