/**
 * The web host's alert dialog, drawn over the canvas from questAlertStore.
 * DOM rather than react-native-web for the reason given in
 * StudioPlacementIndicator.web.tsx; as a DOM sibling of the canvas it is not in
 * a screenshot or a canvas recording, like the native dialog.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { questAlertStore } from "./domain/questAlertStore";

const backdrop: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 24px",
  backgroundColor: "rgba(0,0,0,0.4)",
  zIndex: 3,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const card: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  width: "100%",
  maxWidth: 320,
  maxHeight: "80%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
};

const body: React.CSSProperties = {
  padding: "20px 16px 16px",
  overflowY: "auto",
  textAlign: "center",
};

const titleStyle: React.CSSProperties = {
  color: "#000000",
  fontSize: 17,
  fontWeight: 600,
  margin: 0,
};

const messageStyle: React.CSSProperties = {
  color: "#000000",
  fontSize: 14,
  margin: "6px 0 0",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const button: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid rgba(60,60,67,0.29)",
  background: "none",
  padding: "12px 16px",
  color: "#007AFF",
  fontSize: 17,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

function useAlert() {
  const read = () => ({
    message: questAlertStore.message(),
    title: questAlertStore.title(),
    buttonLabel: questAlertStore.buttonLabel(),
  });
  const [alert, setAlert] = useState(read);
  useEffect(() => {
    // An alert shown between the first render and this subscription.
    setAlert(read());
    const unsubscribe = questAlertStore.subscribe(() => setAlert(read()));
    // Only when the navigator goes: a NAVIGATION remounts the scene, and an
    // alert shown just before it stays up, as a phone's dialog does.
    return () => {
      unsubscribe();
      questAlertStore.reset();
    };
  }, []);
  return alert;
}

export function StudioWebAlertOverlay() {
  const { message, title, buttonLabel } = useAlert();

  useEffect(() => {
    if (message === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") questAlertStore.dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [message]);

  if (message === null) return null;

  return (
    <div style={backdrop} role="presentation">
      <div style={card} role="alertdialog" aria-modal="true" aria-label={title ?? "Alert"}>
        <div style={body}>
          <p style={titleStyle}>{title ?? "Alert"}</p>
          {message !== "" && <p style={messageStyle}>{message}</p>}
        </div>
        <button type="button" style={button} onClick={() => questAlertStore.dismiss()}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
