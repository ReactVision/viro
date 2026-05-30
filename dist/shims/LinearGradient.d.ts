/**
 * visionOS-aware LinearGradient shim.
 * On visionOS, renders a solid View using the first gradient color
 * (expo-linear-gradient is not linked in visionOS builds).
 * On all other platforms, delegates to expo-linear-gradient unchanged.
 *
 * Drop-in replacement — import from @/components/compat/LinearGradient instead of expo-linear-gradient.
 */
import { LinearGradientProps } from "expo-linear-gradient";
export declare function LinearGradient({ colors, style, children, ...rest }: LinearGradientProps): import("react").JSX.Element;
