/**
 * Parse any CSS color string (hex, rgb(a), named, hsl…) into normalized RGBA
 * [0,1] components for the WASM material C API. Uses a 1x1 canvas so the browser
 * does the parsing; results are cached since materials reuse colors heavily.
 */
const cache = new Map<string, [number, number, number, number]>();
let ctx: CanvasRenderingContext2D | null = null;

export function parseColorToRGBA(
  color: string | number,
): [number, number, number, number] {
  // Numeric colors (react-native processColor style: 0xAARRGGBB) — rare on web.
  if (typeof color === "number") {
    const a = ((color >> 24) & 0xff) / 255;
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;
    return [r, g, b, a];
  }

  const cached = cache.get(color);
  if (cached) return cached;

  if (!ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }

  let rgba: [number, number, number, number] = [1, 1, 1, 1];
  if (ctx) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color; // invalid strings leave it as #000
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    rgba = [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
  }

  cache.set(color, rgba);
  return rgba;
}
