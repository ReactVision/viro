/**
 * Web host for StudioColocationIndicator: DOM instead of react-native, for the
 * reason in StudioPlacementIndicator.web.tsx. On web a `colocation` prop only
 * ever reports that the frame kind is unsupported, which this shows.
 */
import * as React from "react";
import { studioColocationIndicatorContent } from "./colocation/indicatorContent";
import { studioColocationStore } from "./domain/colocationStore";
import { useStudioColocation } from "./useStudioColocation";

const pill: React.CSSProperties = {
  backgroundColor: "rgba(0,0,0,0.7)",
  borderRadius: 8,
  padding: "10px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  maxWidth: "100%",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const title: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: 600,
  textAlign: "center",
};

const code: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: 4,
  marginTop: 4,
  textAlign: "center",
};

const detail: React.CSSProperties = {
  color: "#E0E0E0",
  fontSize: 13,
  marginTop: 4,
  textAlign: "center",
};

const button: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "none",
  borderRadius: 6,
  color: "#000000",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  marginTop: 8,
  padding: "6px 20px",
};

export function StudioColocationIndicator() {
  const state = useStudioColocation();
  const content = studioColocationIndicatorContent(state);

  if (!content) return null;

  return (
    <div style={pill}>
      <span
        style={
          content.tone === "error" ? { ...title, color: "#FF8A80" } : title
        }
      >
        {content.title}
      </span>
      {content.code && <span style={code}>{content.code}</span>}
      {content.detail && <span style={detail}>{content.detail}</span>}
      {content.done && (
        <button
          type="button"
          disabled={!content.done.enabled}
          onClick={() => studioColocationStore.finishScan()}
          style={
            content.done.enabled
              ? button
              : { ...button, opacity: 0.4, cursor: "default" }
          }
        >
          Done
        </button>
      )}
    </div>
  );
}
