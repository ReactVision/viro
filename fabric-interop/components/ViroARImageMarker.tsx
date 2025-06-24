/**
 * ViroARImageMarker
 *
 * A component for detecting and tracking images in the real world.
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

export interface ViroARImageMarkerProps extends ViroCommonProps {
  // Image marker properties
  target: string;

  // Visual properties
  visible?: boolean;
  opacity?: number;

  // Events
  onAnchorFound?: () => void;
  onAnchorUpdated?: () => void;
  onAnchorRemoved?: () => void;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroARImageMarker is a component for detecting and tracking images in the real world.
 * It allows you to attach virtual content to real-world images, such as posters, book covers, or logos.
 */
export const ViroARImageMarker: React.FC<ViroARImageMarkerProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    target: props.target,
    visible: props.visible,
    opacity: props.opacity,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("arImageMarker", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onAnchorFound", handler: props.onAnchorFound },
      { name: "onAnchorUpdated", handler: props.onAnchorUpdated },
      { name: "onAnchorRemoved", handler: props.onAnchorRemoved },
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
    props.onAnchorFound,
    props.onAnchorUpdated,
    props.onAnchorRemoved,
  ]);

  // Render children with this AR image marker as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
