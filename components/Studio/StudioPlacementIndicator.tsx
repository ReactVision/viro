import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useStudioPlacement } from "./useStudioPlacement";

/**
 * Tap-to-place prompt pill, shown only while a mobile AR asset awaits placement.
 * Position-agnostic (it lays out no absolute position of its own) so the
 * embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `placementIndicator`
 * prop). Hosts with their own top-of-screen chrome can set that prop to false
 * and render this where it fits, or build a custom UI from useStudioPlacement().
 */
export function StudioPlacementIndicator() {
  const { isPlacing, name, showMiss } = useStudioPlacement();

  if (!isPlacing) return null;

  return (
    <View style={styles.pill} pointerEvents="none">
      <Text style={styles.text}>
        {`Tap a surface to place${name ? `: ${name}` : ""}`}
      </Text>
      {showMiss && (
        <Text style={styles.hint}>
          Move your device to scan a surface, then tap.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    maxWidth: "100%",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  hint: {
    color: "#FFD27F",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
});
