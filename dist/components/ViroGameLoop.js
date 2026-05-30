"use strict";
/**
 * ViroGameLoop.tsx — headless component that fires per-frame JS callbacks.
 *
 * Mount anywhere inside a ViroARScene or ViroScene to start the loop.
 * The loop automatically stops when the component unmounts.
 *
 * Usage:
 *   <ViroGameLoop onUpdate={(dt, elapsed) => { ... }} />
 *   <ViroGameLoop fixedHz={30} onFixedUpdate={(dt) => { ... }} />
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroGameLoop = ViroGameLoop;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const VRTGameLoopView = (0, react_native_1.requireNativeComponent)("VRTGameLoopView");
// ── Component ─────────────────────────────────────────────────────────────────
function ViroGameLoop({ onUpdate, onLateUpdate, onFixedUpdate, fixedHz, }) {
    return (<VRTGameLoopView onUpdate={onUpdate ? (e) => onUpdate(e.nativeEvent) : undefined} onLateUpdate={onLateUpdate ? (e) => onLateUpdate(e.nativeEvent) : undefined} onFixedUpdate={onFixedUpdate ? (e) => onFixedUpdate(e.nativeEvent) : undefined} fixedHz={fixedHz} style={{ width: 0, height: 0 }}/>);
}
