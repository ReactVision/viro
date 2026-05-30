/**
 * visionOS-aware BlurView shim.
 * On visionOS, renders a semi-transparent View instead of the native blur effect
 * (expo-blur is not linked in visionOS builds).
 * On all other platforms, delegates to expo-blur unchanged.
 *
 * Drop-in replacement — import from @/components/compat/BlurView instead of expo-blur.
 */
import { BlurViewProps } from "expo-blur";
export declare function BlurView({ style, tint, children, ...rest }: BlurViewProps): import("react").JSX.Element;
