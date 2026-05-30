"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlurView = BlurView;
/**
 * visionOS-aware BlurView shim.
 * On visionOS, renders a semi-transparent View instead of the native blur effect
 * (expo-blur is not linked in visionOS builds).
 * On all other platforms, delegates to expo-blur unchanged.
 *
 * Drop-in replacement — import from @/components/compat/BlurView instead of expo-blur.
 */
const expo_blur_1 = require("expo-blur");
const react_native_1 = require("react-native");
const isVisionOS = react_native_1.Platform.OS === "ios" &&
    react_native_1.Platform.constants.systemName === "visionOS";
const TINT_COLORS = {
    dark: "rgba(0,0,0,0.65)",
    light: "rgba(255,255,255,0.25)",
    default: "rgba(30,30,30,0.55)",
    extraLight: "rgba(255,255,255,0.45)",
    prominent: "rgba(0,0,0,0.75)",
    regular: "rgba(30,30,30,0.55)",
    systemUltraThinMaterial: "rgba(255,255,255,0.12)",
    systemThinMaterial: "rgba(255,255,255,0.18)",
    systemMaterial: "rgba(255,255,255,0.28)",
    systemThickMaterial: "rgba(255,255,255,0.38)",
    systemChromeMaterial: "rgba(255,255,255,0.22)",
};
function BlurView({ style, tint = "default", children, ...rest }) {
    if (isVisionOS) {
        return (<react_native_1.View style={[
                { backgroundColor: TINT_COLORS[tint] ?? TINT_COLORS.default },
                style,
            ]} {...rest}>
        {children}
      </react_native_1.View>);
    }
    return (<expo_blur_1.BlurView tint={tint} style={style} {...rest}>
      {children}
    </expo_blur_1.BlurView>);
}
