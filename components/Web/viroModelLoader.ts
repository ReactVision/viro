/**
 * Fetch model bytes and determine container format for the model C API.
 * Self-contained formats (GLB, VRX) need only the single file.
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

  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".vrx")) return ViroModelFormat.VRX;
  if (path.endsWith(".gltf")) return ViroModelFormat.GLTF;
  return ViroModelFormat.GLB; // default: GLB (self-contained binary)
}

/** Filename the model references a resource by (basename of the URL, no query). */
export function resourceName(url: string): string {
  return url.split("?")[0].split("/").pop() ?? url;
}

export async function fetchModelBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch model: ${url} (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}
