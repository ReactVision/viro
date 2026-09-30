/**
 * On-screen log + status for the interactive harness. A phone has no devtools
 * within reach, so every mode writes what a device test needs to read (load
 * times, HTTP status, tracking state, tap counters) here as well as to the
 * console.
 *
 *   hlog(tag, ...args)   one line in the log panel (last MAX_LINES kept)
 *   setStatus(key, val)  a live key/value row in the status panel
 */
import * as React from "react";
import { useEffect, useState } from "react";

const MAX_LINES = 20;

type Line = { t: string; tag: string; text: string; level: "info" | "error" };

let lines: Line[] = [];
let status: Record<string, string> = {};
const listeners = new Set<() => void>();
const t0 = performance.now();

function emit() {
  for (const l of listeners) l();
}

function fmt(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function push(level: Line["level"], tag: string, args: unknown[]) {
  const t = ((performance.now() - t0) / 1000).toFixed(1);
  const text = args.map(fmt).join(" ");
  lines = [...lines, { t, tag, text, level }].slice(-MAX_LINES);
  (level === "error" ? console.error : console.log)(`[harness ${tag}]`, ...args);
  emit();
}

export function hlog(tag: string, ...args: unknown[]) {
  push("info", tag, args);
}

export function herr(tag: string, ...args: unknown[]) {
  push("error", tag, args);
}

export function setStatus(key: string, value: string | number | null) {
  if (value === null) {
    const { [key]: _, ...rest } = status;
    status = rest;
  } else {
    status = { ...status, [key]: String(value) };
  }
  emit();
}

export function clearStatus() {
  status = {};
  emit();
}

function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { lines, status };
}

// Errors nobody caught still belong on the phone screen.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => herr("window", e.message));
  window.addEventListener("unhandledrejection", (e) => herr("promise", e.reason));
}

const panelBase: React.CSSProperties = {
  position: "fixed",
  left: 8,
  right: 8,
  zIndex: 1000,
  background: "rgba(0,0,0,0.72)",
  color: "#e8e8e8",
  font: "500 11px/1.35 ui-monospace, Menlo, monospace",
  borderRadius: 8,
  padding: "6px 8px",
  pointerEvents: "none",
  wordBreak: "break-word",
};

const smallBtn: React.CSSProperties = {
  pointerEvents: "auto",
  border: "none",
  borderRadius: 6,
  padding: "4px 8px",
  background: "#333",
  color: "#fff",
  font: "600 11px system-ui, sans-serif",
};

/** Status (top-left, under the mode button) and log (bottom) panels. */
export function HarnessPanels() {
  const { lines, status } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const entries = Object.entries(status);
  return (
    <>
      {entries.length > 0 && (
        <div data-testid="harness-status" style={{ ...panelBase, top: 52, right: "auto", maxWidth: "70%" }}>
          {entries.map(([k, v]) => (
            <div key={k}>
              <span style={{ color: "#8fd3ff" }}>{k}</span> {v}
            </div>
          ))}
        </div>
      )}
      <div
        data-testid="harness-log"
        style={{ ...panelBase, bottom: 8, maxHeight: collapsed ? undefined : "38%", overflow: "hidden" }}
      >
        <div style={{ display: "flex", gap: 6, marginBottom: collapsed ? 0 : 4 }}>
          <button style={smallBtn} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? `log (${lines.length}) ▲` : "log ▼"}
          </button>
          {!collapsed && (
            <button
              style={smallBtn}
              onClick={() => {
                lines = [];
                emit();
              }}
            >
              clear
            </button>
          )}
        </div>
        {!collapsed &&
          lines.map((l, i) => (
            <div key={i} style={{ color: l.level === "error" ? "#ff8a80" : undefined }}>
              <span style={{ opacity: 0.6 }}>{l.t}s</span> <span style={{ color: "#ffd54f" }}>{l.tag}</span>{" "}
              {l.text}
            </div>
          ))}
      </div>
    </>
  );
}
