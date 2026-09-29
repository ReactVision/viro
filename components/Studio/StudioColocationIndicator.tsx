import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isQuest } from "../Utilities/ViroPlatform";
import { studioColocationIndicatorContent } from "./colocation/indicatorContent";
import { studioColocationStore } from "./domain/colocationStore";
import { useStudioColocation } from "./useStudioColocation";

/**
 * Shared-space status pill: scan guidance with a Done button for the host,
 * progress while hosting or resolving, then the join code and how many other
 * devices are in the room. Position-agnostic (it lays out no absolute position
 * of its own) so the embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `colocationIndicator`
 * prop). Hosts with their own chrome can set that prop to false and render this
 * where it fits, or build a custom UI from useStudioColocation().
 */
const subscribe = (onChange: () => void) =>
  studioColocationStore.subscribe(onChange);
const getOriginPrompt = () => studioColocationStore.getOriginPrompt();
const noOriginPrompt = () => null;

export function StudioColocationIndicator() {
  const state = useStudioColocation();
  const originPrompt = React.useSyncExternalStore(
    subscribe,
    getOriginPrompt,
    noOriginPrompt
  );
  const content = studioColocationIndicatorContent(
    state,
    originPrompt,
    isQuest ? "headset" : "phone"
  );

  if (!content) return null;

  return (
    <View style={styles.pill} pointerEvents="box-none">
      <Text style={[styles.title, content.tone === "error" && styles.error]}>
        {content.title}
      </Text>
      {content.code && <Text style={styles.code}>{content.code}</Text>}
      {content.detail && <Text style={styles.detail}>{content.detail}</Text>}
      {content.done && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !content.done.enabled }}
          disabled={!content.done.enabled}
          onPress={() => studioColocationStore.finishScan()}
          style={[
            styles.button,
            !content.done.enabled && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.buttonLabel}>Done</Text>
        </Pressable>
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
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  error: {
    color: "#FF8A80",
  },
  code: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 4,
    marginTop: 4,
    textAlign: "center",
  },
  detail: {
    color: "#E0E0E0",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },
});
