"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveImageSource = resolveImageSource;
exports.loadImageRGBA = loadImageRGBA;
const cache = new Map();
/**
 * Resolve a Viro image source to a URL. Web supports a string URL or { uri }.
 * (react-native-web/bundlers turn require('./x.png') into a URL string.)
 */
function resolveImageSource(source) {
    if (typeof source === "string")
        return source;
    if (source && typeof source === "object") {
        const uri = source.uri;
        if (typeof uri === "string")
            return uri;
    }
    return undefined;
}
function loadImageRGBA(url) {
    const cached = cache.get(url);
    if (cached)
        return cached;
    const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) {
                reject(new Error("2D canvas context unavailable"));
                return;
            }
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, width, height);
            resolve({ pixels: new Uint8Array(data.data.buffer), width, height });
        };
        img.onerror = () => reject(new Error(`failed to load image: ${url}`));
        img.src = url;
    });
    cache.set(url, promise);
    return promise;
}
