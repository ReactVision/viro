/**
 * ViroMaterialVideo
 *
 * A component for using video as a material texture.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroMaterialVideoProps extends ViroCommonProps {
  // Material name
  material: string;

  // Video source
  source: { uri: string } | number;

  // Video properties
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";

  // Events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onBufferStart?: () => void;
  onBufferEnd?: () => void;
  onFinish?: () => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
  onError?: (error: string) => void;
}

/**
 * ViroMaterialVideo is a component for using video as a material texture.
 * It allows video content to be applied as a texture to 3D objects.
 */
export const ViroMaterialVideo: React.FC<ViroMaterialVideoProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    material: props.material,
    source: props.source,
    paused: props.paused,
    loop: props.loop,
    muted: props.muted,
    volume: props.volume,
    stereoMode: props.stereoMode,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("materialVideo", nativeProps);

  
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
