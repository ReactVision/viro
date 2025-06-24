/**
 * ViroBox
 *
 * A 3D box component with customizable dimensions and materials.
 */

import React, { useContext } from "react";
import {
  ViroContext,
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroBoxProps extends ViroCommonProps {
  // Box-specific props
  width?: number;
  height?: number;
  length?: number;
  materials?: string | string[];

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Physics props
  highAccuracyEvents?: boolean;
}

/**
 * ViroBox is a 3D box component with customizable dimensions and materials.
 */
export const ViroBox: React.FC<ViroBoxProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    width: props.width ?? 1,
    height: props.height ?? 1,
    length: props.length ?? 1,
    materials: props.materials,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
    highAccuracyEvents: props.highAccuracyEvents,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("box", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [
      { name: "onHover", handler: props.onHover },
      { name: "onClick", handler: props.onClick },
      { name: "onClickState", handler: props.onClickState },
      { name: "onTouch", handler: props.onTouch },
      { name: "onScroll", handler: props.onScroll },
      { name: "onSwipe", handler: props.onSwipe },
      { name: "onDrag", handler: props.onDrag },
      { name: "onPinch", handler: props.onPinch },
      { name: "onRotate", handler: props.onRotate },
      {
        name: "onFuse",
        handler:
          typeof props.onFuse === "function"
            ? props.onFuse
            : props.onFuse?.callback,
      },
      { name: "onCollision", handler: props.onCollision },
      { name: "onTransformUpdate", handler: props.onTransformUpdate },
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
    props.onScroll,
    props.onSwipe,
    props.onDrag,
    props.onPinch,
    props.onRotate,
    props.onFuse,
    props.onCollision,
    props.onTransformUpdate,
  ]);

  // Box doesn't have children, so just return null
  return null;
};
