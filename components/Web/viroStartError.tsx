import * as React from "react";

// Matched by name, not instanceof: renderers before the typed error reject
// with a bare RuntimeError, and those get the generic message.
export function webRendererStartMessage(err: unknown): string {
  const e = err as { name?: unknown; reason?: unknown } | null;
  if (e?.name === "ViroWebGLUnavailableError") {
    return e.reason === "context-lost"
      ? "The browser's graphics stopped before the scene could start. Reload the page to try again."
      : "This browser cannot show 3D content: WebGL2 is unavailable.";
  }
  return "Could not initialize the renderer.";
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  font: "500 16px system-ui, sans-serif",
  textAlign: "center",
  padding: 24,
};

export function ViroWebStartError({ message }: { message: string | null }) {
  return message ? <div style={overlayStyle}>{message}</div> : null;
}
