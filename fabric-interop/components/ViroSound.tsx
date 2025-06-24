/**
 * ViroSound
 *
 * A component for playing audio in the scene.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSoundProps extends ViroCommonProps {
  // Audio source
  source: { uri: string } | number;

  // Audio properties
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  loop?: boolean;

  // Events
  onFinish?: () => void;
  onError?: (error: string) => void;
}

/**
 * ViroSound is a component for playing audio in the scene.
 * It provides basic audio playback functionality.
 */
export const ViroSound: React.FC<ViroSoundProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    paused: props.paused,
    volume: props.volume,
    muted: props.muted,
    loop: props.loop,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("sound", nativeProps);

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

  // Sound doesn't have children, so just return null
  return null;
};
