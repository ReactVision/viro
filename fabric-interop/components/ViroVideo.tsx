/**
 * ViroVideo
 *
 * A component for displaying video content in 3D space.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroVideoProps extends ViroCommonProps {
  // Video source
  source: { uri: string } | number;

  // Video properties
  width?: number;
  height?: number;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  paused?: boolean;
  resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";

  // Materials
  materials?: string | string[];

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Events
  onBufferStart?: () => void;
  onBufferEnd?: () => void;
  onFinish?: () => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
  onError?: (error: string) => void;
}

/**
 * ViroVideo is a component for displaying video content in 3D space.
 */
export const ViroVideo: React.FC<ViroVideoProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    width: props.width,
    height: props.height,
    loop: props.loop,
    muted: props.muted,
    volume: props.volume,
    paused: props.paused,
    resizeMode: props.resizeMode,
    stereoMode: props.stereoMode,
    materials: props.materials,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("video", nativeProps);

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
      { name: "onBufferStart", handler: props.onBufferStart },
      { name: "onBufferEnd", handler: props.onBufferEnd },
      { name: "onFinish", handler: props.onFinish },
      { name: "onError", handler: props.onError },
      { name: "onUpdateTime", handler: props.onUpdateTime },
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
    props.onBufferStart,
    props.onBufferEnd,
    props.onFinish,
    props.onError,
    props.onUpdateTime,
  ]);

  // Video doesn't have children, so just return null
  return null;
};
