/**
 * Load an image into RGBA8 bytes for the texture C API. Uses an <img> + canvas
 * so the browser decodes any format (png/jpg/webp/…). Results are cached by URL.
 */
export interface ViroRGBAImage {
  pixels: Uint8Array;
  width: number;
  height: number;
}

const cache = new Map<string, Promise<ViroRGBAImage>>();

/**
 * Resolve a Viro image source to a URL. Web supports a string URL or { uri }.
 * (react-native-web/bundlers turn require('./x.png') into a URL string.)
 */
export function resolveImageSource(source: unknown): string | undefined {
  if (typeof source === "string") return source;
  if (source && typeof source === "object") {
    const uri = (source as { uri?: string }).uri;
    if (typeof uri === "string") return uri;
  }
  return undefined;
}

export function loadImageRGBA(url: string): Promise<ViroRGBAImage> {
  const cached = cache.get(url);
  if (cached) return cached;

  const promise = new Promise<ViroRGBAImage>((resolve, reject) => {
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
