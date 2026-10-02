"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVirtualButton = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const viroVirtualController_1 = require("./Web/viroVirtualController");
const ViroVirtualButton = (props) => {
    const { controllerId, button, size = 44, tintColor = "rgba(255, 255, 255, 0.6)", onPressIn, onPressOut, style, } = props;
    const [pressed, setPressed] = (0, react_1.useState)(false);
    const tint = typeof tintColor === "string" ? tintColor : "rgba(255, 255, 255, 0.6)";
    const press = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setPressed(true);
        (0, viroVirtualController_1.setButton)(controllerId, button, true);
        onPressIn?.({ nativeEvent: { button } });
    };
    const release = () => {
        if (!pressed)
            return;
        setPressed(false);
        (0, viroVirtualController_1.setButton)(controllerId, button, false);
        onPressOut?.({ nativeEvent: { button } });
    };
    const circleStyle = {
        width: size,
        height: size,
        borderRadius: "50%",
        background: tint,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#000",
        fontSize: size * 0.4,
        fontWeight: 600,
        userSelect: "none",
        touchAction: "none",
        opacity: pressed ? 0.9 : 0.6,
    };
    return ((0, jsx_runtime_1.jsx)("div", { style: style, children: (0, jsx_runtime_1.jsx)("div", { style: circleStyle, onPointerDown: press, onPointerUp: release, onPointerCancel: release, onPointerLeave: release, children: button }) }));
};
exports.ViroVirtualButton = ViroVirtualButton;
exports.default = exports.ViroVirtualButton;
