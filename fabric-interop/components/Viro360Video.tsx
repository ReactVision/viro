/**
 * Viro360Video
 *
 * A component for displaying 360-degree videos.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface Viro360VideoProps extends ViroCommonProps {
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
 * Viro360Video is a component for displaying 360-degree videos.
 * It creates an immersive environment using spherical panoramic videos.
 */
export const Viro360Video: React.FC<Viro360VideoProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    paused: props.paused,
    loop: props.loop,
    muted: props.muted,
    volume: props.volume,
    stereoMode: props.stereoMode,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("360Video", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onLoadStart", handler: props.onLoadStart },
      { name: "onLoadEnd", handler: props.onLoadEnd },
      { name: "onBufferStart", handler: props.onBufferStart },
      { name: "onBufferEnd", handler: props.onBufferEnd },
      { name: "onFinish", handler: props.onFinish },
      { name: "onUpdateTime", handler: props.onUpdateTime },
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
    props.onLoadStart,
    props.onLoadEnd,
    props.onBufferStart,
    props.onBufferEnd,
    props.onFinish,
    props.onUpdateTime,
    props.onError,
  ]);

  // 360 Video doesn't have children, so just return null
  return null;
};
