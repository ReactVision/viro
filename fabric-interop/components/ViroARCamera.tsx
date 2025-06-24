/**
 * ViroARCamera
 *
 * A component for controlling the camera in an AR scene.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  ViroContextProvider,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

// Custom type for transform update event
export type ViroARCameraTransformUpdateEvent = {
  position: [number, number, number];
  rotation: [number, number, number];
  forward: [number, number, number];
  up: [number, number, number];
};

// Custom type for tracking state update event
export type ViroARTrackingStateEvent = {
  state: "NORMAL" | "LIMITED" | "NOT_AVAILABLE";
  reason?:
    | "NONE"
    | "INITIALIZING"
    | "EXCESSIVE_MOTION"
    | "INSUFFICIENT_FEATURES";
};

export interface ViroARCameraProps
  extends Omit<ViroCommonProps, "onTransformUpdate"> {
  // Camera properties
  active?: boolean;

  // Events with specific types
  onTransformUpdate?: (event: ViroARCameraTransformUpdateEvent) => void;
  onTrackingUpdated?: (event: ViroARTrackingStateEvent) => void;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroARCamera is a component for controlling the camera in an AR scene.
 * It provides information about the camera's position and orientation in the real world,
 * as well as tracking state updates.
 */
export const ViroARCamera: React.FC<ViroARCameraProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    active: props.active,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("arCamera", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onTransformUpdate", handler: props.onTransformUpdate },
      { name: "onTrackingUpdated", handler: props.onTrackingUpdated },
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
  }, [nodeId, props.onTransformUpdate, props.onTrackingUpdated]);

  // Render children with this AR camera as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
