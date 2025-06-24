/**
 * Viro3DObject
 *
 * A component for loading and displaying 3D models in various formats.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
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

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onHover", handler: props.onHover },
      { name: "onClick", handler: props.onClick },
      { name: "onClickState", handler: props.onClickState },
      { name: "onTouch", handler: props.onTouch },
      { name: "onDrag", handler: props.onDrag },
      { name: "onPinch", handler: props.onPinch },
      { name: "onRotate", handler: props.onRotate },
      { name: "onLoadStart", handler: props.onLoadStart },
      { name: "onLoadEnd", handler: props.onLoadEnd },
      { name: "onError", handler: props.onError },
    ];

    // Register all event handlers and store callback IDs for cleanup
    const registeredCallbacks = eventHandlers
      .filter(({ handler }) => !!handler)
      .map(({ name, handler }) => {
        const callbackId = `${nodeId}_${name}`;

        // Register the callback in the global registry
        if (typeof global !== "undefined" && global.registerViroEventCallback) {
          global.registerViroEventCallback(callbackId, handler);
        }

        // Register with native code
        nativeViro.registerEventCallback(nodeId, name, callbackId);
        return { name, callbackId };
      });

    // Cleanup when unmounting
    return () => {
      const nativeViro = getNativeViro();
      if (!nativeViro) return;

      // Unregister all event handlers
      registeredCallbacks.forEach(({ name, callbackId }) => {
        nativeViro.unregisterEventCallback(nodeId, name, callbackId);
      });
    };
  }, [
    nodeId,
    props.onHover,
    props.onClick,
    props.onClickState,
    props.onTouch,
    props.onDrag,
    props.onPinch,
    props.onRotate,
    props.onLoadStart,
    props.onLoadEnd,
    props.onError,
  ]);

  // 3D Object doesn't have children, so just return null
  return null;
};
