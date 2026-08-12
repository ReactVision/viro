/**
 * Placeholder assets shared by main.tsx (the interactive demo) and render.tsx
 * (the headless render entry). render.tsx's require() shim hands these back
 * for any local `require('./assets/...')` in caller-supplied TSX, since the
 * files those paths point to don't exist in this harness.
 */
import helmetUrl from "./models/DamagedHelmet.glb?url";

export function makeCheckerDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const cells = 8;
  const s = canvas.width / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#ffffff" : "#3399ff";
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  return canvas.toDataURL();
}

/**
 * A tiny procedural animated GIF (2 frames, loops forever) as a data URL, to
 * exercise ViroAnimatedImage without shipping an asset. A yellow dot jumps
 * between the top and bottom halves of a blue field. Uses the "uncompressed"
 * GIF LZW scheme (fixed 9-bit codes + periodic clear codes) — the standard,
 * browser-decodable way to emit a GIF without a variable-width LZW encoder.
 */
export function makeAnimatedGifDataUrl(): string {
  const W = 32;
  const H = 32;
  const palette: number[][] = [];
  palette[0] = [0x22, 0x55, 0xcc]; // blue field
  palette[1] = [0xff, 0xdd, 0x44]; // yellow dot
  for (let i = 2; i < 256; i++) palette[i] = [0, 0, 0];

  const dotFrame = (cy: number): number[] => {
    const px: number[] = new Array(W * H).fill(0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (Math.hypot(x - W / 2, y - cy) < 5) px[y * W + x] = 1;
      }
    }
    return px;
  };
  const frames = [dotFrame(9), dotFrame(23)];

  // Fixed 9-bit LZW: emit literals only, clearing before the decoder's table
  // would force a width increase (keeps every code 9 bits — no bump bugs).
  const lzw = (indices: number[]): number[] => {
    const out: number[] = [];
    let cur = 0;
    let curBits = 0;
    const emit = (code: number) => {
      cur |= code << curBits;
      curBits += 9;
      while (curBits >= 8) {
        out.push(cur & 0xff);
        cur >>= 8;
        curBits -= 8;
      }
    };
    emit(256); // clear code
    let sinceClear = 0;
    for (let i = 0; i < indices.length; i++) {
      emit(indices[i]);
      if (++sinceClear === 250) {
        emit(256);
        sinceClear = 0;
      }
    }
    emit(257); // end-of-information
    if (curBits > 0) out.push(cur & 0xff);
    return out;
  };

  const b: number[] = [];
  const str = (s: string) => {
    for (const c of s) b.push(c.charCodeAt(0));
  };
  const word = (n: number) => b.push(n & 0xff, (n >> 8) & 0xff);

  str("GIF89a");
  word(W);
  word(H);
  b.push(0xf7, 0x00, 0x00); // global color table, 256 entries, 8-bit
  for (let i = 0; i < 256; i++) b.push(palette[i][0], palette[i][1], palette[i][2]);
  b.push(0x21, 0xff, 0x0b); // NETSCAPE2.0 looping extension
  str("NETSCAPE2.0");
  b.push(0x03, 0x01, 0x00, 0x00, 0x00); // loop forever

  for (const frame of frames) {
    b.push(0x21, 0xf9, 0x04, 0x00); // graphic control extension
    word(35); // ~0.35s delay
    b.push(0x00, 0x00);
    b.push(0x2c); // image descriptor
    word(0);
    word(0);
    word(W);
    word(H);
    b.push(0x00); // no local color table
    b.push(0x08); // LZW min code size
    const data = lzw(frame);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      b.push(chunk.length, ...chunk);
    }
    b.push(0x00); // block terminator
  }
  b.push(0x3b); // trailer

  let bin = "";
  for (const v of b) bin += String.fromCharCode(v);
  return "data:image/gif;base64," + btoa(bin);
}

export const PLACEHOLDER_MODEL_URL = helmetUrl;
