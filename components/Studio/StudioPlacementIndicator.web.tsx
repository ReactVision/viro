/**
 * Web host for StudioPlacementIndicator. Same component, same hook, same
 * behaviour — DOM instead of react-native primitives.
 *
 * Why not just let react-native-web handle it: `react-native-web` is an
 * *optional* peer dependency of this package, and no other `.web.tsx` in the
 * tree imports from "react-native". A web build without it installed would fail
 * to resolve the import rather than degrade, and a Studio scene previewed on
 * web would take the whole navigator down with it. Plain DOM has no such
 * dependency and the styles here are a direct transcription of the native
 * StyleSheet, so the two look the same.
 *
 * The logic lives in useStudioPlacement(), which is React and a store and is
 * already platform-agnostic — so nothing about *when* this appears is
 * duplicated here.
 */
import * as React from "react";
import { useStudioPlacement } from "./useStudioPlacement";

const pill: React.CSSProperties = {
  backgroundColor: "rgba(0,0,0,0.7)",
  borderRadius: 8,
  padding: "10px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  maxWidth: "100%",
  pointerEvents: "none",
  // The native pill inherits the app's font; on web there is nothing to
  // inherit inside a canvas host, so it is named rather than left to the UA.
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const text: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: 600,
  textAlign: "center",
};

const hint: React.CSSProperties = {
  color: "#FFD27F",
  fontSize: 13,
  marginTop: 4,
  textAlign: "center",
};

export function StudioPlacementIndicator() {
  const { isPlacing, name, showMiss } = useStudioPlacement();

  if (!isPlacing) return null;

  return (
    <div style={pill}>
      <span style={text}>
        {`Tap a surface to place${name ? `: ${name}` : ""}`}
      </span>
      {showMiss && (
        <span style={hint}>Move your device to scan a surface, then tap.</span>
      )}
    </div>
  );
}
