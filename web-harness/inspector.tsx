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
import { PLACEHOLDER_MODEL_URL } from "./placeholderAssets";
import { VIRO_SOURCE_PROP, type ViroSource } from "./sceneModule";

export type ModelBudget = { label: string; max_triangles: number; max_texture_bytes?: number; max_texture_dimension?: number };

type Vec3 = [number, number, number];

// ─── What the GPU draws ───────────────────────────────────────────────────
// The renderer reports no statistics, so its WebGL draw calls are counted.
const counting = { draws: 0, triangles: 0 };
let lastFrame: { draws: number; triangles: number } | null = null;

// Textures by context, sized from what the renderer allocates for each.
type TextureSize = { levels: Map<string, number>; mipmapped: boolean; dimension: number };
const contexts = new Map<WebGL2RenderingContext, Map<WebGLTexture, TextureSize>>();

// Bytes a pixel of a sized internal format; anything else is taken as RGBA8.
const PIXEL_BYTES: Record<number, number> = {
  0x1906: 1, 0x1909: 1, 0x8229: 1, // ALPHA, LUMINANCE, R8
  0x190a: 2, 0x822b: 2, 0x822d: 2, 0x81a5: 2, // LUMINANCE_ALPHA, RG8, R16F, DEPTH_COMPONENT16
  0x881a: 8, 0x881b: 8, 0x8230: 8, // RGBA16F, RGB16F, RG32F
  0x8814: 16, 0x8815: 16, // RGBA32F, RGB32F
};
// The binding a texture call's target writes to.
const BINDING: Record<number, number> = { 0x0de1: 0x8069, 0x8513: 0x8514, 0x806f: 0x806a, 0x8c1a: 0x8c1d };
const bindingOf = (target: number) => (target >= 0x8515 && target <= 0x851a ? 0x8514 : BINDING[target]);

function boundTexture(gl: WebGL2RenderingContext, target: number): TextureSize | null {
  const binding = bindingOf(target);
  const texture = binding === undefined ? null : (gl.getParameter(binding) as WebGLTexture | null);
  if (!texture) return null;
  let sizes = contexts.get(gl);
  if (!sizes) contexts.set(gl, (sizes = new Map()));
  let size = sizes.get(texture);
  if (!size) sizes.set(texture, (size = { levels: new Map(), mipmapped: false, dimension: 0 }));
  return size;
}

function noteLevel(gl: WebGL2RenderingContext, target: number, level: number | string, bytes: number, width: number, height: number): void {
  const size = boundTexture(gl, target);
  if (!size || !Number.isFinite(bytes)) return;
  size.levels.set(`${target}:${level}`, bytes);
  if (level === 0 || level === "all") size.dimension = Math.max(size.dimension, width, height);
}

/** Bytes of texture the live renderers hold, and the longest side among them. An estimate: drivers pad and align as they like. */
function textureMemory(): { bytes: number; dimension: number } {
  let bytes = 0;
  let dimension = 0;
  for (const [gl, sizes] of contexts) {
    const canvas = gl.canvas as HTMLCanvasElement;
    if (gl.isContextLost() || canvas.isConnected === false) {
      contexts.delete(gl);
      continue;
    }
    for (const size of sizes.values()) {
      let own = 0;
      for (const b of size.levels.values()) own += b;
      bytes += size.mipmapped ? (own * 4) / 3 : own;
      dimension = Math.max(dimension, size.dimension);
    }
  }
  return { bytes, dimension };
}

const trianglesOf = (mode: number, count: number) =>
  // TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN
  mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;

/** Counts the renderer's draw calls and sizes its textures. Call before the renderer makes its context. */
export function watchGpu(): void {
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

  // Runs after the call it follows, and never fails it.
  const after = (name: string, note: (gl: WebGL2RenderingContext, a: any[]) => void) => {
    const original = gl[name];
    if (typeof original !== "function") return;
    gl[name] = function (this: unknown, ...a: number[]) {
      const result = original.apply(this, a);
      try {
        note(this as WebGL2RenderingContext, a);
      } catch {
        // A size that cannot be read is left out of the estimate.
      }
      return result;
    };
  };
  const pixels = (format: number) => PIXEL_BYTES[format] ?? 4;
  after("texImage2D", (ctx, a) => {
    // (target, level, internalformat, width, height, border, ...) or (target, level, internalformat, format, type, source).
    const sized = a.length >= 8;
    const w = sized ? a[3] : a[5]?.videoWidth || a[5]?.naturalWidth || a[5]?.width || 0;
    const h = sized ? a[4] : a[5]?.videoHeight || a[5]?.naturalHeight || a[5]?.height || 0;
    noteLevel(ctx, a[0], a[1], w * h * pixels(a[2]), w, h);
  });
  after("texImage3D", (ctx, a) => noteLevel(ctx, a[0], a[1], a[3] * a[4] * a[5] * pixels(a[2]), a[3], a[4]));
  // Immutable storage holds its whole chain, about a third more than the first level.
  after("texStorage2D", (ctx, a) => noteLevel(ctx, a[0], "all", a[3] * a[4] * pixels(a[2]) * (a[1] > 1 ? 4 / 3 : 1), a[3], a[4]));
  after("texStorage3D", (ctx, a) => noteLevel(ctx, a[0], "all", a[3] * a[4] * a[5] * pixels(a[2]) * (a[1] > 1 ? 4 / 3 : 1), a[3], a[4]));
  after("compressedTexImage2D", (ctx, a) => noteLevel(ctx, a[0], a[1], typeof a[6] === "number" ? a[6] : a[6]?.byteLength ?? 0, a[3], a[4]));
  after("generateMipmap", (ctx, a) => {
    const size = boundTexture(ctx, a[0]);
    if (size) size.mipmapped = true;
  });
  after("deleteTexture", (ctx, a) => void contexts.get(ctx)?.delete(a[0]));
}

// One renderer frame's worth: what was drawn since the last animation frame. True when a frame was drawn.
function sampleFrame(): boolean {
  const drew = counting.draws > 0;
  if (drew) lastFrame = { ...counting };
  counting.draws = counting.triangles = 0;
  return drew;
}

// ─── Model sizes ──────────────────────────────────────────────────────────
/** `textureDimension` is 0 when no texture's size could be read. */
type ModelSize = { triangles: number; textureBytes: number; textureDimension: number };
const modelSizes = new Map<string, ModelSize | null>();

/**
 * A glTF or GLB measured as reactviro_check_performance_budget measures it: each
 * mesh's TRIANGLES primitives once, the bytes of its embedded images, and the
 * longest side among its PNGs (a JPEG's size is not read there either).
 */
function gltfSize(buf: ArrayBuffer): ModelSize | null {
  let doc: {
    meshes?: Array<{ primitives?: Array<{ mode?: number; indices?: number; attributes?: { POSITION?: number } }> }>;
    accessors?: Array<{ count?: number }>;
    images?: Array<{ mimeType?: string; bufferView?: number }>;
    bufferViews?: Array<{ byteOffset?: number; byteLength?: number }>;
  };
  let bin: DataView | null = null;
  try {
    const view = new DataView(buf);
    if (buf.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67) {
      if (view.getUint32(16, true) !== 0x4e4f534a) return null;
      const jsonLength = view.getUint32(12, true);
      doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLength)));
      const at = 20 + jsonLength;
      if (at + 8 <= buf.byteLength && view.getUint32(at + 4, true) === 0x004e4942) {
        bin = new DataView(buf, at + 8, Math.min(view.getUint32(at, true), buf.byteLength - at - 8));
      }
    } else {
      doc = JSON.parse(new TextDecoder().decode(buf));
    }
  } catch {
    return null;
  }
  let triangles = 0;
  for (const mesh of doc.meshes ?? []) {
    for (const p of mesh.primitives ?? []) {
      if ((p.mode ?? 4) !== 4) continue;
      triangles += Math.floor((doc.accessors?.[p.indices ?? p.attributes?.POSITION ?? -1]?.count ?? 0) / 3);
    }
  }
  let textureBytes = 0;
  let textureDimension = 0;
  for (const image of doc.images ?? []) {
    const view = doc.bufferViews?.[image.bufferView ?? -1];
    if (!view?.byteLength) continue;
    textureBytes += view.byteLength;
    const start = view.byteOffset ?? 0;
    // A PNG's width and height are at fixed offsets in its first chunk.
    if (bin && (image.mimeType ?? "").includes("png") && start + 24 <= bin.byteLength && bin.getUint32(start) === 0x89504e47) {
      textureDimension = Math.max(textureDimension, bin.getUint32(start + 16), bin.getUint32(start + 20));
    }
  }
  return { triangles, textureBytes, textureDimension };
}

/** Measures a loaded model from the response the scene fetched it with. */
export function noteModelResponse(url: string, res: Response): void {
  if (!res.ok || !/\.(glb|gltf)$/i.test(url.split(/[?#]/)[0]!)) return;
  res
    .clone()
    .arrayBuffer()
    .then((buf) => modelSizes.set(url, gltfSize(buf)))
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

type Row = { handle: ViroHandle; source: ViroSource; depth: number; detail: string; size?: ModelSize | null; scale: Vec3 };

const basename = (uri: string) => decodeURIComponent(uri.split(/[?#]/)[0]!.split("/").pop() ?? uri);
const sourceKey = (s: ViroSource) => `${s.name}@${s.file}:${s.line}`;
const fmt = (n: number) => n.toLocaleString("en-US");
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

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
      let size: ModelSize | null | undefined;
      if (typeof props.text === "string") detail = `"${props.text.length > 28 ? `${props.text.slice(0, 27)}...` : props.text}"`;
      const uri = typeof props.source === "string" ? props.source : (props.source as { uri?: unknown } | undefined)?.uri;
      if (typeof uri === "string" && !uri.startsWith("data:")) detail = uri === PLACEHOLDER_MODEL_URL ? "placeholder" : basename(uri);
      // The stand-in's size says nothing about the model it stands for.
      if (source.name === "Viro3DObject" && typeof uri === "string" && uri !== PLACEHOLDER_MODEL_URL) size = modelSizes.get(uri);
      const s = props.scale;
      const scale: Vec3 = Array.isArray(s) && s.length === 3 && s.every((n) => Number.isFinite(n)) ? [s[0], s[1], s[2]] : [1, 1, 1];
      rows.push({ handle: h, source, depth, detail, size, scale });
      walk(h, depth + 1);
    }
  };
  walk(0, 0);
  return rows;
}

/**
 * The centre of the nodes the scene's code made, and how far back a camera
 * frames them all from. Null before the scene has any.
 */
export function contentFraming(): { center: Vec3; distance: number } | null {
  const scene = inspected?.scene;
  if (!scene) return null;
  const rows = rowsOf(scene);
  // Leaves only: a container's own origin says nothing about where its content is.
  const leaves = rows.filter((r, i) => (rows[i + 1]?.depth ?? 0) <= r.depth);
  const points = leaves.map((r) => scene.getNodeWorldPosition(r.handle)).filter((p): p is Vec3 => !!p);
  if (!points.length) return null;
  const min: Vec3 = [...points[0]!];
  const max: Vec3 = [...points[0]!];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]!);
      max[i] = Math.max(max[i]!, p[i]!);
    }
  }
  const view = cameraView(scene);
  const halfField = view ? Math.min(view.cx / view.fx, view.cy / view.fy) : Math.tan(Math.PI / 6);
  // A node's own size is not known here, so its scale stands in: a node a metre across at that scale fits.
  const reach = Math.min(5, Math.max(0.3, ...leaves.map((r) => 0.9 * Math.max(...r.scale.map(Math.abs)))));
  const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 + reach;
  return { center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], distance: radius / halfField };
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
function selectionText(row: Row, at: [number, number, number] | null, budgets: ModelBudget[], scene: string | undefined): string {
  const where = row.source.file ? ` at ${row.source.file}:${row.source.line}` : "";
  const facts = [
    row.detail ? `showing ${row.detail}` : "",
    at ? `world position [${at.map((n) => n.toFixed(2)).join(", ")}]` : "",
    row.size ? `${sizeText(row.size)}${overBudgetText(row.size, budgets)}` : "",
  ].filter(Boolean);
  return (
    `In the Viro Live preview${scene ? ` of ${scene}` : ""}, the developer selected <${row.source.name}>${where}` +
    `${facts.length ? ` (${facts.join(", ")})` : ""}. When they say "this" or "the selected node", they mean that element.`
  );
}

const sizeText = (s: ModelSize) =>
  [`${fmt(s.triangles)} triangles`, s.textureBytes ? `${mb(s.textureBytes)} of textures` : "", s.textureDimension ? `textures up to ${s.textureDimension} px` : ""]
    .filter(Boolean)
    .join(", ");

/** What a model exceeds of one platform's single-model budget, as reactviro_check_performance_budget words it. */
function overBudget(s: ModelSize, b: ModelBudget): string[] {
  const over: string[] = [];
  if (s.triangles > b.max_triangles) over.push(`${fmt(s.triangles)} triangles > ${fmt(b.max_triangles)}`);
  if (b.max_texture_bytes !== undefined && s.textureBytes > b.max_texture_bytes) over.push(`${mb(s.textureBytes)} textures > ${mb(b.max_texture_bytes)}`);
  if (b.max_texture_dimension !== undefined && s.textureDimension > b.max_texture_dimension) {
    over.push(`${s.textureDimension} px texture dimension > ${b.max_texture_dimension} px`);
  }
  return over;
}

function overBudgetText(s: ModelSize, budgets: ModelBudget[]): string {
  const over = budgets.map((b) => ({ b, over: overBudget(s, b) })).filter((x) => x.over.length);
  return over.length ? `, over the single-model budget for ${over.map((x) => `${x.b.label} (${x.over.join("; ")})`).join(", ")}` : "";
}

export function InspectPanel({
  budgets,
  scene,
  onSelection,
  styles,
  copy,
  onClose,
}: {
  budgets: ModelBudget[];
  scene: string | undefined;
  /** Null when nothing is selected; undefined where no assistant is listening. */
  onSelection?: (text: string | null) => void;
  styles: { chip: React.CSSProperties; button: React.CSSProperties };
  copy(text: string): Promise<boolean>;
  onClose(): void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<{ frame: typeof lastFrame; fps: number | null; textures: { bytes: number; dimension: number } }>({
    frame: lastFrame,
    fps: null,
    textures: { bytes: 0, dimension: 0 },
  });
  const [selected, setSelected] = useState<{ handle: ViroHandle; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const marker = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // The node list is filled from effects as the scene mounts, so it is read again while the panel is open.
  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    const read = () => {
      const next = inspected ? rowsOf(inspected.scene) : [];
      setRows(next);
      const now = performance.now();
      setStats({ frame: lastFrame, fps: now > since ? Math.round((frames * 1000) / (now - since)) : null, textures: textureMemory() });
      frames = 0;
      since = now;
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
      if (sampleFrame()) frames++;
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
  const models = rows.filter((r) => r.size);
  const { frame, fps, textures } = stats;
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
        <div
          style={{ fontSize: 12, opacity: 0.8 }}
          title="The frame rate is this browser's. The rest is the last frame, with the grid, shadow passes and render targets counted; texture memory is an estimate."
        >
          {frame
            ? [
                fps ? `${fps} fps` : "",
                `${fmt(frame.draws)} draw calls`,
                `${fmt(frame.triangles)} triangles`,
                textures.bytes ? `about ${mb(textures.bytes)} of textures, the largest ${fmt(textures.dimension)} px` : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : "Waiting for a frame..."}
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
              const over = budgets.map((b) => ({ b, over: overBudget(m.size!, b) })).filter((x) => x.over.length);
              return (
                <div key={m.handle} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.detail}</span>
                    <span style={{ flex: "none", color: over.length ? "#ffd27a" : "#9be7a7" }}>{over.length ? "Over budget" : "Within budgets"}</span>
                  </div>
                  <div style={{ opacity: 0.8 }}>{sizeText(m.size!)}</div>
                  {over.map((x) => (
                    <div key={x.b.label} style={{ color: "#ffd27a" }}>
                      {x.b.label}: {x.over.join("; ")}
                    </div>
                  ))}
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
