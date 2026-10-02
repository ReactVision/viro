"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVirtualButton = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const NativeVirtualButton = (0, react_native_1.requireNativeComponent)("VRTVirtualButtonView");
const ViroVirtualButton = (props) => {
    const { tintColor, ...rest } = props;
    const processedTint = tintColor != null ? (0, react_native_1.processColor)(tintColor) : undefined;
    return ((0, jsx_runtime_1.jsx)(NativeVirtualButton, { ...rest, tintColor: processedTint }));
};
exports.ViroVirtualButton = ViroVirtualButton;
exports.default = exports.ViroVirtualButton;
