import * as React from "react";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useStudioRecording } from "./useStudioRecording";

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * REC pill for the RECORD_VIDEO toggle: a red dot + elapsed timer, shown only
 * while recording. Position-agnostic (it lays out no absolute position of its
 * own) so the embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `recordingIndicator`
 * prop). Hosts with their own top-of-screen chrome can set that prop to false
 * and render this where it fits, or build a custom UI from useStudioRecording().
 * As a RN view over the AR surface it is NOT captured into the recording.
 */
export function StudioRecordingIndicator() {
  const { isRecording, startedAt } = useStudioRecording();
  const [elapsed, setElapsed] = useState("0:00");

  useEffect(() => {
    if (!isRecording) return;
    const start = startedAt ?? Date.now();
    const tick = () => setElapsed(formatElapsed(Date.now() - start));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRecording, startedAt]);

  if (!isRecording) return null;

  return (
    <View style={styles.pill} pointerEvents="none">
      <View style={styles.dot} />
      <Text style={styles.label}>REC {elapsed}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
    marginRight: 8,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
