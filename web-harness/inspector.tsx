/**
 * The preview page's scene inspector: the Viro nodes the scene made, where
 * each one is written, an outline of the one selected, and what the GPU drew
 * in the last frame. Selecting a node tells the developer's assistant which
 * one they mean, through the host that runs the page.
 */
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ViroLightType, type ViroBoundingBox, type ViroHandle, type ViroSceneApi, type ViroWebRenderer } from "@reactvision/viro-web-renderer";

import { useViroRenderer } from "../components/Web/ViroWebContext";
import { viroLightEntries, type ViroWebLightProps } from "../components/Web/useViroLight";
import { viroNodeEntries } from "../components/Web/useViroNode";
import { cameraView, type CameraView } from "../components/Web/viroDrag";
import { quatFromEulerDegrees, rotateByQuaternion } from "../components/Web/viroMath";
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
  if (!sizes) {
    // A new renderer is when the last one's context has gone.
    for (const old of contexts.keys()) {
      if (old.isContextLost() || (old.canvas as HTMLCanvasElement).isConnected === false) contexts.delete(old);
    }
    contexts.set(gl, (sizes = new Map()));
  }
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
    // Named arguments, not a rest array: this runs for every draw call of every frame. The longest takes six,
    // and a call ignores the ones past its own.
    gl[name] = function (this: unknown, a0: number, a1: number, a2: number, a3: number, a4: number, a5: number) {
      counting.draws++;
      // eslint-disable-next-line prefer-rest-params
      counting.triangles += trianglesOf(a0, arguments[countAt]) * (instancesAt === undefined ? 1 : arguments[instancesAt]);
      return original.call(this, a0, a1, a2, a3, a4, a5);
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
type ModelSize = {
  triangles: number;
  textureBytes: number;
  textureDimension: number;
  parts: ModelPart[];
  partsLeftOut: number;
  /** Each mesh node's triangle edges, by glTF node index. */
  wires: Map<number, Wire>;
  /** Why some or all of the triangles cannot be drawn. */
  wireMissing?: string;
};
/** A node of the model's own tree that holds a mesh, or holds nodes that do. `triangles` counts its whole subtree, `nodes` lists its mesh nodes. */
type ModelPart = { name: string; path: string; depth: number; triangles: number; materials: string[]; nodes: number[] };
/** A mesh node's vertices at rest, in the model's own space, and its triangles as vertex index triples. `mirrored` flips which side faces out. */
type Wire = { positions: Float32Array; triangles: Uint32Array; mirrored: boolean };
const MAX_PARTS = 300;
// Past this the edges would take too long to draw every frame.
const MAX_WIRE_TRIANGLES = 100_000;

type Mat4 = number[];
const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Array<number>(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
  return o;
}
function nodeMatrix(n: { matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }): Mat4 {
  if (n.matrix?.length === 16) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y! * y! + z! * z!)) * sx!, 2 * (x! * y! + z! * w!) * sx!, 2 * (x! * z! - y! * w!) * sx!, 0,
    2 * (x! * y! - z! * w!) * sy!, (1 - 2 * (x! * x! + z! * z!)) * sy!, 2 * (y! * z! + x! * w!) * sy!, 0,
    2 * (x! * z! + y! * w!) * sz!, 2 * (y! * z! - x! * w!) * sz!, (1 - 2 * (x! * x! + y! * y!)) * sz!, 0,
    tx!, ty!, tz!, 1,
  ];
}
const modelSizes = new Map<string, ModelSize | null>();

/**
 * A glTF or GLB measured as reactviro_check_performance_budget measures it: each
 * mesh's TRIANGLES primitives once, the bytes of its embedded images, and the
 * longest side among its PNGs (a JPEG's size is not read there either).
 */
async function gltfSize(buf: ArrayBuffer, url: string): Promise<ModelSize | null> {
  let doc: {
    meshes?: Array<{ name?: string; primitives?: Array<{ mode?: number; indices?: number; material?: number; attributes?: { POSITION?: number } }> }>;
    nodes?: Array<{ name?: string; mesh?: number; skin?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
    skins?: Array<{ joints?: number[]; inverseBindMatrices?: number }>;
    buffers?: Array<{ uri?: string }>;
    scenes?: Array<{ nodes?: number[] }>;
    scene?: number;
    materials?: Array<{ name?: string }>;
    accessors?: Array<{ count?: number; bufferView?: number; byteOffset?: number; componentType?: number; type?: string; sparse?: unknown }>;
    images?: Array<{ mimeType?: string; bufferView?: number }>;
    bufferViews?: Array<{ buffer?: number; byteOffset?: number; byteLength?: number; byteStride?: number }>;
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
  const meshTriangles = (mesh: NonNullable<typeof doc.meshes>[number]) => {
    let n = 0;
    for (const p of mesh.primitives ?? []) {
      if ((p.mode ?? 4) !== 4) continue;
      n += Math.floor((doc.accessors?.[p.indices ?? p.attributes?.POSITION ?? -1]?.count ?? 0) / 3);
    }
    return n;
  };
  let triangles = 0;
  for (const mesh of doc.meshes ?? []) triangles += meshTriangles(mesh);
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
  const parts: ModelPart[] = [];
  let partsLeftOut = 0;
  const seen = new Set<number>();
  // Returns the subtree's triangles, or -1 when it holds no mesh.
  const visit = (i: number, depth: number, trail: string[], meshNodes: number[]): number => {
    const node = doc.nodes?.[i];
    if (!node || seen.has(i)) return -1;
    seen.add(i);
    const mesh = node.mesh === undefined ? undefined : doc.meshes?.[node.mesh];
    const name = node.name || mesh?.name || `Node ${i}`;
    const path = [...trail, name];
    const part: ModelPart = {
      name,
      path: path.join(" > "),
      depth,
      triangles: 0,
      materials: [...new Set((mesh?.primitives ?? []).map((p) => doc.materials?.[p.material ?? -1]?.name).filter((m): m is string => !!m))],
      nodes: mesh ? [i] : [],
    };
    const at = parts.length;
    if (at < MAX_PARTS) parts.push(part);
    let total = mesh ? meshTriangles(mesh) : -1;
    for (const child of node.children ?? []) {
      const t = visit(child, depth + 1, path, part.nodes);
      if (t >= 0) total = Math.max(total, 0) + t;
    }
    if (total < 0) {
      if (at < MAX_PARTS) parts.splice(at, parts.length - at);
      return -1;
    }
    if (at >= MAX_PARTS) partsLeftOut++;
    part.triangles = total;
    meshNodes.push(...part.nodes);
    return total;
  };
  const childOf = new Set((doc.nodes ?? []).flatMap((n) => n.children ?? []));
  const roots = doc.scenes?.[doc.scene ?? 0]?.nodes ?? (doc.nodes ?? []).map((_, i) => i).filter((i) => !childOf.has(i));
  for (const root of roots) visit(root, 0, [], []);
  const { wires, missing } = triangles > MAX_WIRE_TRIANGLES ? { wires: new Map(), missing: `it has more than ${fmt(MAX_WIRE_TRIANGLES)} triangles` } : await gltfWires(doc, bin, url, roots);
  return { triangles, textureBytes, textureDimension, parts, partsLeftOut, wires, wireMissing: missing };
}

/**
 * Each mesh node's TRIANGLES primitives at rest, placed in the model's space as
 * virocore places them: through the node's ancestors, or for a skinned mesh
 * through its first joint and that joint's inverse bind matrix.
 */
async function gltfWires(
  doc: {
    meshes?: Array<{ primitives?: Array<{ mode?: number; indices?: number; attributes?: { POSITION?: number } }> }>;
    nodes?: Array<{ mesh?: number; skin?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
    skins?: Array<{ joints?: number[]; inverseBindMatrices?: number }>;
    buffers?: Array<{ uri?: string }>;
    accessors?: Array<{ count?: number; bufferView?: number; byteOffset?: number; componentType?: number; type?: string; sparse?: unknown }>;
    bufferViews?: Array<{ buffer?: number; byteOffset?: number; byteLength?: number; byteStride?: number }>;
  },
  bin: DataView | null,
  url: string,
  roots: number[],
): Promise<{ wires: Map<number, Wire>; missing?: string }> {
  const wires = new Map<number, Wire>();
  let missing: string | undefined;
  const buffers = await Promise.all(
    (doc.buffers ?? []).map(async (b, i): Promise<DataView | null> => {
      try {
        if (!b.uri) return i === 0 ? bin : null;
        const res = await fetch(new URL(b.uri, new URL(url, location.href)).href);
        return res.ok ? new DataView(await res.arrayBuffer()) : null;
      } catch {
        return null;
      }
    }),
  );
  const view = (accessor: number | undefined, type: string, componentType: number) => {
    const a = doc.accessors?.[accessor ?? -1];
    const bv = doc.bufferViews?.[a?.bufferView ?? -1];
    const data = buffers[bv?.buffer ?? -1];
    if (!a || !bv || !data || a.sparse || a.type !== type || (componentType && a.componentType !== componentType)) return null;
    const size = { SCALAR: 1, VEC3: 3, MAT4: 16 }[type]! * (a.componentType === 5121 ? 1 : a.componentType === 5123 ? 2 : 4);
    const stride = bv.byteStride || size;
    const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const count = a.count ?? 0;
    if (count && start + (count - 1) * stride + size > data.byteLength) return null;
    return { a, data, start, stride, count };
  };
  const worlds = new Map<number, Mat4>();
  const place = (i: number, parent: Mat4) => {
    const node = doc.nodes?.[i];
    if (!node || worlds.has(i)) return;
    const world = mul(parent, nodeMatrix(node));
    worlds.set(i, world);
    for (const child of node.children ?? []) place(child, world);
  };
  for (const root of roots) place(root, IDENTITY);
  for (const [i, world] of worlds) {
    const node = doc.nodes![i]!;
    const mesh = doc.meshes?.[node.mesh ?? -1];
    if (!mesh) continue;
    let m = world;
    const skin = doc.skins?.[node.skin ?? -1];
    const joint = skin?.joints?.[0];
    if (skin && joint !== undefined && worlds.has(joint)) {
      const ibm = view(skin.inverseBindMatrices, "MAT4", 5126);
      m = mul(worlds.get(joint)!, ibm ? Array.from({ length: 16 }, (_, k) => ibm.data.getFloat32(ibm.start + k * 4, true)) : IDENTITY);
    }
    const positions: number[] = [];
    const triangles: number[] = [];
    for (const p of mesh.primitives ?? []) {
      if ((p.mode ?? 4) !== 4) continue;
      const pos = view(p.attributes?.POSITION, "VEC3", 5126);
      const idx = p.indices === undefined ? null : view(p.indices, "SCALAR", 0);
      if (!pos || (p.indices !== undefined && (!idx || ![5121, 5123, 5125].includes(idx.a.componentType ?? 0)))) {
        missing = "its geometry is compressed or could not be read";
        continue;
      }
      const base = positions.length / 3;
      for (let v = 0; v < pos.count; v++) {
        const at = pos.start + v * pos.stride;
        const x = pos.data.getFloat32(at, true), y = pos.data.getFloat32(at + 4, true), z = pos.data.getFloat32(at + 8, true);
        positions.push(m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!);
      }
      const index = (k: number) => {
        if (!idx) return k;
        const at = idx.start + k * idx.stride;
        return idx.a.componentType === 5121 ? idx.data.getUint8(at) : idx.a.componentType === 5123 ? idx.data.getUint16(at, true) : idx.data.getUint32(at, true);
      };
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t + 2 < n; t += 3) {
        const tri = [index(t), index(t + 1), index(t + 2)];
        if (tri.every((v) => v < pos.count)) triangles.push(base + tri[0]!, base + tri[1]!, base + tri[2]!);
      }
    }
    const det = m[0]! * (m[5]! * m[10]! - m[9]! * m[6]!) - m[4]! * (m[1]! * m[10]! - m[9]! * m[2]!) + m[8]! * (m[1]! * m[6]! - m[5]! * m[2]!);
    if (triangles.length) wires.set(i, { positions: new Float32Array(positions), triangles: new Uint32Array(triangles), mirrored: det < 0 });
  }
  return { wires, missing };
}

/** Measures a loaded model from the response the scene fetched it with. */
export function noteModelResponse(url: string, res: Response): void {
  // Measured once: a remounted scene asks for the same models again.
  if (!res.ok || modelSizes.has(url) || !/\.(glb|gltf)$/i.test(url.split(/[?#]/)[0]!)) return;
  modelSizes.set(url, null);
  res
    .clone()
    .arrayBuffer()
    .then((buf) => gltfSize(buf, url))
    .then((size) => modelSizes.set(url, size))
    .catch(() => {});
}

// ─── The scene being inspected ────────────────────────────────────────────
let inspected: ViroWebRenderer | null = null;
/** Counts scene mounts, since an update can remount the scene with the same renderer and handles. */
let inspectedMounts = 0;

/** Rendered inside a scene, so the inspector can reach its renderer. */
export function InspectorProbe() {
  const renderer = useViroRenderer();
  useEffect(() => {
    inspected = renderer;
    inspectedMounts++;
    return () => {
      if (inspected === renderer) inspected = null;
    };
  }, [renderer]);
  return null;
}

type LightInfo = { type: ViroLightType; parent: ViroHandle; props: ViroWebLightProps };
type Row = {
  /** Unique in the list. A part's is its model's, then `#` and its index. */
  id: string;
  /** The same element after an update remounts the scene with new handles. */
  key: string;
  kind: "node" | "light" | "part";
  /** The node's or the light's; a part's model's. */
  handle: ViroHandle;
  source: ViroSource;
  depth: number;
  detail: string;
  size?: ModelSize | null;
  scale: Vec3;
  light?: LightInfo;
  part?: ModelPart;
};

const basename = (uri: string) => decodeURIComponent(uri.split(/[?#]/)[0]!.split("/").pop() ?? uri);
const sourceKey = (s: ViroSource) => `${s.name}@${s.file}:${s.line}`;
const LIGHT_NAMES: Record<ViroLightType, string> = {
  [ViroLightType.Ambient]: "ViroAmbientLight",
  [ViroLightType.Directional]: "ViroDirectionalLight",
  [ViroLightType.Omni]: "ViroOmniLight",
  [ViroLightType.Spot]: "ViroSpotLight",
};
const vec = (v: readonly number[]) => `[${v.map((n) => +n.toFixed(2)).join(", ")}]`;
const fmt = (n: number) => n.toLocaleString("en-US");
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function lightDetail(l: LightInfo): string {
  const p = l.props;
  return [
    typeof p.color === "string" ? p.color : "",
    p.intensity !== undefined ? `intensity ${p.intensity}` : "",
    (l.type === ViroLightType.Omni || l.type === ViroLightType.Spot) && p.position ? `at ${vec(p.position)}` : "",
    (l.type === ViroLightType.Directional || l.type === ViroLightType.Spot) && p.direction ? `pointing ${vec(p.direction)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** The scene's nodes and lights, each under the nearest listed node above it. */
function rowsOf(scene: ViroSceneApi): Row[] {
  const entries = viroNodeEntries(scene);
  const lights = viroLightEntries(scene);
  const stampOf = (props: object) => (props as Record<string, unknown>)[VIRO_SOURCE_PROP] as ViroSource | undefined;
  const stamped = [...entries.values()].some((e) => stampOf(e.props()));
  // A preview compiled before sources were stamped still lists its nodes, unnamed.
  const sourceOf = (h: ViroHandle): ViroSource | null => {
    const e = entries.get(h);
    if (!e) return null;
    return stampOf(e.props()) ?? (stamped ? null : { name: "Node", file: "", line: 0 });
  };
  const lightSourceOf = (h: ViroHandle): ViroSource | null => {
    const l = lights.get(h)!;
    return stampOf(l.props()) ?? (stamped ? null : { name: LIGHT_NAMES[l.type], file: "", line: 0 });
  };
  type Kid = { kind: "node" | "light"; h: ViroHandle; source: ViroSource };
  const children = new Map<ViroHandle, Kid[]>();
  // Under the nearest listed ancestor; the scene's own wrappers are not listed.
  const place = (parent: ViroHandle, kid: Kid) => {
    let p = parent;
    while (entries.has(p) && !sourceOf(p)) p = entries.get(p)!.parent;
    const at = entries.has(p) ? p : 0;
    children.set(at, [...(children.get(at) ?? []), kid]);
  };
  for (const [h, e] of entries) {
    const source = sourceOf(h);
    if (source) place(e.parent, { kind: "node", h, source });
  }
  for (const [h, l] of lights) {
    const source = lightSourceOf(h);
    if (source) place(l.parent, { kind: "light", h, source });
  }
  const rows: Row[] = [];
  const walk = (parent: ViroHandle, depth: number) => {
    const kids = (children.get(parent) ?? []).sort(
      (a, b) => a.source.file.localeCompare(b.source.file) || a.source.line - b.source.line || a.h - b.h,
    );
    for (const { kind, h, source } of kids) {
      if (kind === "light") {
        const l = lights.get(h)!;
        const light = { type: l.type, parent: l.parent, props: l.props() };
        rows.push({ id: `l${h}`, key: sourceKey(source), kind, handle: h, source, depth, detail: lightDetail(light), scale: [1, 1, 1], light });
        continue;
      }
      const props = entries.get(h)!.props() as Record<string, unknown>;
      let detail = "";
      let size: ModelSize | null | undefined;
      if (typeof props.text === "string") detail = `"${props.text.length > 28 ? `${props.text.slice(0, 27)}...` : props.text}"`;
      const uri = typeof props.source === "string" ? props.source : (props.source as { uri?: unknown } | undefined)?.uri;
      if (typeof uri === "string" && !uri.startsWith("data:")) detail = uri === PLACEHOLDER_MODEL_URL ? "placeholder" : basename(uri);
      // The stand-in's size says nothing about the model it stands for.
      if (source.name === "Viro3DObject" && typeof uri === "string" && uri !== PLACEHOLDER_MODEL_URL) size = modelSizes.get(uri);
      const s = props.scale;
      const scale: Vec3 = Array.isArray(s) && s.length === 3 && s.every((n) => Number.isFinite(n)) ? [s[0], s[1], s[2]] : [1, 1, 1];
      rows.push({ id: `n${h}`, key: sourceKey(source), kind, handle: h, source, depth, detail, size, scale });
      walk(h, depth + 1);
    }
  };
  walk(0, 0);
  return rows;
}

// The node selected in the open panel: framing then fits it and what is under it.
let framedRow: string | null = null;

/**
 * The centre of the nodes the scene's code made, and how far back a camera
 * frames them all from. Null before the scene has any.
 */
export function contentFraming(): { center: Vec3; distance: number } | null {
  const scene = inspected?.scene;
  if (!scene) return null;
  let rows = rowsOf(scene).filter((r) => r.kind === "node");
  const at = framedRow ? rows.findIndex((r) => r.id === framedRow) : -1;
  if (at >= 0) {
    let end = at + 1;
    while (end < rows.length && rows[end]!.depth > rows[at]!.depth) end++;
    rows = rows.slice(at, end);
  }
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

// Points closer to the camera than this, or behind it, have no place on screen.
const NEAR = -0.01;

function toCamera(view: CameraView, p: Vec3): Vec3 {
  // World to camera: the inverse of the orientation rayAt turns a pointer ray by.
  const [qx, qy, qz, qw] = view.orientation;
  const d = [p[0] - view.position[0], p[1] - view.position[1], p[2] - view.position[2]];
  const x = -qx, y = -qy, z = -qz;
  const tx = 2 * (y * d[2]! - z * d[1]!);
  const ty = 2 * (z * d[0]! - x * d[2]!);
  const tz = 2 * (x * d[1]! - y * d[0]!);
  return [d[0]! + qw * tx + (y * tz - z * ty), d[1]! + qw * ty + (z * tx - x * tz), d[2]! + qw * tz + (x * ty - y * tx)];
}

const toScreen = (view: CameraView, rect: DOMRect, v: Vec3) => ({ x: rect.left + view.cx + (view.fx * v[0]) / -v[2], y: rect.top + view.cy - (view.fy * v[1]) / -v[2] });

function project(view: CameraView, p: Vec3): { x: number; y: number } | null {
  const v = toCamera(view, p);
  return v[2] > NEAR ? null : toScreen(view, view.element.getBoundingClientRect(), v);
}

/** The box's 12 edges as an SVG path in page pixels, each cut where it passes behind the camera. */
function boxPath(view: CameraView, b: ViroBoundingBox, dx: number, dy: number): string {
  const rect = view.element.getBoundingClientRect();
  const corners = Array.from({ length: 8 }, (_, i) =>
    toCamera(view, [i & 1 ? b.maxX : b.minX, i & 2 ? b.maxY : b.minY, i & 4 ? b.maxZ : b.minZ]),
  );
  let path = "";
  for (let i = 0; i < 8; i++) {
    for (const bit of [1, 2, 4]) {
      if (i & bit) continue;
      let a = corners[i]!;
      let c = corners[i | bit]!;
      if (a[2] > NEAR && c[2] > NEAR) continue;
      if (a[2] > NEAR) [a, c] = [c, a];
      if (c[2] > NEAR) {
        const t = (NEAR - a[2]) / (c[2] - a[2]);
        c = [a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1]), NEAR];
      }
      const from = toScreen(view, rect, a);
      const to = toScreen(view, rect, c);
      path += `M${(from.x - dx).toFixed(1)} ${(from.y - dy).toFixed(1)}L${(to.x - dx).toFixed(1)} ${(to.y - dy).toFixed(1)}`;
    }
  }
  return path;
}

/** The triangle edges of a selected model part, drawn over the page in page pixels. Empties the canvas when there is nothing to draw. */
function drawWire(canvas: HTMLCanvasElement, view: CameraView | null, scene: ViroSceneApi | undefined, row: Row | undefined, model: ModelSize | null | undefined): void {
  const wires = row?.part && model ? row.part.nodes.map((n) => model.wires.get(n)).filter((w): w is Wire => !!w) : [];
  const t = view && wires.length ? scene?.getNodeWorldTransform(row!.handle) : null;
  if (!view || !t) {
    if (canvas.width) canvas.width = canvas.height = 0;
    return;
  }
  // Model space to camera space is affine, so it is read off where the model's origin and axes land.
  const q = quatFromEulerDegrees(t.rotation);
  const point = (axis: Vec3) => {
    const r = rotateByQuaternion(q, [axis[0] * t.scale[0], axis[1] * t.scale[1], axis[2] * t.scale[2]]);
    return toCamera(view, [t.position[0] + r[0], t.position[1] + r[1], t.position[2] + r[2]]);
  };
  const o = point([0, 0, 0]);
  const [ex, ey, ez] = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]).map((a) => point(a).map((c, k) => c - o[k]!)) as [Vec3, Vec3, Vec3];
  const rect = view.element.getBoundingClientRect();
  const page = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(page.width * dpr);
  const height = Math.round(page.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  // Measured, not assumed, as for the marker: the canvas may sit in a transformed stage.
  ctx.setTransform(dpr, 0, 0, dpr, -page.left * dpr, -page.top * dpr);
  ctx.beginPath();
  const segment = (a: Vec3, c: Vec3) => {
    if (a[2] > NEAR && c[2] > NEAR) return;
    if (a[2] > NEAR) [a, c] = [c, a];
    if (c[2] > NEAR) {
      const f = (NEAR - a[2]) / (c[2] - a[2]);
      c = [a[0] + f * (c[0] - a[0]), a[1] + f * (c[1] - a[1]), NEAR];
    }
    const from = toScreen(view, rect, a);
    const to = toScreen(view, rect, c);
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
  };
  const flipped = t.scale[0] * t.scale[1] * t.scale[2] < 0;
  for (const w of wires) {
    const n = w.positions.length / 3;
    const cam = new Float32Array(n * 3);
    const screen = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = w.positions[i * 3]!, y = w.positions[i * 3 + 1]!, z = w.positions[i * 3 + 2]!;
      for (let k = 0; k < 3; k++) cam[i * 3 + k] = o[k]! + ex[k]! * x + ey[k]! * y + ez[k]! * z;
      const p = toScreen(view, rect, [cam[i * 3]!, cam[i * 3 + 1]!, cam[i * 3 + 2]!]);
      screen[i * 2] = p.x;
      screen[i * 2 + 1] = p.y;
    }
    const at = (i: number): Vec3 => [cam[i * 3]!, cam[i * 3 + 1]!, cam[i * 3 + 2]!];
    const front = w.mirrored === flipped ? 1 : -1;
    for (let k = 0; k < w.triangles.length; k += 3) {
      const a = w.triangles[k]!, b = w.triangles[k + 1]!, c = w.triangles[k + 2]!;
      if (cam[a * 3 + 2]! > NEAR || cam[b * 3 + 2]! > NEAR || cam[c * 3 + 2]! > NEAR) {
        // Partly behind the camera: its edges are cut there, and which way it faces is not checked.
        segment(at(a), at(b));
        segment(at(b), at(c));
        segment(at(c), at(a));
        continue;
      }
      const ax = screen[a * 2]!, ay = screen[a * 2 + 1]!;
      const bx = screen[b * 2]!, by = screen[b * 2 + 1]!;
      const cx = screen[c * 2]!, cy = screen[c * 2 + 1]!;
      // Counter-clockwise in front of the camera turns clockwise on a screen whose y runs down.
      if (front * ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) >= 0) continue;
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.closePath();
    }
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(76,194,255,0.6)";
  ctx.stroke();
}

/** A node's box and what is under it, in world space. Null for a node with nothing drawn in it, which gets the marker instead. */
function outlineOf(scene: ViroSceneApi, row: Row): ViroBoundingBox | null {
  if (row.kind !== "node" || typeof scene.getNodeBoundingBox !== "function") return null;
  const b = scene.getNodeBoundingBox(row.handle);
  return b && Math.max(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ) > 1e-4 ? b : null;
}

const isIdentity = (v: unknown, one: number) => !Array.isArray(v) || v.every((n) => n === one);

/** Where the marker goes: a node's origin, or an omni or spot light's position. Null for what has no point of its own. */
function markerAt(scene: ViroSceneApi, row: Row): Vec3 | null {
  if (row.kind === "node") return scene.getNodeWorldPosition(row.handle);
  const l = row.light;
  if (!l || (l.type !== ViroLightType.Omni && l.type !== ViroLightType.Spot)) return null;
  // The position is in its node's space, and only a node's world position can be read, so a turned or scaled node above it leaves it unplaced.
  const entries = viroNodeEntries(scene);
  for (let h = l.parent; entries.has(h); h = entries.get(h)!.parent) {
    const p = entries.get(h)!.props();
    if (!isIdentity(p.rotation, 0) || !isIdentity(p.scale, 1)) return null;
  }
  const origin = scene.getNodeWorldPosition(l.parent);
  const at = l.props.position ?? [0, 0, 0];
  return origin ? [origin[0] + at[0], origin[1] + at[1], origin[2] + at[2]] : null;
}

/** The sentence the assistant gets for a selected row; `model` is a part's model. */
function selectionText(row: Row, model: Row | undefined, at: Vec3 | null, budgets: ModelBudget[], scene: string | undefined): string {
  const lead = `In the Viro Live preview${scene ? ` of ${scene}` : ""}, the developer selected`;
  const whereOf = (r: Row) => (r.source.file ? ` at ${r.source.file}:${r.source.line}` : "");
  const meaning = `When they say "this" or "the selected node", they mean that element.`;
  if (row.part && model) {
    const facts = [`${fmt(row.part.triangles)} triangles`, row.part.materials.length ? `materials ${row.part.materials.join(", ")}` : ""].filter(Boolean);
    return (
      `${lead} "${row.part.path}", a node inside the model ${model.detail} that <${model.source.name}>${whereOf(model)} loads (${facts.join(", ")}). ` +
      `It is part of the model file, not of the scene's code. ${meaning}`
    );
  }
  const facts = [
    row.kind === "light" ? row.detail : row.detail ? `showing ${row.detail}` : "",
    at ? `world position ${vec(at)}` : "",
    row.size ? `${sizeText(row.size)}${overBudgetText(row.size, budgets)}` : "",
  ].filter(Boolean);
  return `${lead} <${row.source.name}>${whereOf(row)}${facts.length ? ` (${facts.join(", ")})` : ""}. ${meaning}`;
}

/** The rows with the parts of the selected model, or of the model a selected part is in, under it. */
function withParts(rows: Row[], selectedId: string | undefined): Row[] {
  const modelId = selectedId?.split("#")[0];
  const at = rows.findIndex((r) => r.id === modelId);
  const model = rows[at];
  if (!model?.size?.parts.length) return rows;
  const parts = model.size.parts.map(
    (part, i): Row => ({
      ...model,
      id: `${model.id}#${i}`,
      key: `${model.key}#${i}`,
      kind: "part",
      depth: model.depth + 1 + part.depth,
      detail: `${fmt(part.triangles)} triangles`,
      size: undefined,
      part,
    }),
  );
  return [...rows.slice(0, at + 1), ...parts, ...rows.slice(at + 1)];
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
  header,
}: {
  budgets: ModelBudget[];
  scene: string | undefined;
  /** Null when nothing is selected; undefined where no assistant is listening. */
  onSelection?: (text: string | null) => void;
  styles: { button: React.CSSProperties; popup: React.CSSProperties };
  copy(text: string): Promise<boolean>;
  header: React.ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<{ frame: typeof lastFrame; fps: number | null; textures: { bytes: number; dimension: number } }>({
    frame: lastFrame,
    fps: null,
    textures: { bytes: 0, dimension: 0 },
  });
  const [selected, setSelected] = useState<{ id: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounts, setMounts] = useState(inspectedMounts);
  const marker = useRef<HTMLDivElement>(null);
  const outline = useRef<SVGSVGElement>(null);
  const wire = useRef<HTMLCanvasElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const shown = withParts(rows, selected?.id);
  const expanded = rows.find((r) => r.id === selected?.id.split("#")[0]);
  const lastPart = expanded?.size?.parts.length ? `${expanded.id}#${expanded.size.parts.length - 1}` : null;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    framedRow = selected?.id.split("#")[0] ?? null;
    return () => void (framedRow = null);
  }, [selected]);

  // The node list is filled from effects as the scene mounts, so it is read again while the panel is open.
  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    let seenMounts = inspectedMounts;
    const read = () => {
      const next = inspected ? rowsOf(inspected.scene) : [];
      setRows(next);
      // One read late: right after a mount, world positions are still the origin until a frame renders.
      setMounts(seenMounts);
      seenMounts = inspectedMounts;
      const now = performance.now();
      setStats({ frame: lastFrame, fps: now > since ? Math.round((frames * 1000) / (now - since)) : null, textures: textureMemory() });
      frames = 0;
      since = now;
      const sel = selectedRef.current;
      // An update remounts the scene with new handles: keep the same element selected if it is still there.
      const [base, part] = sel?.id.split("#") ?? [];
      if (sel && !next.some((r) => r.id === base)) {
        const same = next.find((r) => r.key === sel.key.split("#")[0]);
        setSelected(same ? { id: part === undefined ? same.id : `${same.id}#${part}`, key: sel.key } : null);
      }
    };
    read();
    const timer = setInterval(read, 500);
    let raf = 0;
    const tick = () => {
      if (sampleFrame()) frames++;
      const sel = selectedRef.current;
      const el = marker.current;
      const svg = outline.current;
      const view = inspected && cameraView(inspected.scene);
      const selRow = sel ? shownRef.current.find((r) => r.id === sel.id) : undefined;
      const box = selRow && inspected ? outlineOf(inspected.scene, selRow) : null;
      const at = selRow && inspected && !box ? markerAt(inspected.scene, selRow) : null;
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
      if (svg) {
        const origin = svg.getBoundingClientRect();
        const path = view && box ? boxPath(view, box, origin.left, origin.top) : "";
        svg.style.display = path ? "block" : "none";
        for (const line of svg.children) line.setAttribute("d", path);
      }
      if (wire.current) {
        const model = selRow?.part ? shownRef.current.find((r) => r.id === selRow.id.split("#")[0])?.size : undefined;
        drawWire(wire.current, view, inspected?.scene, selRow, model);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  const row = selected ? shown.find((r) => r.id === selected.id) : undefined;
  const model = row?.part ? rows.find((r) => r.id === row.id.split("#")[0]) : undefined;
  const text = row ? selectionText(row, model, inspected ? markerAt(inspected.scene, row) : null, budgets, scene) : null;
  const textRef = useRef(text);
  textRef.current = text;
  // Not keyed on the text itself: it carries the live position, which changes while a node moves.
  const selectionKey = row ? `${mounts}\n${row.id}\n${selectionText(row, model, null, budgets, scene)}` : null;
  useEffect(() => {
    onSelection?.(textRef.current);
    setCopied(false);
  }, [selectionKey]);
  useEffect(() => () => onSelection?.(null), []);

  const { button, popup } = styles;
  const models = rows.filter((r) => r.size);
  const { frame, fps, textures } = stats;
  return (
    <>
      <div
        ref={marker}
        aria-hidden="true"
        style={{ position: "fixed", left: 0, top: 0, width: 24, height: 24, borderRadius: "50%", border: "2px solid #4cc2ff", boxShadow: "0 0 0 2px rgba(0,0,0,0.5), 0 0 12px #4cc2ff", display: "none", pointerEvents: "none" }}
      />
      <svg
        ref={outline}
        aria-hidden="true"
        style={{ position: "fixed", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", display: "none", pointerEvents: "none" }}
      >
        <path fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={3.5} strokeLinejoin="round" />
        <path fill="none" stroke="#4cc2ff" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
      <canvas ref={wire} aria-hidden="true" width={0} height={0} style={{ position: "fixed", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      <div style={{ ...popup, width: 340, fontSize: 13 }}>
        {header}
        {frame ? (
          <div
            style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.6fr)", gap: 6 }}
            title="The frame rate is this browser's. The rest is the last frame, with the grid, shadow passes and render targets counted; texture memory is an estimate."
          >
            {[
              { label: "FPS", value: fps === null ? "..." : String(fps) },
              { label: "Draw calls", value: fmt(frame.draws) },
              { label: "Triangles", value: fmt(frame.triangles) },
              { label: "Textures", value: textures.bytes ? mb(textures.bytes) : "0 MB", note: textures.dimension ? `largest ${fmt(textures.dimension)} px` : "" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "8px 4px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 2 }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stat.value}</div>
                <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.25 }}>{stat.label}</div>
                {stat.note ? <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.25 }}>{stat.note}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.8 }}>Waiting for a frame...</div>
        )}
        {rows.length === 0 ? <div style={{ opacity: 0.7 }}>No nodes yet.</div> : null}
        <div role="listbox" aria-label="Nodes" style={{ display: "flex", flexDirection: "column" }}>
          {shown.map((r) => {
            const on = r.id === selected?.id;
            return (
              <React.Fragment key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => setSelected(on ? null : { id: r.id, key: r.key })}
                  title={r.part ? r.part.path : r.source.file ? `${r.source.file}:${r.source.line}` : undefined}
                  style={{ all: "unset", cursor: "pointer", padding: `3px 6px 3px ${6 + r.depth * 14}px`, borderRadius: 5, background: on ? "rgba(76,194,255,0.22)" : "transparent", display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}
                >
                  <span style={{ fontWeight: r.part ? 400 : 600, flex: "none" }}>{r.part ? r.part.name : r.source.name}</span>
                  <span style={{ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{r.detail}</span>
                  {r.source.file && !r.part ? <span style={{ opacity: 0.55, fontSize: 11, flex: "none" }}>{basename(r.source.file)}:{r.source.line}</span> : null}
                </button>
                {r.id === lastPart && expanded?.size?.partsLeftOut ? (
                  <div style={{ opacity: 0.6, fontSize: 11, padding: `0 6px 0 ${20 + expanded.depth * 14}px` }}>
                    {fmt(expanded.size.partsLeftOut)} more parts are not listed.
                  </div>
                ) : null}
              </React.Fragment>
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
        {row?.part && expanded?.size?.wireMissing ? (
          <div style={{ fontSize: 12, color: "#ffd27a" }}>Some triangles of this model are not drawn: {expanded.size.wireMissing}.</div>
        ) : null}
        <div style={{ fontSize: 11, opacity: 0.6 }}>Select a glTF or GLB model to list the parts inside it.</div>
      </div>
    </>
  );
}
