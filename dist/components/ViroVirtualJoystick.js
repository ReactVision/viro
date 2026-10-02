"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVirtualJoystick = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
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
    return ((0, jsx_runtime_1.jsx)(NativeVirtualJoystick, { ...rest, tintColor: processedTint, onStickChange: handleStickChange }));
};
exports.ViroVirtualJoystick = ViroVirtualJoystick;
if (react_native_1.Platform.OS === "web") {
    // No-op on web; the joystick is a native-only view today.
    // Tracked as a follow-up: HTML/Canvas equivalent for the wasm path.
}
exports.default = exports.ViroVirtualJoystick;
