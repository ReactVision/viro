/**
 * ViroAnimatedImage
 *
 * A component for displaying animated images.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroAnimatedImageProps extends ViroCommonProps {
  // Image source
  source: { uri: string }[] | number[];

  // Animation properties
  loop?: boolean;
  delay?: number;
  visible?: boolean;
  opacity?: number;
  width?: number;
  height?: number;

  // Material properties
  materials?: string | string[];

  // Events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
  onFinish?: () => void;
}

/**
 * ViroAnimatedImage is a component for displaying animated images.
 * It can be used to create simple animations by cycling through a series of images.
 */
export const ViroAnimatedImage: React.FC<ViroAnimatedImageProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    loop: props.loop,
    delay: props.delay,
    visible: props.visible,
    opacity: props.opacity,
    width: props.width,
    height: props.height,
    materials: props.materials,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("animatedImage", nativeProps);

  
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
