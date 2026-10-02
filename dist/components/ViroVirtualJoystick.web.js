"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVirtualJoystick = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
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
    return ((0, jsx_runtime_1.jsx)("div", { style: style, children: (0, jsx_runtime_1.jsx)("div", { ref: ringRef, style: ringStyle, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, children: (0, jsx_runtime_1.jsx)("div", { style: knobStyle }) }) }));
};
exports.ViroVirtualJoystick = ViroVirtualJoystick;
exports.default = exports.ViroVirtualJoystick;
