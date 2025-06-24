/**
 * ViroAnimatedComponent
 *
 * A component wrapper for adding animations to Viro components.
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

export interface ViroAnimatedComponentProps extends ViroCommonProps {
  // Animation properties
  animation?: {
    name?: string;
    delay?: number;
    loop?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
    run?: boolean;
    interruptible?: boolean;
  };

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroAnimatedComponent is a wrapper for adding animations to Viro components.
 * It provides animation capabilities to its children.
 */
export const ViroAnimatedComponent: React.FC<ViroAnimatedComponentProps> = (
  props
) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    animation: props.animation,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("animatedComponent", nativeProps);

  // Register animation event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro || !props.animation) return;

    const eventHandlers = [
      { name: "onAnimationStart", handler: props.animation.onStart },
      { name: "onAnimationFinish", handler: props.animation.onFinish },
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
  }, [nodeId, props.animation?.onStart, props.animation?.onFinish]);

  // Render children with this animated component as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
