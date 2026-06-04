/**
 * ViroGameLoopUtils — direct node manipulation that bypasses the React reconciler.
 *
 * Call these from inside useGameLoop / onUpdate callbacks for zero-setState
 * positional updates. The native NodeModule methods dispatch directly to the
 * render thread via the existing VRONode::setPositionAtomic() infrastructure.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import type React from "react";
export declare const ViroGameLoopUtils: {
    /**
     * Set the node's position without going through React state.
     * Equivalent to <ViroNode position={[x,y,z]} /> but synchronous
     * and reconciler-free — safe to call every frame.
     */
    setPosition(nodeRef: React.RefObject<any>, position: [number, number, number]): void;
    /**
     * Set Euler rotation (degrees) without going through React state.
     */
    setRotation(nodeRef: React.RefObject<any>, rotation: [number, number, number]): void;
    /**
     * Set uniform or non-uniform scale without going through React state.
     */
    setScale(nodeRef: React.RefObject<any>, scale: [number, number, number]): void;
};
