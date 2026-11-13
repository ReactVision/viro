// Writes web-harness/placeholderBox.glb, the stand-in the harness draws for a
// local model it was not given: a 1 m cube in the image stand-in's checker,
// each cell a quarter of a side, with the front (+Z, glTF's front) orange and
// an arrow on it pointing up.
//
//   node scripts/make-harness-placeholder.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SIZE = 64;

function crc32(bytes) {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(pixelAt) {
  const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) raw.set(pixelAt(x, y), y * (SIZE * 3 + 1) + 1 + x * 3);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const WHITE = [0xff, 0xff, 0xff];
const BLUE = [0x33, 0x99, 0xff];
const ORANGE = [0xff, 0x88, 0x00];
const checker = png((x, y) => ((x >> 4) + (y >> 4)) % 2 ? WHITE : BLUE);
const front = png((x, y) => {
  const head = y >= 10 && y < 34 && Math.abs(x - 31.5) <= (y - 10) * 0.75;
  const shaft = y >= 34 && y < 54 && x >= 26 && x < 38;
  return head || shaft ? WHITE : ORANGE;
});

// Each face: its normal, then its corners counter-clockwise from outside, starting bottom-left.
const FACES = [
  [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
  [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
  [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
  [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
  [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
];
const UVS = [[0, 1], [1, 1], [1, 0], [0, 0]];

const parts = [];
const bufferViews = [];
const accessors = [];
let length = 0;
function view(bytes, target) {
  bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, ...(target ? { target } : {}) });
  const padded = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);
  parts.push(padded);
  length += padded.length;
  return bufferViews.length - 1;
}
function accessor(values, type, componentType, target, bounds) {
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
  const bytes = componentType === 5126 ? Buffer.from(new Float32Array(values).buffer) : Buffer.from(new Uint16Array(values).buffer);
  accessors.push({ bufferView: view(bytes, target), componentType, count: values.length / width, type, ...bounds });
  return accessors.length - 1;
}
function primitive(faces, material) {
  const positions = [], normals = [], uvs = [], indices = [];
  faces.forEach(([normal, ...corners], f) => {
    corners.forEach((corner, i) => {
      positions.push(...corner.map((c) => c / 2));
      normals.push(...normal);
      uvs.push(...UVS[i]);
    });
    indices.push(...[0, 1, 2, 0, 2, 3].map((i) => f * 4 + i));
  });
  return {
    attributes: {
      POSITION: accessor(positions, "VEC3", 5126, 34962, { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] }),
      NORMAL: accessor(normals, "VEC3", 5126, 34962),
      TEXCOORD_0: accessor(uvs, "VEC2", 5126, 34962),
    },
    indices: accessor(indices, "SCALAR", 5123, 34963),
    material,
  };
}

const primitives = [primitive(FACES.slice(1), 0), primitive(FACES.slice(0, 1), 1)];
const images = [checker, front].map((bytes) => ({ mimeType: "image/png", bufferView: view(bytes) }));
const material = (index) => ({ pbrMetallicRoughness: { baseColorTexture: { index }, metallicFactor: 0, roughnessFactor: 0.9 } });
const json = {
  asset: { version: "2.0", generator: "viro web-harness placeholder" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "placeholder" }],
  meshes: [{ primitives }],
  materials: [material(0), material(1)],
  textures: [{ source: 0, sampler: 0 }, { source: 1, sampler: 0 }],
  // Nearest, so the cells keep hard edges and no mipmaps are needed.
  samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
  images,
  accessors,
  bufferViews,
  buffers: [{ byteLength: length }],
};

let text = Buffer.from(JSON.stringify(json));
text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
const bin = Buffer.concat(parts);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
const chunkHeader = (size, type) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(size, 0);
  h.writeUInt32LE(type, 4);
  return h;
};
const out = new URL("../web-harness/placeholderBox.glb", import.meta.url);
writeFileSync(out, Buffer.concat([header, chunkHeader(text.length, 0x4e4f534a), text, chunkHeader(bin.length, 0x004e4942), bin]));
console.log(`wrote web-harness/placeholderBox.glb (${12 + 16 + text.length + bin.length} bytes)`);
