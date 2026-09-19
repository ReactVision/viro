/**
 * Parse any CSS color string (hex, rgb(a), named, hsl…) into normalized RGBA
 * [0,1] components for the WASM material C API. Hex is read here; everything
 * else goes through a 1x1 canvas so the browser does the parsing. Results are
 * cached since materials reuse colors heavily.
 *
 * Hex is not just a fast path: it is what a Studio scene and a stylesheet both
 * write, and reading it directly means the colour rules can be exercised without
 * a DOM, which is where their mistakes actually get caught.
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

  const hex = parseHex(color);
  if (hex) {
    cache.set(color, hex);
    return hex;
  }

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

/** #rgb, #rgba, #rrggbb and #rrggbbaa. Null for anything else. */
function parseHex(color: string): [number, number, number, number] | null {
  const text = color.trim();
  if (text.charCodeAt(0) !== 35 /* # */) return null;
  const digits = text.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(digits)) return null;

  let parts: string[];
  if (digits.length === 3 || digits.length === 4) {
    // #rgb is #rrggbb: each digit doubles, so f is ff and not f0.
    parts = digits.split("").map((d) => d + d);
  } else if (digits.length === 6 || digits.length === 8) {
    parts = digits.match(/.{2}/g)!;
  } else {
    return null;
  }

  const [r, g, b, a = "ff"] = parts;
  return [
    parseInt(r, 16) / 255,
    parseInt(g, 16) / 255,
    parseInt(b, 16) / 255,
    parseInt(a, 16) / 255,
  ];
}
