/**
 * ViroARPlane
 *
 * A component for rendering AR planes detected by the AR system.
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

export interface ViroARPlaneProps extends ViroCommonProps {
  // Plane properties
  alignment?: "Horizontal" | "Vertical";
  minHeight?: number;
  minWidth?: number;

  // Visual properties
  visible?: boolean;
  opacity?: number;

  // Materials
  materials?: string | string[];

  // Events
  onAnchorFound?: () => void;
  onAnchorUpdated?: () => void;
  onAnchorRemoved?: () => void;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroARPlane is a component for rendering AR planes detected by the AR system.
 * It represents a real-world surface detected by the AR system, such as a floor, table, or wall.
 */
export const ViroARPlane: React.FC<ViroARPlaneProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    alignment: props.alignment,
    minHeight: props.minHeight,
    minWidth: props.minWidth,
    visible: props.visible,
    opacity: props.opacity,
    materials: props.materials,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("arPlane", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onAnchorFound", handler: props.onAnchorFound },
      { name: "onAnchorUpdated", handler: props.onAnchorUpdated },
      { name: "onAnchorRemoved", handler: props.onAnchorRemoved },
      { name: "onHover", handler: props.onHover },
      { name: "onClick", handler: props.onClick },
      { name: "onClickState", handler: props.onClickState },
      { name: "onTouch", handler: props.onTouch },
      { name: "onDrag", handler: props.onDrag },
      { name: "onPinch", handler: props.onPinch },
      { name: "onRotate", handler: props.onRotate },
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
    props.onHover,
    props.onClick,
    props.onClickState,
    props.onTouch,
    props.onDrag,
    props.onPinch,
    props.onRotate,
  ]);

  // Render children with this AR plane as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
