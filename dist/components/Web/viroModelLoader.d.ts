/**
 * Fetch model bytes and determine container format for the model C API.
 * Self-contained formats (GLB, VRX) need only the single file; OBJ needs its
 * .mtl and that .mtl's textures passed through Viro3DObject's `resources`.
 */
import { ViroModelFormat } from "@reactvision/viro-web-renderer";
/** Resolve a Viro model source to a URL. Web supports a string URL or { uri }. */
export declare function resolveModelSource(source: unknown): string | undefined;
/** Pick a format from an explicit type hint (Viro3DObject `type`) or the URL extension. */
export declare function modelFormatFor(url: string, typeHint?: string): ViroModelFormat;
/** Filename the model references a resource by (basename of the URL, no query). */
export declare function resourceName(url: string): string;
export declare function fetchModelBytes(url: string): Promise<Uint8Array>;
