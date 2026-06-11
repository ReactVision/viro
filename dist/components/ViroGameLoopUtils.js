"use strict";
/**
 * ViroGameLoopUtils — direct node manipulation that bypasses the React reconciler.
 *
 * Call these from inside useGameLoop / onUpdate callbacks for zero-setState
 * positional updates. The native NodeModule methods dispatch directly to the
 * render thread via the existing VRONode::setPositionAtomic() infrastructure.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroGameLoopUtils = void 0;
const react_native_1 = require("react-native");
exports.ViroGameLoopUtils = {
    /**
     * Set the node's position without going through React state.
     * Equivalent to <ViroNode position={[x,y,z]} /> but synchronous
     * and reconciler-free — safe to call every frame.
     */
    setPosition(nodeRef, position) {
        const handle = (0, react_native_1.findNodeHandle)(nodeRef.current);
        if (handle == null)
            return;
        react_native_1.UIManager.dispatchViewManagerCommand(handle, "setPosition", position);
    },
    /**
     * Set Euler rotation (degrees) without going through React state.
     */
    setRotation(nodeRef, rotation) {
        const handle = (0, react_native_1.findNodeHandle)(nodeRef.current);
        if (handle == null)
            return;
        react_native_1.UIManager.dispatchViewManagerCommand(handle, "setRotationEuler", rotation);
    },
    /**
     * Set uniform or non-uniform scale without going through React state.
     */
    setScale(nodeRef, scale) {
        const handle = (0, react_native_1.findNodeHandle)(nodeRef.current);
        if (handle == null)
            return;
        react_native_1.UIManager.dispatchViewManagerCommand(handle, "setScale", scale);
    },
};
