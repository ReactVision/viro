"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveModelSource = resolveModelSource;
exports.modelFormatFor = modelFormatFor;
exports.resourceName = resourceName;
exports.fetchModelBytes = fetchModelBytes;
/**
 * Fetch model bytes and determine container format for the model C API.
 * Self-contained formats (GLB, VRX) need only the single file; OBJ needs its
 * .mtl and that .mtl's textures passed through Viro3DObject's `resources`.
 */
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
/** Resolve a Viro model source to a URL. Web supports a string URL or { uri }. */
function resolveModelSource(source) {
    if (typeof source === "string")
        return source;
    if (source && typeof source === "object") {
        const uri = source.uri;
        if (typeof uri === "string")
            return uri;
    }
    return undefined;
}
/** Pick a format from an explicit type hint (Viro3DObject `type`) or the URL extension. */
function modelFormatFor(url, typeHint) {
    const t = typeHint?.toUpperCase();
    if (t === "VRX")
        return viro_web_renderer_1.ViroModelFormat.VRX;
    if (t === "GLB")
        return viro_web_renderer_1.ViroModelFormat.GLB;
    if (t === "GLTF")
        return viro_web_renderer_1.ViroModelFormat.GLTF;
    if (t === "OBJ")
        return viro_web_renderer_1.ViroModelFormat.OBJ;
    const path = url.split("?")[0].toLowerCase();
    if (path.endsWith(".vrx"))
        return viro_web_renderer_1.ViroModelFormat.VRX;
    if (path.endsWith(".gltf"))
        return viro_web_renderer_1.ViroModelFormat.GLTF;
    if (path.endsWith(".obj"))
        return viro_web_renderer_1.ViroModelFormat.OBJ;
    return viro_web_renderer_1.ViroModelFormat.GLB; // default: GLB (self-contained binary)
}
/** Filename the model references a resource by (basename of the URL, no query). */
function resourceName(url) {
    return url.split("?")[0].split("/").pop() ?? url;
}
async function fetchModelBytes(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`failed to fetch model: ${url} (${res.status})`);
    }
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
}
