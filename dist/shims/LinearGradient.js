"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearGradient = LinearGradient;
/**
 * visionOS-aware LinearGradient shim.
 * On visionOS, renders a solid View using the first gradient color
 * (expo-linear-gradient is not linked in visionOS builds).
 * On all other platforms, delegates to expo-linear-gradient unchanged.
 *
 * Drop-in replacement — import from @/components/compat/LinearGradient instead of expo-linear-gradient.
 */
const expo_linear_gradient_1 = require("expo-linear-gradient");
const react_native_1 = require("react-native");
const isVisionOS = react_native_1.Platform.OS === "ios" &&
    react_native_1.Platform.constants.systemName === "visionOS";
function LinearGradient({ colors, style, children, ...rest }) {
    if (isVisionOS) {
        return (<react_native_1.View style={[{ backgroundColor: colors[0] }, style]} {...rest}>
        {children}
      </react_native_1.View>);
    }
    return (<expo_linear_gradient_1.LinearGradient colors={colors} style={style} {...rest}>
      {children}
    </expo_linear_gradient_1.LinearGradient>);
}
