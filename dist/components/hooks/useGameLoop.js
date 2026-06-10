"use strict";
/**
 * useGameLoop — convenience hook that wraps <ViroGameLoop />.
 *
 * NOTE: This hook does NOT imperatively mount a component. It is designed to
 * be used alongside a <ViroGameLoop> component in the scene. The component
 * fires the events; the hook subscribes to them via a shared ref pattern.
 *
 * For the most common case — one game loop per scene — use <ViroGameLoop>
 * directly with onUpdate/onFixedUpdate props. The hook is provided as
 * syntactic sugar for cases where the callback needs to live deep in the tree.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGameLoop = useGameLoop;
exports.useLateUpdate = useLateUpdate;
exports.useFixedUpdate = useFixedUpdate;
const react_1 = require("react");
/**
 * Subscribe to the variable-step update from the nearest <ViroGameLoop>.
 *
 * The callback is always current (uses a ref internally) so it is safe to
 * reference component state without adding it to a dependency array.
 */
function useGameLoop(callback, _options) {
    const cbRef = (0, react_1.useRef)(callback);
    (0, react_1.useEffect)(() => {
        cbRef.current = callback;
    });
    // Return a stable handler to pass to ViroGameLoop's onUpdate prop
    const handlerRef = (0, react_1.useRef)((event) => {
        cbRef.current(event);
    });
    return handlerRef.current;
}
/**
 * Subscribe to the late-update (post-physics) callback.
 */
function useLateUpdate(callback) {
    const cbRef = (0, react_1.useRef)(callback);
    (0, react_1.useEffect)(() => {
        cbRef.current = callback;
    });
    const handlerRef = (0, react_1.useRef)((event) => {
        cbRef.current(event);
    });
    return handlerRef.current;
}
/**
 * Subscribe to the fixed-step callback.
 * Requires a <ViroGameLoop fixedHz={N}> in the scene.
 */
function useFixedUpdate(callback) {
    const cbRef = (0, react_1.useRef)(callback);
    (0, react_1.useEffect)(() => {
        cbRef.current = callback;
    });
    const handlerRef = (0, react_1.useRef)((event) => {
        cbRef.current(event);
    });
    return handlerRef.current;
}
