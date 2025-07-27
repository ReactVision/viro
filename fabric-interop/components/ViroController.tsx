/**
 * ViroController
 *
 * A component for VR controller interaction.
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

export interface ViroControllerProps extends ViroCommonProps {
  // Controller properties
  controllerVisibility?: boolean;
  reticleVisibility?: boolean;

  // Events
  onControllerUpdate?: (event: any) => void;
  onMove?: (event: any) => void;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroController is a component for VR controller interaction.
 * It provides controller tracking and interaction capabilities.
 */
export const ViroController: React.FC<ViroControllerProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    controllerVisibility: props.controllerVisibility,
    reticleVisibility: props.reticleVisibility,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("controller", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onControllerUpdate", handler: props.onControllerUpdate },
      { name: "onMove", handler: props.onMove },
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
  }, [nodeId, props.onControllerUpdate, props.onMove]);

  // Render children with this controller as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
