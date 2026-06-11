/**
 * ViroGameLoopUtils — direct node manipulation that bypasses the React reconciler.
 *
 * Call these from inside useGameLoop / onUpdate callbacks for zero-setState
 * positional updates. The native NodeModule methods dispatch directly to the
 * render thread via the existing VRONode::setPositionAtomic() infrastructure.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */

import { findNodeHandle, UIManager } from "react-native";
import type React from "react";

export const ViroGameLoopUtils = {
  /**
   * Set the node's position without going through React state.
   * Equivalent to <ViroNode position={[x,y,z]} /> but synchronous
   * and reconciler-free — safe to call every frame.
   */
  setPosition(
    nodeRef: React.RefObject<any>,
    position: [number, number, number]
  ): void {
    const handle = findNodeHandle(nodeRef.current);
    if (handle == null) return;
    UIManager.dispatchViewManagerCommand(handle, "setPosition", position);
  },

  /**
   * Set Euler rotation (degrees) without going through React state.
   */
  setRotation(
    nodeRef: React.RefObject<any>,
    rotation: [number, number, number]
  ): void {
    const handle = findNodeHandle(nodeRef.current);
    if (handle == null) return;
    UIManager.dispatchViewManagerCommand(handle, "setRotationEuler", rotation);
  },

  /**
   * Set uniform or non-uniform scale without going through React state.
   */
  setScale(
    nodeRef: React.RefObject<any>,
    scale: [number, number, number]
  ): void {
    const handle = findNodeHandle(nodeRef.current);
    if (handle == null) return;
    UIManager.dispatchViewManagerCommand(handle, "setScale", scale);
  },
};
