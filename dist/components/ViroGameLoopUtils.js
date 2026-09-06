"use strict";
/**
 * ViroGameLoopUtils — direct node manipulation that bypasses the React reconciler.
 *
 * Call these from inside useGameLoop / onUpdate callbacks for zero-setState
 * positional updates. Each dispatches a view-manager command that writes to the
 * VRONode through the same setter the corresponding prop uses — no setState, no
 * diffing, no re-render.
 *
 * The commands are declared on the shared base of every node manager:
 * ViroViewManager on iOS, VRTNodeManager on Android. They must stay in step with
 * the names below — a command a manager does not declare is a runtime error, not
 * a silent no-op.
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
