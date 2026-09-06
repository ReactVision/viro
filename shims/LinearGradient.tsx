/**
 * visionOS-aware LinearGradient shim.
 * On visionOS, renders a solid View using the first gradient color
 * (expo-linear-gradient is not linked in visionOS builds).
 * On all other platforms, delegates to expo-linear-gradient unchanged.
 *
 * Drop-in replacement — import from @/components/compat/LinearGradient instead of expo-linear-gradient.
 */
import {
  LinearGradient as ExpoLinearGradient,
  LinearGradientProps,
} from "expo-linear-gradient";
import { Platform, View } from "react-native";

const isVisionOS =
  Platform.OS === "ios" &&
  (Platform.constants as { systemName?: string }).systemName === "visionOS";

export function LinearGradient({
  colors,
  style,
  children,
  ...rest
}: LinearGradientProps) {
  if (isVisionOS) {
    return (
      <View
        style={[{ backgroundColor: colors[0] as string }, style]}
        {...(rest as any)}
      >
        {children}
      </View>
    );
  }
  return (
    <ExpoLinearGradient colors={colors} style={style} {...rest}>
      {children}
    </ExpoLinearGradient>
  );
}
