/**
 * A GIF decoder for browsers whose ImageDecoder is missing or cannot read GIF.
 * Every browser hands a canvas the same frame of an animated <img>, so the
 * frames have to come from the file itself.
 *
 * The blocks are parsed once; each frame is LZW-decoded when it is shown and
 * drawn onto one RGBA image the size of the GIF, so memory stays at two such
 * images however many frames the file has.
 */
export type GifAnimation = {
  width: number;
  height: number;
  frameCount: number;
  /** Per frame, in ms. */
  delays: number[];
  /** From the NETSCAPE2.0 block: 0 repeats forever, null (no block) plays once. */
  loopCount: number | null;
  /**
   * The image after frames 0 to `index`, as RGBA `width` x `height`. The same
   * array every call, so read it before the next. Cheapest called in order.
   */
  render(index: number): Uint8ClampedArray;
};

type Frame = {
  left: number;
  top: number;
  width: number;
  height: number;
  palette: Uint8Array | null;
  transparent: number;
  disposal: number;
  interlaced: boolean;
  minCodeSize: number;
  /** [start, end) of each image data sub-block. */
  blocks: [number, number][];
};

const NO_CONTROL = { delay: 0, disposal: 0, transparent: -1 };

export function isGif(data: Uint8Array): boolean {
  // "GIF87a" or "GIF89a".
  return (
    data.length >= 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38 &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  );
}

/** Throws when the data is not a GIF; a file cut short keeps the frames it has. */
export function decodeGif(data: Uint8Array): GifAnimation {
  if (!isGif(data) || data.length < 13) throw new Error("not a GIF");
  const u16 = (at: number) => data[at]! | (data[at + 1]! << 8);
  const width = u16(6);
  const height = u16(8);
  let pos = 13;
  const readPalette = (packed: number) => {
    if (!(packed & 0x80)) return null;
    const size = 3 << ((packed & 7) + 1);
    pos += size;
    return data.subarray(pos - size, pos);
  };
  const subBlocks = () => {
    const out: [number, number][] = [];
    while (pos < data.length) {
      const size = data[pos++]!;
      if (size === 0) break;
      out.push([pos, Math.min(pos + size, data.length)]);
      pos += size;
    }
    return out;
  };
  const globalPalette = readPalette(data[10]!);

  const frames: Frame[] = [];
  const delays: number[] = [];
  let loopCount: number | null = null;
  // A graphic control extension applies to the next image only.
  let control = NO_CONTROL;

  parse: while (pos < data.length) {
    switch (data[pos++]) {
      case 0x21: {
        const label = data[pos++];
        const blocks = subBlocks();
        const [s, e] = blocks[0] ?? [0, 0];
        if (label === 0xf9 && e - s >= 4) {
          control = {
            delay: u16(s + 1),
            disposal: (data[s]! >> 2) & 7,
            transparent: data[s]! & 1 ? data[s + 3]! : -1,
          };
        } else if (label === 0xff && e - s === 11) {
          const app = String.fromCharCode(...data.subarray(s, e));
          const sub = blocks[1];
          if ((app === "NETSCAPE2.0" || app === "ANIMEXTS1.0") && sub && sub[1] - sub[0] >= 3 && data[sub[0]] === 1) {
            loopCount = u16(sub[0] + 1);
          }
        }
        break;
      }
      case 0x2c: {
        if (pos + 10 > data.length) break parse;
        const d = pos;
        pos += 9;
        const palette = readPalette(data[d + 8]!) ?? globalPalette;
        const minCodeSize = data[pos++]!;
        frames.push({
          left: u16(d),
          top: u16(d + 2),
          width: u16(d + 4),
          height: u16(d + 6),
          palette,
          transparent: control.transparent,
          // 4 to 7 are undefined; browsers treat them as 0.
          disposal: control.disposal < 4 ? control.disposal : 0,
          interlaced: (data[d + 8]! & 0x40) !== 0,
          minCodeSize,
          blocks: subBlocks(),
        });
        // As browsers do: a delay of 0 or 1 hundredths plays as 10.
        delays.push((control.delay <= 1 ? 10 : control.delay) * 10);
        control = NO_CONTROL;
        break;
      }
      default:
        // 0x3b is the trailer; any other byte means the file is broken from here.
        break parse;
    }
  }
  if (frames.length === 0) throw new Error("GIF has no frames");

  // Allocated by the first render, since a caller may only want the frame count.
  let pixels = new Uint8ClampedArray(0);
  let previous = pixels;
  let indices = new Uint8Array(0);
  let drawn = -1;

  const dispose = (fr: Frame) => {
    if (fr.disposal === 3) {
      pixels.set(previous);
    } else if (fr.disposal === 2) {
      // Browsers clear to transparent rather than to the background colour.
      const x1 = Math.min(width, fr.left + fr.width);
      const y1 = Math.min(height, fr.top + fr.height);
      for (let y = fr.top; y < y1; y++) pixels.fill(0, (y * width + fr.left) * 4, (y * width + x1) * 4);
    }
  };

  const draw = (fr: Frame) => {
    if (fr.disposal === 3) previous.set(pixels);
    const palette = fr.palette;
    if (!palette) return;
    const written = lzw(data, fr.blocks, fr.minCodeSize, indices.subarray(0, fr.width * fr.height));
    const colours = palette.length / 3;
    let row = 0;
    let pass = 0;
    let step = fr.interlaced ? 8 : 1;
    for (let r = 0; r < fr.height; r++) {
      const y = fr.top + row;
      for (let c = 0; c < fr.width && y < height; c++) {
        const i = r * fr.width + c;
        if (i >= written) return;
        const x = fr.left + c;
        const p = indices[i]!;
        if (x >= width || p === fr.transparent || p >= colours) continue;
        const o = (y * width + x) * 4;
        pixels[o] = palette[p * 3]!;
        pixels[o + 1] = palette[p * 3 + 1]!;
        pixels[o + 2] = palette[p * 3 + 2]!;
        pixels[o + 3] = 255;
      }
      row += step;
      // Interlaced rows come in four passes: every 8th from 0, every 8th from 4, every 4th from 2, every 2nd from 1.
      while (fr.interlaced && row >= fr.height && pass < 3) {
        pass++;
        row = [0, 4, 2, 1][pass]!;
        step = [8, 8, 4, 2][pass]!;
      }
    }
  };

  const render = (index: number) => {
    const target = Math.min(Math.max(index, 0), frames.length - 1);
    if (pixels.length !== width * height * 4) {
      pixels = new Uint8ClampedArray(width * height * 4);
      previous = new Uint8ClampedArray(width * height * 4);
      indices = new Uint8Array(frames.reduce((m, f) => Math.max(m, f.width * f.height), 0));
    }
    if (target < drawn) {
      pixels.fill(0);
      drawn = -1;
    }
    while (drawn < target) {
      if (drawn >= 0) dispose(frames[drawn]!);
      draw(frames[++drawn]!);
    }
    return pixels;
  };

  return { width, height, frameCount: frames.length, delays, loopCount, render };
}

/** Decodes into `out` and returns how many indices it wrote. */
function lzw(data: Uint8Array, blocks: [number, number][], minCodeSize: number, out: Uint8Array): number {
  const min = Math.min(Math.max(minCodeSize, 2), 11);
  const clear = 1 << min;
  const end = clear + 1;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  let size = min + 1;
  let next = end + 1;
  let old = -1;
  let n = 0;
  let bits = 0;
  let acc = 0;
  for (const [s, e] of blocks) {
    for (let b = s; b < e; b++) {
      acc |= data[b]! << bits;
      bits += 8;
      while (bits >= size) {
        const code = acc & ((1 << size) - 1);
        acc >>>= size;
        bits -= size;
        if (code === clear) {
          size = min + 1;
          next = end + 1;
          old = -1;
          continue;
        }
        if (code === end) return n;
        if (old === -1) {
          if (code > clear) return n;
          if (n < out.length) out[n++] = code;
          old = code;
          continue;
        }
        if (code > next) return n;
        // code === next is the string being defined: the previous one plus its own first byte.
        const pending = code === next;
        let sp = pending ? 1 : 0;
        let c = pending ? old : code;
        while (c >= clear) {
          stack[sp++] = suffix[c]!;
          c = prefix[c]!;
        }
        stack[sp++] = c;
        if (pending) stack[0] = c;
        if (next < 4096) {
          prefix[next] = old;
          suffix[next] = c;
          next++;
          if (next === 1 << size && size < 12) size++;
        }
        while (sp > 0 && n < out.length) out[n++] = stack[--sp]!;
        if (n >= out.length) return n;
        old = code;
      }
    }
  }
  return n;
}
