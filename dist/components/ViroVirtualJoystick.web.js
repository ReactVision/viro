"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVirtualJoystick = void 0;
/**
 * ViroVirtualJoystick.web.tsx
 *
 * Web implementation of ViroVirtualJoystick — an on-screen analog stick rendered
 * as a DOM overlay. Pointer drags are clamped to `radius` and normalised to
 * [-1, 1], then written to the JS controller registry under `controllerId`
 * (read via `useVirtualController`). This is the web equivalent of the native
 * view that writes into VROVirtualControllerRegistry; the read-path there is
 * C++, here it's the registry hook.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viroVirtualController_1 = require("./Web/viroVirtualController");
const ViroVirtualJoystick = (props) => {
    const { controllerId, stickSide = "left", radius = 60, tintColor = "rgba(255, 255, 255, 0.6)", onStickChange, style, } = props;
    const ringRef = (0, react_1.useRef)(null);
    const activePointer = (0, react_1.useRef)(null);
    const [knob, setKnob] = (0, react_1.useState)({ x: 0, y: 0 });
    const tint = typeof tintColor === "string" ? tintColor : "rgba(255, 255, 255, 0.6)";
    const update = (clientX, clientY) => {
        const ring = ringRef.current;
        if (!ring)
            return;
        const rect = ring.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) {
            dx = (dx / dist) * radius;
            dy = (dy / dist) * radius;
        }
        setKnob({ x: dx, y: dy });
        // Normalise to [-1, 1]; invert Y so up is +1 (screen Y grows downward).
        const nx = dx / radius;
        const ny = -dy / radius;
        (0, viroVirtualController_1.setStick)(controllerId, stickSide, nx, ny);
        onStickChange?.({ nativeEvent: { x: nx, y: ny } });
    };
    const reset = () => {
        setKnob({ x: 0, y: 0 });
        (0, viroVirtualController_1.setStick)(controllerId, stickSide, 0, 0);
        onStickChange?.({ nativeEvent: { x: 0, y: 0 } });
    };
    const onPointerDown = (e) => {
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
    };
    const onPointerMove = (e) => {
        if (activePointer.current !== e.pointerId)
            return;
        update(e.clientX, e.clientY);
    };
    const onPointerEnd = (e) => {
        if (activePointer.current !== e.pointerId)
            return;
        activePointer.current = null;
        reset();
    };
    const size = radius * 2;
    const ringStyle = {
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${tint}`,
        touchAction: "none",
        userSelect: "none",
    };
    const knobStyle = {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: radius,
        height: radius,
        marginLeft: -radius / 2,
        marginTop: -radius / 2,
        borderRadius: "50%",
        background: tint,
        transform: `translate(${knob.x}px, ${knob.y}px)`,
        pointerEvents: "none",
    };
    return (<div style={style}>
      <div ref={ringRef} style={ringStyle} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
        <div style={knobStyle}/>
      </div>
    </div>);
};
exports.ViroVirtualJoystick = ViroVirtualJoystick;
exports.default = exports.ViroVirtualJoystick;
