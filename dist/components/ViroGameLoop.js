"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroGameLoop = ViroGameLoop;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const VRTGameLoopView = (0, react_native_1.requireNativeComponent)("VRTGameLoopView");
// ── Component ─────────────────────────────────────────────────────────────────
function ViroGameLoop({ onUpdate, onLateUpdate, onFixedUpdate, fixedHz, }) {
    // Native sends dt/elapsed as strings to avoid Fabric conversions.h type-check spam.
    const parse = (e) => ({
        dt: parseFloat(e.nativeEvent.dt),
        elapsed: parseFloat(e.nativeEvent.elapsed ?? "0"),
    });
    const parseFixed = (e) => ({ dt: parseFloat(e.nativeEvent.dt) });
    return ((0, jsx_runtime_1.jsx)(VRTGameLoopView, { onUpdate: onUpdate ? (e) => onUpdate(parse(e)) : undefined, onLateUpdate: onLateUpdate ? (e) => onLateUpdate(parse(e)) : undefined, onFixedUpdate: onFixedUpdate ? (e) => onFixedUpdate(parseFixed(e)) : undefined, fixedHz: fixedHz }));
}
