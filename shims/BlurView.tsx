/**
 * visionOS-aware BlurView shim.
 * On visionOS, renders a semi-transparent View instead of the native blur effect
 * (expo-blur is not linked in visionOS builds).
 * On all other platforms, delegates to expo-blur unchanged.
 *
 * Drop-in replacement — import from @/components/compat/BlurView instead of expo-blur.
 */
import { BlurView as ExpoBlurView, BlurViewProps } from "expo-blur";
import { Platform, View } from "react-native";

const isVisionOS =
  Platform.OS === "ios" &&
  (Platform.constants as { systemName?: string }).systemName === "visionOS";

const TINT_COLORS: Record<string, string> = {
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

export function BlurView({
  style,
  tint = "default",
  children,
  ...rest
}: BlurViewProps) {
  if (isVisionOS) {
    return (
      <View
        style={[
          { backgroundColor: TINT_COLORS[tint] ?? TINT_COLORS.default },
          style,
        ]}
        {...(rest as any)}
      >
        {children}
      </View>
    );
  }
  return (
    <ExpoBlurView tint={tint} style={style} {...rest}>
      {children}
    </ExpoBlurView>
  );
}
