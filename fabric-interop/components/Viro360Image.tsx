/**
 * Viro360Image
 *
 * A component for displaying 360-degree images.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface Viro360ImageProps extends ViroCommonProps {
  // Image source
  source: { uri: string } | number;

  // Image properties
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
  format?: "RGBA8" | "RGB565";
  isHdr?: boolean;

  // Events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * Viro360Image is a component for displaying 360-degree images.
 * It creates an immersive environment using spherical panoramic images.
 */
export const Viro360Image: React.FC<Viro360ImageProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    stereoMode: props.stereoMode,
    format: props.format,
    isHdr: props.isHdr,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("360Image", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
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
  }, [nodeId, props.onLoadStart, props.onLoadEnd, props.onError]);

  // 360 Image doesn't have children, so just return null
  return null;
};
