/**
 * SF Symbols that still draw on visionOS.
 *
 * `expo-symbols` renders through a native view, and the Expo modules are not linked on visionOS —
 * that platform's Podfile installs React Native and Viro, nothing else — so `SymbolView` comes up
 * blank there and every icon in the app is an empty box. Material Icons needs no native module:
 * the glyph is text in a font, and a font listed in UIAppFonts is registered by the system before
 * any JS runs. `withViroVisionOS` puts the app's icon fonts in the visionOS bundle for exactly
 * this, so the fallback has something to draw with.
 *
 * The branch is at runtime rather than in the filename. A visionOS bundle is built with
 * `platform=ios`, so Metro resolves `.ios.tsx` there and a `.visionos.tsx` file is never picked;
 * `Platform.isVision` is what tells the two apart.
 */
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolView, SymbolViewProps, SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import {
  OpaqueColorValue,
  Platform,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

/**
 * SF Symbol names to their Material Icons counterpart. Add the ones your app draws: a name with no
 * entry reaches MaterialIcons as undefined and renders as nothing, which is the same blank box
 * this exists to avoid, so an unmapped name says so once instead.
 */
export const SF_TO_MATERIAL: Record<string, MaterialIconName> = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left": "chevron-left",
  "chevron.right": "chevron-right",
  "chevron.up": "expand-less",
  "chevron.down": "expand-more",
  "chevron.left.forwardslash.chevron.right": "code",
  "arrow.counterclockwise": "refresh",
  "arrow.clockwise": "refresh",
  "arrow.down.circle.fill": "arrow-circle-down",
  "arrow.up.circle.fill": "arrow-circle-up",
  "arrow.triangle.2.circlepath": "autorenew",
  "checkmark.circle.fill": "check-circle",
  "checkmark": "check",
  "xmark": "close",
  "xmark.circle.fill": "cancel",
  "cube.fill": "view-in-ar",
  "cube.transparent": "view-in-ar",
  "doc.on.doc": "content-copy",
  "exclamationmark.circle.fill": "error",
  "exclamationmark.triangle.fill": "warning",
  "info.circle.fill": "info",
  "photo.fill": "photo",
  "camera.fill": "photo-camera",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  "gearshape.fill": "settings",
  "trash.fill": "delete",
  "plus": "add",
  "minus": "remove",
};

const warnedNames = new Set<string>();

function materialNameFor(name: string): MaterialIconName | undefined {
  const mapped = SF_TO_MATERIAL[name];
  if (!mapped && !warnedNames.has(name)) {
    warnedNames.add(name);
    console.warn(
      `[Viro] No Material Icons equivalent for the SF Symbol "${name}", so it draws as nothing ` +
        `on visionOS. Add it to SF_TO_MATERIAL in components/compat/IconSymbol.`
    );
  }
  return mapped;
}

export type IconSymbolName = SymbolViewProps["name"];

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = "regular",
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle> | StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // `isVision` is this fork's addition and is not in the upstream Platform type.
  if ((Platform as unknown as { isVision?: boolean }).isVision === true) {
    return (
      <MaterialIcons
        color={color}
        size={size}
        name={materialNameFor(String(name)) as MaterialIconName}
        style={style as StyleProp<TextStyle>}
      />
    );
  }

  return (
    <SymbolView
      weight={weight}
      tintColor={color as string}
      resizeMode="scaleAspectFit"
      name={name}
      style={[{ width: size, height: size }, style as StyleProp<ViewStyle>]}
    />
  );
}

export default IconSymbol;
