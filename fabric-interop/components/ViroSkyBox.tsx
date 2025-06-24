/**
 * ViroSkyBox
 *
 * A component for creating skybox environments.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSkyBoxProps extends ViroCommonProps {
  // Skybox source
  source: {
    nx: { uri: string } | number;
    px: { uri: string } | number;
    ny: { uri: string } | number;
    py: { uri: string } | number;
    nz: { uri: string } | number;
    pz: { uri: string } | number;
  };

  // Skybox properties
  format?: "RGBA8" | "RGB565";
  isHdr?: boolean;

  // Events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * ViroSkyBox is a component for creating skybox environments.
 * It uses six cube faces to create an immersive 360-degree environment.
 */
export const ViroSkyBox: React.FC<ViroSkyBoxProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    format: props.format,
    isHdr: props.isHdr,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("skyBox", nativeProps);

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

  // SkyBox doesn't have children, so just return null
  return null;
};
