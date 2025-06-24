/**
 * ViroUtils
 *
 * Common utility functions and hooks for Viro components.
 */

import React, { useEffect, useRef } from "react";
import { generateNodeId, ViroNodeProps, ViroNodeType } from "../NativeViro";

import { getNativeViro } from "./ViroGlobal";

// Create a proper React Context to pass parent node IDs down the component tree
export const ViroContext = React.createContext("viro_root_scene");

// Hook to get the current parent node ID
export const useViroParent = () => {
  return React.useContext(ViroContext);
};

// Hook to manage a node's lifecycle
export function useViroNode(
  nodeType: ViroNodeType,
  props: ViroNodeProps,
  explicitParentId?: string
): string {
  const nodeId = useRef<string>(generateNodeId());
  const contextParentId = useViroParent();

  // Use explicit parent ID if provided, otherwise use context
  const parentId = explicitParentId || contextParentId;

  useEffect(() => {
    // Create the node when the component mounts
    const nativeViro = getNativeViro();
    if (nativeViro) {
      nativeViro.createViroNode(nodeId.current, nodeType, props);

      // Add to parent if specified
      if (parentId) {
        nativeViro.addViroNodeChild(parentId, nodeId.current);
      }
    }

    // Clean up when the component unmounts
    return () => {
      const nativeViro = getNativeViro();
      if (nativeViro) {
        // Remove from parent if specified
        if (parentId) {
          nativeViro.removeViroNodeChild(parentId, nodeId.current);
        }

        // Delete the node
        nativeViro.deleteViroNode(nodeId.current);
      }
    };
  }, [nodeType, parentId]);

  // Update props when they change
  useEffect(() => {
    const nativeViro = getNativeViro();
    if (nativeViro) {
      nativeViro.updateViroNode(nodeId.current, props);
    }
  }, [props]);

  return nodeId.current;
}

// Hook to manage a node's children
export function useViroChildren(
  nodeId: string,
  children: React.ReactNode
): React.ReactNode {
  // Create a context provider to pass the parent ID to children
  return children;
}

// Common event handler types
export type ViroEventHandler = (event: any, ...args: any[]) => void;

// Common position and transform types
export type ViroPosition = [number, number, number];
export type ViroRotation = [number, number, number];
export type ViroScale = [number, number, number] | number;

// Common prop types shared across components
export interface ViroCommonProps {
  position?: ViroPosition;
  rotation?: ViroRotation;
  scale?: ViroScale;
  transformBehaviors?: string[];
  opacity?: number;
  visible?: boolean;
  animation?: {
    name?: string;
    delay?: number;
    loop?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
    run?: boolean;
    interruptible?: boolean;
  };

  // Event handlers
  onHover?: ViroEventHandler;
  onClick?: ViroEventHandler;
  onClickState?: ViroEventHandler;
  onTouch?: ViroEventHandler;
  onScroll?: ViroEventHandler;
  onSwipe?: ViroEventHandler;
  onDrag?: ViroEventHandler;
  onPinch?: ViroEventHandler;
  onRotate?: ViroEventHandler;
  onFuse?:
    | ViroEventHandler
    | { callback: ViroEventHandler; timeToFuse?: number };
  onCollision?: ViroEventHandler;
  onTransformUpdate?: ViroEventHandler;
}

// Helper to convert common props to the format expected by the native code
export function convertCommonProps(props: ViroCommonProps): ViroNodeProps {
  const {
    position,
    rotation,
    scale,
    transformBehaviors,
    opacity,
    visible,
    animation,
    ...rest
  } = props;

  const convertedProps: ViroNodeProps = {
    ...rest,
  };

  if (position) convertedProps.position = position;
  if (rotation) convertedProps.rotation = rotation;

  if (scale !== undefined) {
    if (typeof scale === "number") {
      convertedProps.scale = [scale, scale, scale];
    } else {
      convertedProps.scale = scale;
    }
  }

  if (transformBehaviors)
    convertedProps.transformBehaviors = transformBehaviors;
  if (opacity !== undefined) convertedProps.opacity = opacity;
  if (visible !== undefined) convertedProps.visible = visible;
  if (animation) convertedProps.animation = animation;

  return convertedProps;
}

// Provider component for ViroContext
export const ViroContextProvider = ({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) => {
  return React.createElement(ViroContext.Provider, { value }, children);
};
