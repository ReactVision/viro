/**
 * ViroMaterialVideo
 *
 * A component for using video as a material texture.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
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

  // Material video doesn't have children, so just return null
  return null;
};
