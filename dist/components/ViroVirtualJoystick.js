"use strict";
/**
 * ViroVirtualJoystick.tsx
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 */
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
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const NativeVirtualJoystick = (0, react_native_1.requireNativeComponent)("VRTVirtualJoystickView");
const ViroVirtualJoystick = (props) => {
    const { tintColor, onStickChange, ...rest } = props;
    const processedTint = tintColor != null ? (0, react_native_1.processColor)(tintColor) : undefined;
    // Native sends x/y as strings to avoid Fabric conversions.h type-check spam.
    const handleStickChange = onStickChange
        ? (e) => onStickChange({
            nativeEvent: { x: parseFloat(e.nativeEvent.x), y: parseFloat(e.nativeEvent.y) }
        })
        : undefined;
    return (<NativeVirtualJoystick {...rest} tintColor={processedTint} onStickChange={handleStickChange}/>);
};
exports.ViroVirtualJoystick = ViroVirtualJoystick;
if (react_native_1.Platform.OS === "web") {
    // No-op on web; the joystick is a native-only view today.
    // Tracked as a follow-up: HTML/Canvas equivalent for the wasm path.
}
exports.default = exports.ViroVirtualJoystick;
