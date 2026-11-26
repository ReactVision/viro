/**
 * The GIF decoder used where the browser's ImageDecoder cannot play a GIF.
 *
 * The GIFs are written here by an encoder that grows its code width as real
 * encoders do, so a decoder that grows a code early or late reads garbage.
 */
import { decodeGif, isGif } from "../components/Web/viroGifDecoder";

type Rgb = [number, number, number];
type TestFrame = {
  left?: number;
  top?: number;
  width: number;
  height: number;
  indices: number[];
  disposal?: number;
  transparent?: number;
  delay?: number;
  palette?: Rgb[];
  interlaced?: boolean;
};

function lzwEncode(indices: number[], min: number): number[] {
  const clear = 1 << min;
  const end = clear + 1;
  let size = min + 1;
  let next = end + 1;
  const dict = new Map<number, number>();
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  const emit = (code: number) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      bytes.push(acc & 255);
      acc >>>= 8;
      bits -= 8;
    }
  };
  // The decoder adds an entry one code later than this, so it grows on the same code.
  const grow = () => {
    if (next >= 1 << size && size < 12) size++;
  };
  emit(clear);
  let prefix = indices[0]!;
  for (const k of indices.slice(1)) {
    const key = prefix * 256 + k;
    const known = dict.get(key);
    if (known !== undefined) {
      prefix = known;
      continue;
    }
    emit(prefix);
    grow();
    if (next < 4096) dict.set(key, next++);
    prefix = k;
  }
  emit(prefix);
  grow();
  emit(end);
  if (bits > 0) bytes.push(acc & 255);
  return bytes;
}

function paletteBytes(colours: Rgb[]): { bits: number; bytes: number[] } {
  let bits = 1;
  while (1 << bits < colours.length) bits++;
  const bytes: number[] = [];
  for (let i = 0; i < 1 << bits; i++) bytes.push(...(colours[i] ?? [0, 0, 0]));
  return { bits, bytes };
}

function buildGif(width: number, height: number, global: Rgb[], frames: TestFrame[], loop?: number): Uint8Array {
  const out: number[] = [...Buffer.from("GIF89a")];
  const u16 = (v: number) => [v & 255, v >> 8];
  const g = paletteBytes(global);
  out.push(...u16(width), ...u16(height), 0x80 | (g.bits - 1), 0, 0, ...g.bytes);
  if (loop !== undefined) out.push(0x21, 0xff, 11, ...Buffer.from("NETSCAPE2.0"), 3, 1, ...u16(loop), 0);
  for (const f of frames) {
    const flags = ((f.disposal ?? 0) << 2) | (f.transparent !== undefined ? 1 : 0);
    out.push(0x21, 0xf9, 4, flags, ...u16(f.delay ?? 10), f.transparent ?? 0, 0);
    const local = f.palette ? paletteBytes(f.palette) : null;
    const packed = (local ? 0x80 | (local.bits - 1) : 0) | (f.interlaced ? 0x40 : 0);
    out.push(0x2c, ...u16(f.left ?? 0), ...u16(f.top ?? 0), ...u16(f.width), ...u16(f.height), packed);
    if (local) out.push(...local.bytes);
    const min = Math.max(2, local?.bits ?? g.bits);
    const data = lzwEncode(f.indices, min);
    out.push(min);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0);
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}

const RED: Rgb = [255, 0, 0];
const GREEN: Rgb = [0, 255, 0];
const BLUE: Rgb = [0, 0, 255];
const WHITE: Rgb = [255, 255, 255];
const CLEAR = [0, 0, 0, 0];
const px = (pixels: Uint8ClampedArray, width: number, x: number, y: number) =>
  Array.from(pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));
const opaque = (c: Rgb) => [...c, 255];

describe("decodeGif", () => {
  test("reads codes as their width grows, and the code being defined", () => {
    const palette: Rgb[] = [RED, GREEN, BLUE, WHITE];
    let seed = 7;
    const noise = Array.from({ length: 256 }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed >> 16) & 3;
    });
    // A run of one index is coded mostly as the code still being defined.
    const run = new Array(256).fill(2);
    for (const indices of [noise, run]) {
      const gif = decodeGif(buildGif(16, 16, palette, [{ width: 16, height: 16, indices }]));
      const pixels = gif.render(0);
      indices.forEach((p, i) => expect(px(pixels, 16, i % 16, i >> 4)).toEqual(opaque(palette[p]!)));
    }
  });

  test("applies offsets, transparency and each disposal method", () => {
    const gif = decodeGif(
      buildGif(4, 4, [RED, GREEN, BLUE, WHITE], [
        { width: 4, height: 4, indices: new Array(16).fill(0), disposal: 1 },
        // Index 3 is transparent here, so the red under it shows.
        { left: 1, top: 1, width: 2, height: 2, indices: [1, 1, 1, 3], disposal: 2, transparent: 3 },
        { width: 1, height: 1, indices: [2], disposal: 3 },
        { left: 3, top: 3, width: 1, height: 1, indices: [3], disposal: 0 },
      ]),
    );
    expect(gif.frameCount).toBe(4);

    let p = gif.render(0);
    expect(px(p, 4, 2, 2)).toEqual(opaque(RED));

    p = gif.render(1);
    expect(px(p, 4, 1, 1)).toEqual(opaque(GREEN));
    expect(px(p, 4, 2, 2)).toEqual(opaque(RED));
    expect(px(p, 4, 0, 0)).toEqual(opaque(RED));

    // Frame 1 restores its rectangle to the background, which browsers draw as transparent.
    p = gif.render(2);
    expect(px(p, 4, 1, 1)).toEqual(CLEAR);
    expect(px(p, 4, 2, 2)).toEqual(CLEAR);
    expect(px(p, 4, 0, 0)).toEqual(opaque(BLUE));
    expect(px(p, 4, 3, 0)).toEqual(opaque(RED));

    // Frame 2 restores what was under it.
    p = gif.render(3);
    expect(px(p, 4, 0, 0)).toEqual(opaque(RED));
    expect(px(p, 4, 1, 1)).toEqual(CLEAR);
    expect(px(p, 4, 3, 3)).toEqual(opaque(WHITE));

    // Looping back starts from an empty image.
    p = gif.render(0);
    expect(px(p, 4, 1, 1)).toEqual(opaque(RED));
    expect(px(p, 4, 3, 3)).toEqual(opaque(RED));
  });

  test("uses a frame's own colour table over the global one", () => {
    const gif = decodeGif(buildGif(1, 1, [RED, GREEN], [{ width: 1, height: 1, indices: [1], palette: [BLUE, WHITE] }]));
    expect(px(gif.render(0), 1, 0, 0)).toEqual(opaque(WHITE));
  });

  test("puts interlaced rows back in order", () => {
    const palette: Rgb[] = [[0, 0, 0], [10, 0, 0], [20, 0, 0], [30, 0, 0], [40, 0, 0], [50, 0, 0], [60, 0, 0], [70, 0, 0]];
    // Rows are stored 0, 4, 2, 6, 1, 3, 5, 7; row r is palette index r.
    const gif = decodeGif(buildGif(1, 8, palette, [{ width: 1, height: 8, indices: [0, 4, 2, 6, 1, 3, 5, 7], interlaced: true }]));
    const p = gif.render(0);
    for (let y = 0; y < 8; y++) expect(px(p, 1, 0, y)).toEqual(opaque(palette[y]!));
  });

  test("plays a delay of 0 or 1 hundredths as 100 ms, and reads the loop count", () => {
    const frame = (delay: number): TestFrame => ({ width: 1, height: 1, indices: [0], delay });
    const gif = decodeGif(buildGif(1, 1, [RED, GREEN], [frame(0), frame(1), frame(2), frame(25)], 3));
    expect(gif.delays).toEqual([100, 100, 20, 250]);
    expect(gif.loopCount).toBe(3);
    expect(decodeGif(buildGif(1, 1, [RED, GREEN], [frame(5)], 0)).loopCount).toBe(0);
    expect(decodeGif(buildGif(1, 1, [RED, GREEN], [frame(5)])).loopCount).toBeNull();
  });

  test("keeps the frames of a file cut short, and refuses what is not a GIF", () => {
    const whole = buildGif(2, 1, [RED, GREEN], [
      { width: 2, height: 1, indices: [0, 0] },
      { width: 2, height: 1, indices: [1, 1] },
    ]);
    const cut = decodeGif(whole.subarray(0, whole.length - 4));
    expect(cut.frameCount).toBe(2);
    expect(() => cut.render(1)).not.toThrow();
    expect(px(cut.render(0), 2, 1, 0)).toEqual(opaque(RED));

    expect(isGif(whole)).toBe(true);
    expect(isGif(Buffer.from("\x89PNG\r\n"))).toBe(false);
    expect(() => decodeGif(Buffer.from("\x89PNG\r\n\x1a\n0000000"))).toThrow("not a GIF");
  });
});
