/**
 * ViroSpatialSound
 *
 * A component for playing 3D positioned audio in the scene.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSpatialSoundProps extends ViroCommonProps {
  // Audio source
  source: { uri: string } | number;

  // Audio properties
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  loop?: boolean;

  // Spatial properties
  minDistance?: number;
  maxDistance?: number;
  rolloffModel?: "linear" | "exponential" | "logarithmic";
  distanceRolloffFactor?: number;

  // Events
  onFinish?: () => void;
  onError?: (error: string) => void;
}

/**
 * ViroSpatialSound is a component for playing 3D positioned audio in the scene.
 * It provides spatial audio that changes based on the listener's position relative to the sound source.
 */
export const ViroSpatialSound: React.FC<ViroSpatialSoundProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    paused: props.paused,
    volume: props.volume,
    muted: props.muted,
    loop: props.loop,
    minDistance: props.minDistance,
    maxDistance: props.maxDistance,
    rolloffModel: props.rolloffModel,
    distanceRolloffFactor: props.distanceRolloffFactor,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("spatialSound", nativeProps);

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

  // Spatial sound doesn't have children, so just return null
  return null;
};
