/**
 * ViroSoundField
 *
 * A component for playing ambient audio field in the scene.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
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

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onFinish", handler: props.onFinish },
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
  }, [nodeId, props.onFinish, props.onError]);

  // Sound field doesn't have children, so just return null
  return null;
};
