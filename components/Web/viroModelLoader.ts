/**
 * Fetch model bytes and determine container format for the model C API.
 * Self-contained formats (GLB, VRX) need only the single file; OBJ needs its
 * .mtl and that .mtl's textures passed through Viro3DObject's `resources`.
 */
import { ViroModelFormat } from "@reactvision/viro-web-renderer";

/** Resolve a Viro model source to a URL. Web supports a string URL or { uri }. */
export function resolveModelSource(source: unknown): string | undefined {
  if (typeof source === "string") return source;
  if (source && typeof source === "object") {
    const uri = (source as { uri?: string }).uri;
    if (typeof uri === "string") return uri;
  }
  return undefined;
}

/** Pick a format from an explicit type hint (Viro3DObject `type`) or the URL extension. */
export function modelFormatFor(url: string, typeHint?: string): ViroModelFormat {
  const t = typeHint?.toUpperCase();
  if (t === "VRX") return ViroModelFormat.VRX;
  if (t === "GLB") return ViroModelFormat.GLB;
  if (t === "GLTF") return ViroModelFormat.GLTF;
  if (t === "OBJ") return ViroModelFormat.OBJ;

  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".vrx")) return ViroModelFormat.VRX;
  if (path.endsWith(".gltf")) return ViroModelFormat.GLTF;
  if (path.endsWith(".obj")) return ViroModelFormat.OBJ;
  return ViroModelFormat.GLB; // default: GLB (self-contained binary)
}

/** Filename the model references a resource by (basename of the URL, no query). */
export function resourceName(url: string): string {
  return url.split("?")[0].split("/").pop() ?? url;
}

// The data URI headers tiny_gltf decodes itself (IsDataURI). Any other uri it
// treats as a file to download, and on wasm that download is a pabort().
const TINY_GLTF_DATA_URI_HEADERS = [
  "data:application/octet-stream;base64,",
  "data:application/gltf-buffer;base64,",
  "data:image/jpeg;base64,",
  "data:image/png;base64,",
  "data:image/bmp;base64,",
  "data:image/gif;base64,",
  "data:text/plain;base64,",
];

type GltfUriEntry = { uri?: unknown };

/**
 * Inline a .gltf's external buffers and images as data URIs, so the wasm loader
 * never has to fetch one. A file is found the way native finds it, relative to
 * the model's own URL, unless `resources` holds one under that name. A file that
 * cannot be fetched fails the whole model, as it does on native.
 */
export async function inlineGltfExternals(
  bytes: Uint8Array,
  modelUrl: string,
  resources: ReadonlyArray<{ name: string; bytes: Uint8Array }> = [],
): Promise<Uint8Array> {
  const gltf = JSON.parse(new TextDecoder().decode(bytes)) as {
    buffers?: GltfUriEntry[];
    images?: GltfUriEntry[];
  };
  const entries = [...(gltf.buffers ?? []), ...(gltf.images ?? [])].filter(
    (e): e is { uri: string } =>
      typeof e?.uri === "string" &&
      !TINY_GLTF_DATA_URI_HEADERS.some((h) => (e.uri as string).startsWith(h)),
  );
  if (entries.length === 0) return bytes;

  const base = new URL(modelUrl, globalThis.location?.href);
  await Promise.all(
    entries.map(async (entry) => {
      const named = resources.find(
        (r) => r.name === decodeURIComponent(resourceName(entry.uri)),
      );
      const fileBytes =
        named?.bytes ??
        (await fetchModelBytes(new URL(entry.uri, base).href));
      entry.uri = TINY_GLTF_DATA_URI_HEADERS[0] + toBase64(fileBytes);
    }),
  );
  return new TextEncoder().encode(JSON.stringify(gltf));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function fetchModelBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch model: ${url} (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}
