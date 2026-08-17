/**
 * Web host for StudioRecordingIndicator. See the note in
 * StudioPlacementIndicator.web.tsx for why this is DOM rather than
 * react-native-web.
 *
 * One difference worth stating rather than leaving to be discovered: the native
 * comment says this pill is *not* captured into the recording, because there it
 * is a react-native view sitting over the AR surface. That still holds on web —
 * it is a DOM sibling of the canvas, and neither the WebGL capture nor a
 * canvas-based recorder sees it.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { useStudioRecording } from "./useStudioRecording";

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const pill: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "center",
  backgroundColor: "rgba(0,0,0,0.55)",
  borderRadius: 8,
  padding: "6px 12px",
  pointerEvents: "none",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const dot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: "#FF3B30",
  marginRight: 8,
  flexShrink: 0,
};

const label: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: 600,
};

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
    <div style={pill}>
      <div style={dot} />
      <span style={label}>REC {elapsed}</span>
    </div>
  );
}
