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
exports.ViroVirtualButton = void 0;
/**
 * ViroVirtualButton.web.tsx
 *
 * Web implementation of ViroVirtualButton — an on-screen circular button
 * rendered as a DOM overlay. Press/release write into the JS controller
 * registry under `controllerId` (read via `useVirtualController`), the web
 * equivalent of the native view's VROVirtualControllerRegistry write.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const React = __importStar(require("react"));
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
    return (<div style={style}>
      <div style={circleStyle} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>
        {button}
      </div>
    </div>);
};
exports.ViroVirtualButton = ViroVirtualButton;
exports.default = exports.ViroVirtualButton;
