/**
 * ViroFlexView
 *
 * A component for creating flexible layouts in 3D space.
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

export interface ViroFlexViewProps extends ViroCommonProps {
  // Layout properties
  width?: number;
  height?: number;

  // Flex properties
  flex?: number;
  flexDirection?: "row" | "column";
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around";
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch";
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;

  // Visual properties
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;

  // Materials
  materials?: string | string[];

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroFlexView is a component for creating flexible layouts in 3D space.
 * It allows you to arrange child components using flexbox-like layout rules.
 */
export const ViroFlexView: React.FC<ViroFlexViewProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    width: props.width,
    height: props.height,
    flex: props.flex,
    flexDirection: props.flexDirection,
    justifyContent: props.justifyContent,
    alignItems: props.alignItems,
    padding: props.padding,
    paddingTop: props.paddingTop,
    paddingBottom: props.paddingBottom,
    paddingLeft: props.paddingLeft,
    paddingRight: props.paddingRight,
    margin: props.margin,
    marginTop: props.marginTop,
    marginBottom: props.marginBottom,
    marginLeft: props.marginLeft,
    marginRight: props.marginRight,
    backgroundColor: props.backgroundColor,
    borderRadius: props.borderRadius,
    borderWidth: props.borderWidth,
    borderColor: props.borderColor,
    materials: props.materials,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("flexView", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
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
    props.onHover,
    props.onClick,
    props.onClickState,
    props.onTouch,
    props.onDrag,
    props.onPinch,
    props.onRotate,
  ]);

  // Render children with this flex view as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
