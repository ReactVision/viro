/**
 * ViroScene
 *
 * A scene component that manages a 3D scene with scene lifecycle management.
 */

import React, { useEffect, useRef } from "react";
import {
  ViroCommonProps,
  useViroNode,
  useViroEventListeners,
  convertCommonProps,
  ViroContextProvider,
} from "./ViroUtils";
import {
  createScene,
  activateScene,
  deactivateScene,
  destroyScene,
  getSceneState,
  generateNodeId,
} from "../NativeViro";

export interface ViroSceneProps extends ViroCommonProps {
  // Scene-specific props
  postProcessEffects?: string[];
  soundRoom?: {
    size: [number, number, number];
    wallMaterial?: string;
    ceilingMaterial?: string;
    floorMaterial?: string;
  };
  physicsWorld?: {
    gravity: [number, number, number];
    drawBounds?: boolean;
  };

  // Scene lifecycle events
  onSceneLoad?: () => void;
  onSceneLoadStart?: () => void;
  onSceneLoadEnd?: () => void;
  onSceneError?: (error: string) => void;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroScene is a 3D scene component that manages scene lifecycle and contains other Viro components.
 */
export const ViroScene: React.FC<ViroSceneProps> = (props) => {
  const sceneId = useRef<string>(generateNodeId());

  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    postProcessEffects: props.postProcessEffects,
    soundRoom: props.soundRoom,
    physicsWorld: props.physicsWorld,
  };

  // Create the scene node using our enhanced scene management
  const nodeId = useViroNode("scene", nativeProps);

  // Scene lifecycle management
  useEffect(() => {
    // Create the scene with our scene manager
    createScene(sceneId.current, "scene", nativeProps);

    // Activate the scene
    activateScene(sceneId.current);

    // Cleanup when unmounting
    return () => {
      // Deactivate and destroy the scene
      deactivateScene(sceneId.current);
      destroyScene(sceneId.current);
    };
  }, []);

  // Update scene properties when they change
  useEffect(() => {
    // Scene properties are updated through the node system
    // The scene manager will handle the lifecycle
  }, [nativeProps]);

  // Register event handlers using our new event system
  useViroEventListeners(nodeId, {
    onHover: props.onHover,
    onClick: props.onClick,
    onClickState: props.onClickState,
    onTouch: props.onTouch,
    onScroll: props.onScroll,
    onSwipe: props.onSwipe,
    onDrag: props.onDrag,
    onPinch: props.onPinch,
    onRotate: props.onRotate,
    onFuse:
      typeof props.onFuse === "function"
        ? props.onFuse
        : props.onFuse?.callback,
    onCollision: props.onCollision,
    onTransformUpdate: props.onTransformUpdate,
  });

  // Scene lifecycle event handlers
  useViroEventListeners(nodeId, {
    onLoadStart: props.onSceneLoadStart,
    onLoadEnd: props.onSceneLoadEnd,
    onError: props.onSceneError,
  });

  // Provide the scene node ID as context for children
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
