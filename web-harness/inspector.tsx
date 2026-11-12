/**
 * The preview page's scene inspector: the Viro nodes the scene made, where
 * each one is written, a marker over the one selected, and what the GPU drew
 * in the last frame. Selecting a node tells the developer's assistant which
 * one they mean, through the host that runs the page.
 */
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { ViroHandle, ViroSceneApi, ViroWebRenderer } from "@reactvision/viro-web-renderer";

import { useViroRenderer } from "../components/Web/ViroWebContext";
import { viroNodeEntries } from "../components/Web/useViroNode";
import { cameraView, type CameraView } from "../components/Web/viroDrag";
import { VIRO_SOURCE_PROP, type ViroSource } from "./sceneModule";

export type TriangleBudget = { label: string; max_triangles: number };

// ─── What the GPU draws ───────────────────────────────────────────────────
// The renderer reports no statistics, so its WebGL draw calls are counted.
const counting = { draws: 0, triangles: 0 };
let lastFrame: { draws: number; triangles: number } | null = null;

const trianglesOf = (mode: number, count: number) =>
  // TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN
  mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;

export function countDrawCalls(): void {
  if (typeof WebGL2RenderingContext === "undefined") return;
  const gl = WebGL2RenderingContext.prototype as unknown as Record<string, (...a: number[]) => unknown>;
  // Method name, then the positions of its count and instance-count arguments.
  const draws: Array<[string, number, number?]> = [
    ["drawArrays", 2],
    ["drawElements", 1],
    ["drawArraysInstanced", 2, 3],
    ["drawElementsInstanced", 1, 4],
    ["drawRangeElements", 3],
  ];
  for (const [name, countAt, instancesAt] of draws) {
    const original = gl[name];
    if (typeof original !== "function") continue;
    gl[name] = function (this: unknown, ...a: number[]) {
      counting.draws++;
      counting.triangles += trianglesOf(a[0]!, a[countAt]!) * (instancesAt === undefined ? 1 : a[instancesAt]!);
      return original.apply(this, a);
    };
  }
}

// One renderer frame's worth: what was drawn since the last animation frame.
function sampleFrame() {
  if (counting.draws) lastFrame = { ...counting };
  counting.draws = counting.triangles = 0;
}

// ─── Model triangles ──────────────────────────────────────────────────────
const modelTriangles = new Map<string, number | null>();

/** Triangles in a glTF or GLB, counted as reactviro_check_performance_budget counts them: each mesh's TRIANGLES primitives once. */
function gltfTriangles(buf: ArrayBuffer): number | null {
  let doc: { meshes?: Array<{ primitives?: Array<{ mode?: number; indices?: number; attributes?: { POSITION?: number } }> }>; accessors?: Array<{ count?: number }> };
  try {
    const view = new DataView(buf);
    if (buf.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67) {
      if (view.getUint32(16, true) !== 0x4e4f534a) return null;
      doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, view.getUint32(12, true))));
    } else {
      doc = JSON.parse(new TextDecoder().decode(buf));
    }
  } catch {
    return null;
  }
  let n = 0;
  for (const mesh of doc.meshes ?? []) {
    for (const p of mesh.primitives ?? []) {
      if ((p.mode ?? 4) !== 4) continue;
      n += Math.floor((doc.accessors?.[p.indices ?? p.attributes?.POSITION ?? -1]?.count ?? 0) / 3);
    }
  }
  return n;
}

/** Counts a loaded model's triangles from the response the scene fetched it with. */
export function noteModelResponse(url: string, res: Response): void {
  if (!res.ok || !/\.(glb|gltf)$/i.test(url.split(/[?#]/)[0]!)) return;
  res
    .clone()
    .arrayBuffer()
    .then((buf) => modelTriangles.set(url, gltfTriangles(buf)))
    .catch(() => {});
}

// ─── The scene being inspected ────────────────────────────────────────────
let inspected: ViroWebRenderer | null = null;

/** Rendered inside a scene, so the inspector can reach its renderer. */
export function InspectorProbe() {
  const renderer = useViroRenderer();
  useEffect(() => {
    inspected = renderer;
    return () => {
      if (inspected === renderer) inspected = null;
    };
  }, [renderer]);
  return null;
}

type Row = { handle: ViroHandle; source: ViroSource; depth: number; detail: string; triangles?: number | null };

const basename = (uri: string) => decodeURIComponent(uri.split(/[?#]/)[0]!.split("/").pop() ?? uri);
const sourceKey = (s: ViroSource) => `${s.name}@${s.file}:${s.line}`;
const fmt = (n: number) => n.toLocaleString("en-US");

function rowsOf(scene: ViroSceneApi): Row[] {
  const entries = viroNodeEntries(scene);
  const stampOf = (props: object) => (props as Record<string, unknown>)[VIRO_SOURCE_PROP] as ViroSource | undefined;
  const stamped = [...entries.values()].some((e) => stampOf(e.props()));
  // A preview compiled before sources were stamped still lists its nodes, unnamed.
  const sourceOf = (h: ViroHandle): ViroSource | null => {
    const e = entries.get(h);
    if (!e) return null;
    return stampOf(e.props()) ?? (stamped ? null : { name: "Node", file: "", line: 0 });
  };
  const children = new Map<ViroHandle, ViroHandle[]>();
  for (const [h, e] of entries) {
    if (!sourceOf(h)) continue;
    // Under the nearest listed ancestor; the scene's own wrappers are not listed.
    let p = e.parent;
    while (entries.has(p) && !sourceOf(p)) p = entries.get(p)!.parent;
    const at = entries.has(p) ? p : 0;
    children.set(at, [...(children.get(at) ?? []), h]);
  }
  const rows: Row[] = [];
  const walk = (parent: ViroHandle, depth: number) => {
    const kids = (children.get(parent) ?? []).sort((a, b) => {
      const sa = sourceOf(a)!, sb = sourceOf(b)!;
      return sa.file.localeCompare(sb.file) || sa.line - sb.line || a - b;
    });
    for (const h of kids) {
      const props = entries.get(h)!.props() as Record<string, unknown>;
      const source = sourceOf(h)!;
      let detail = "";
      let triangles: number | null | undefined;
      if (typeof props.text === "string") detail = `"${props.text.length > 28 ? `${props.text.slice(0, 27)}...` : props.text}"`;
      const uri = typeof props.source === "string" ? props.source : (props.source as { uri?: unknown } | undefined)?.uri;
      if (typeof uri === "string" && !uri.startsWith("data:")) detail = basename(uri);
      if (source.name === "Viro3DObject" && typeof uri === "string") triangles = modelTriangles.get(uri);
      rows.push({ handle: h, source, depth, detail, triangles });
      walk(h, depth + 1);
    }
  };
  walk(0, 0);
  return rows;
}

function project(view: CameraView, p: [number, number, number]): { x: number; y: number } | null {
  // World to camera: the inverse of the orientation rayAt turns a pointer ray by.
  const [qx, qy, qz, qw] = view.orientation;
  const d = [p[0] - view.position[0], p[1] - view.position[1], p[2] - view.position[2]];
  const x = -qx, y = -qy, z = -qz;
  const tx = 2 * (y * d[2]! - z * d[1]!);
  const ty = 2 * (z * d[0]! - x * d[2]!);
  const tz = 2 * (x * d[1]! - y * d[0]!);
  const v = [d[0]! + qw * tx + (y * tz - z * ty), d[1]! + qw * ty + (z * tx - x * tz), d[2]! + qw * tz + (x * ty - y * tx)];
  if (v[2]! > -0.01) return null;
  const rect = view.element.getBoundingClientRect();
  return { x: rect.left + view.cx + (view.fx * v[0]!) / -v[2]!, y: rect.top + view.cy - (view.fy * v[1]!) / -v[2]! };
}

/** The sentence the assistant gets for a selected node. */
function selectionText(row: Row, at: [number, number, number] | null, budgets: TriangleBudget[], scene: string | undefined): string {
  const where = row.source.file ? ` at ${row.source.file}:${row.source.line}` : "";
  const facts = [
    row.detail ? `showing ${row.detail}` : "",
    at ? `world position [${at.map((n) => n.toFixed(2)).join(", ")}]` : "",
    row.triangles != null ? `${fmt(row.triangles)} triangles${overBudget(row.triangles, budgets)}` : "",
  ].filter(Boolean);
  return (
    `In the Viro Live preview${scene ? ` of ${scene}` : ""}, the developer selected <${row.source.name}>${where}` +
    `${facts.length ? ` (${facts.join(", ")})` : ""}. When they say "this" or "the selected node", they mean that element.`
  );
}

function overBudget(triangles: number, budgets: TriangleBudget[]): string {
  const over = budgets.filter((b) => triangles > b.max_triangles).map((b) => `${b.label} ${fmt(b.max_triangles)}`);
  return over.length ? `, over the single-model budget for ${over.join(", ")}` : "";
}

export function InspectPanel({
  budgets,
  scene,
  onSelection,
  styles,
  copy,
  onClose,
}: {
  budgets: TriangleBudget[];
  scene: string | undefined;
  /** Null when nothing is selected; undefined where no assistant is listening. */
  onSelection?: (text: string | null) => void;
  styles: { chip: React.CSSProperties; button: React.CSSProperties };
  copy(text: string): Promise<boolean>;
  onClose(): void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [frame, setFrame] = useState(lastFrame);
  const [selected, setSelected] = useState<{ handle: ViroHandle; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const marker = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // The node list is filled from effects as the scene mounts, so it is read again while the panel is open.
  useEffect(() => {
    const read = () => {
      const next = inspected ? rowsOf(inspected.scene) : [];
      setRows(next);
      setFrame(lastFrame);
      const sel = selectedRef.current;
      // An update remounts the scene with new handles: keep the same element selected if it is still there.
      if (sel && !next.some((r) => r.handle === sel.handle)) {
        const same = next.find((r) => sourceKey(r.source) === sel.key);
        setSelected(same ? { handle: same.handle, key: sel.key } : null);
      }
    };
    read();
    const timer = setInterval(read, 500);
    let raf = 0;
    const tick = () => {
      sampleFrame();
      const sel = selectedRef.current;
      const el = marker.current;
      const view = inspected && cameraView(inspected.scene);
      const at = sel && inspected ? inspected.scene.getNodeWorldPosition(sel.handle) : null;
      const pos = view && at ? project(view, at) : null;
      if (el) {
        el.style.display = pos ? "block" : "none";
        if (pos) {
          // Measured, not assumed: a view that runs this page puts its fixed elements in a transformed stage.
          el.style.transform = "none";
          const origin = el.getBoundingClientRect();
          el.style.transform = `translate(${pos.x - origin.left - 14}px, ${pos.y - origin.top - 14}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  const row = selected ? rows.find((r) => r.handle === selected.handle) : undefined;
  const text = row ? selectionText(row, inspected?.scene.getNodeWorldPosition(row.handle) ?? null, budgets, scene) : null;
  useEffect(() => {
    onSelection?.(text);
    setCopied(false);
  }, [text]);
  useEffect(() => () => onSelection?.(null), []);

  const { chip, button } = styles;
  const models = rows.filter((r) => r.triangles != null);
  return (
    <>
      <div
        ref={marker}
        aria-hidden="true"
        style={{ position: "fixed", left: 0, top: 0, width: 24, height: 24, borderRadius: "50%", border: "2px solid #4cc2ff", boxShadow: "0 0 0 2px rgba(0,0,0,0.5), 0 0 12px #4cc2ff", display: "none", pointerEvents: "none" }}
      />
      <div style={{ ...chip, pointerEvents: "auto", alignSelf: "center", width: "min(340px, 100%)", maxHeight: "70%", overflow: "auto", display: "flex", flexDirection: "column", gap: 8, boxSizing: "border-box", fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Scene</span>
          <button type="button" aria-label="Close" style={{ ...button, padding: "2px 8px" }} onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {frame ? `Last frame: ${fmt(frame.draws)} draw calls, ${fmt(frame.triangles)} triangles, including the grid and any shadow passes.` : "Waiting for a frame..."}
        </div>
        {rows.length === 0 ? <div style={{ opacity: 0.7 }}>No nodes yet.</div> : null}
        <div role="listbox" aria-label="Nodes" style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r) => {
            const on = r.handle === selected?.handle;
            return (
              <button
                key={r.handle}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => setSelected(on ? null : { handle: r.handle, key: sourceKey(r.source) })}
                title={r.source.file ? `${r.source.file}:${r.source.line}` : undefined}
                style={{ all: "unset", cursor: "pointer", padding: `3px 6px 3px ${6 + r.depth * 14}px`, borderRadius: 5, background: on ? "rgba(76,194,255,0.22)" : "transparent", display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}
              >
                <span style={{ fontWeight: 600, flex: "none" }}>{r.source.name}</span>
                <span style={{ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{r.detail}</span>
                {r.source.file ? <span style={{ opacity: 0.55, fontSize: 11, flex: "none" }}>{basename(r.source.file)}:{r.source.line}</span> : null}
              </button>
            );
          })}
        </div>
        {models.length ? (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            {models.map((m) => {
              const over = budgets.filter((b) => m.triangles! > b.max_triangles);
              return (
                <div key={m.handle} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.detail}</span>
                  <span style={{ flex: "none", color: over.length ? "#ffd27a" : "#9be7a7" }} title={budgets.map((b) => `${b.label}: ${fmt(b.max_triangles)}`).join("\n")}>
                    {fmt(m.triangles!)} triangles{over.length ? `, over ${over.map((b) => b.label.split(" (")[0]).join(", ")}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        {text && !onSelection ? (
          <button type="button" style={{ ...button, alignSelf: "flex-start" }} onClick={async () => setCopied(await copy(text))}>
            {copied ? "Copied" : "Copy reference for your assistant"}
          </button>
        ) : null}
        {text && onSelection ? <div style={{ fontSize: 12, opacity: 0.75 }}>Your assistant knows which node you selected.</div> : null}
        <div style={{ fontSize: 11, opacity: 0.6 }}>Lights and the parts inside a model are not listed.</div>
      </div>
    </>
  );
}
