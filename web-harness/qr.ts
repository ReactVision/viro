/**
 * A QR code for a short URL: byte mode, error correction level L, versions 1
 * to 10 (up to 271 bytes). Returns the modules as rows, true for dark, or null
 * when the text does not fit.
 */
const ECC_PER_BLOCK = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const BLOCKS = [1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
const RAW_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const ALIGNMENT = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function eccOf(data: number[], degree: number): number[] {
  const divisor = new Array<number>(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = gfMul(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = gfMul(root, 2);
  }
  const out = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ out.shift()!;
    out.push(0);
    divisor.forEach((coef, i) => (out[i] ^= gfMul(coef, factor)));
  }
  return out;
}

function codewords(bytes: Uint8Array, version: number): number[] {
  const blocks = BLOCKS[version - 1];
  const ecc = ECC_PER_BLOCK[version - 1];
  const raw = RAW_CODEWORDS[version - 1];
  const capacity = raw - ecc * blocks;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, capacity * 8 - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);

  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const split: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const part = data.slice(k, k + shortLen - ecc + (i < shortBlocks ? 0 : 1));
    k += part.length;
    const check = eccOf(part, ecc);
    if (i < shortBlocks) part.push(0);
    split.push(part.concat(check));
  }
  const out: number[] = [];
  for (let i = 0; i < split[0].length; i++) {
    split.forEach((block, j) => {
      // The padding byte of a short block is not part of the code.
      if (i !== shortLen - ecc || j >= shortBlocks) out.push(block[i]);
    });
  }
  return out;
}

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// Runs of five or more, 2x2 blocks and the dark/light balance; the finder-like
// pattern rule is left out, which only ever costs a slightly worse mask.
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  let dark = 0;
  for (let a = 0; a < n; a++) {
    for (const line of [m[a], m.map((row) => row[a])]) {
      let run = 1;
      for (let b = 1; b <= n; b++) {
        if (b < n && line[b] === line[b - 1]) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
    }
    for (let b = 0; b < n; b++) {
      if (m[a][b]) dark++;
      if (a + 1 < n && b + 1 < n && m[a][b] === m[a][b + 1] && m[a][b] === m[a + 1][b] && m[a][b] === m[a + 1][b + 1]) score += 3;
    }
  }
  return score + Math.floor(Math.abs((dark * 20) / (n * n) - 10)) * 10;
}

export function qrModules(text: string): boolean[][] | null {
  const bytes = new TextEncoder().encode(text);
  const version = RAW_CODEWORDS.findIndex(
    (raw, i) => bytes.length <= raw - ECC_PER_BLOCK[i] * BLOCKS[i] - (i < 9 ? 2 : 3),
  ) + 1;
  if (!version) return null;
  const n = 17 + 4 * version;
  const fixed = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const base = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const set = (grid: boolean[][], x: number, y: number, dark: boolean) => {
    grid[y][x] = dark;
    fixed[y][x] = true;
  };

  for (let i = 0; i < n; i++) {
    set(base, 6, i, i % 2 === 0);
    set(base, i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < n && y >= 0 && y < n) set(base, x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  const align = ALIGNMENT[version - 1];
  align.forEach((cx, i) =>
    align.forEach((cy, j) => {
      const last = align.length - 1;
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) set(base, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }),
  );
  const formatInto = (grid: boolean[][], mask: number) => {
    const data = (1 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(grid, 8, i, bit(i));
    set(grid, 8, 7, bit(6));
    set(grid, 8, 8, bit(7));
    set(grid, 7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(grid, 14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(grid, n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(grid, 8, n - 15 + i, bit(i));
    set(grid, 8, n - 8, true);
  };
  // Reserves the format modules before the data is laid around them.
  formatInto(base, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = n - 11 + (i % 3), b = Math.floor(i / 3);
      set(base, a, b, dark);
      set(base, b, a, dark);
    }
  }

  const data = codewords(bytes, version);
  let at = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!fixed[y][x] && at < data.length * 8) {
          base[y][x] = ((data[at >>> 3] >>> (7 - (at & 7))) & 1) !== 0;
          at++;
        }
      }
    }
  }

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  MASKS.forEach((flip, mask) => {
    const grid = base.map((row, y) => row.map((dark, x) => (fixed[y][x] ? dark : dark !== flip(x, y))));
    formatInto(grid, mask);
    const score = penalty(grid);
    if (score < bestScore) {
      best = grid;
      bestScore = score;
    }
  });
  return best;
}
