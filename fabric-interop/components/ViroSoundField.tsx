/**
 * ViroSoundField
 *
 * A component for playing ambient audio field in the scene.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSoundFieldProps extends ViroCommonProps {
  // Audio source
  source: { uri: string } | number;

  // Audio properties
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  loop?: boolean;

  // Sound field properties
  rotation?: [number, number, number];

  // Events
  onFinish?: () => void;
  onError?: (error: string) => void;
}

/**
 * ViroSoundField is a component for playing ambient audio field in the scene.
 * It provides 360-degree ambient audio that surrounds the listener.
 */
export const ViroSoundField: React.FC<ViroSoundFieldProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    paused: props.paused,
    volume: props.volume,
    muted: props.muted,
    loop: props.loop,
    rotation: props.rotation,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("soundField", nativeProps);

  
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
