/**
 * ViroSpatialSound
 *
 * A component for playing 3D positioned audio in the scene.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSpatialSoundProps extends ViroCommonProps {
  // Audio source
  source: { uri: string } | number;

  // Audio properties
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  loop?: boolean;

  // Spatial properties
  minDistance?: number;
  maxDistance?: number;
  rolloffModel?: "linear" | "exponential" | "logarithmic";
  distanceRolloffFactor?: number;

  // Events
  onFinish?: () => void;
  onError?: (error: string) => void;
}

/**
 * ViroSpatialSound is a component for playing 3D positioned audio in the scene.
 * It provides spatial audio that changes based on the listener's position relative to the sound source.
 */
export const ViroSpatialSound: React.FC<ViroSpatialSoundProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    paused: props.paused,
    volume: props.volume,
    muted: props.muted,
    loop: props.loop,
    minDistance: props.minDistance,
    maxDistance: props.maxDistance,
    rolloffModel: props.rolloffModel,
    distanceRolloffFactor: props.distanceRolloffFactor,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("spatialSound", nativeProps);

  
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
