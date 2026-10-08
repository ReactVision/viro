/**
 * buildStoredZip()/crc32() are pure functions with no native/file-system
 * dependency, so — unlike the upload orchestration in the same module, which
 * needs a real recording on a device to exercise — their output can be
 * checked directly here: CRC32 against the textbook "123456789" check value,
 * and the zip's own structure (signatures, sizes, offsets) by hand-parsing
 * the bytes buildStoredZip() produced.
 */
import { buildStoredZip, crc32 } from "../components/AR/ViroVPSScanUpload";

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

describe("crc32", () => {
  it("matches the standard CRC-32 check value", () => {
    // The textbook check value for the CRC-32 (zip/gzip) polynomial.
    expect(crc32(asciiBytes("123456789"))).toBe(0xcbf43926);
  });

  it("is 0 for empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("buildStoredZip", () => {
  it("writes a local file header, raw data and a central directory per entry", () => {
    const a = { name: "session.jsonl", data: asciiBytes('{"type":"header"}\n') };
    const b = { name: "video.mp4", data: new Uint8Array([1, 2, 3, 4, 5]) };
    const zip = buildStoredZip([a, b], new Date(2026, 0, 15, 10, 30, 0));

    // First local file header.
    expect(readUint32LE(zip, 0)).toBe(0x04034b50);
    expect(readUint16LE(zip, 8)).toBe(0); // stored, no compression
    const crcA = readUint32LE(zip, 14);
    expect(crcA).toBe(crc32(a.data));
    const sizeA = readUint32LE(zip, 22);
    expect(sizeA).toBe(a.data.length);
    const nameLenA = readUint16LE(zip, 26);
    expect(nameLenA).toBe(a.name.length);

    const nameAStart = 30;
    const nameA = Buffer.from(zip.slice(nameAStart, nameAStart + nameLenA)).toString("ascii");
    expect(nameA).toBe(a.name);

    const dataAStart = nameAStart + nameLenA;
    expect(Array.from(zip.slice(dataAStart, dataAStart + a.data.length))).toEqual(
      Array.from(a.data)
    );

    // Second local file header starts right after the first entry's data.
    const secondHeaderOffset = dataAStart + a.data.length;
    expect(readUint32LE(zip, secondHeaderOffset)).toBe(0x04034b50);
    const nameLenB = readUint16LE(zip, secondHeaderOffset + 26);
    expect(nameLenB).toBe(b.name.length);
    const nameBStart = secondHeaderOffset + 30;
    const dataBStart = nameBStart + nameLenB;
    expect(Array.from(zip.slice(dataBStart, dataBStart + b.data.length))).toEqual(
      Array.from(b.data)
    );

    // End of central directory record is the last 22 bytes.
    const eocdOffset = zip.length - 22;
    expect(readUint32LE(zip, eocdOffset)).toBe(0x06054b50);
    const totalEntries = readUint16LE(zip, eocdOffset + 10);
    expect(totalEntries).toBe(2);
    const cdSize = readUint32LE(zip, eocdOffset + 12);
    const cdOffset = readUint32LE(zip, eocdOffset + 16);
    expect(cdOffset + cdSize).toBe(eocdOffset);

    // Central directory's first record points back at the first local header.
    expect(readUint32LE(zip, cdOffset)).toBe(0x02014b50);
    const firstLocalHeaderOffsetFromCd = readUint32LE(zip, cdOffset + 42);
    expect(firstLocalHeaderOffsetFromCd).toBe(0);
  });

  it("produces an empty-but-valid archive for no entries", () => {
    const zip = buildStoredZip([]);
    expect(zip.length).toBe(22); // just the EOCD record
    expect(readUint32LE(zip, 0)).toBe(0x06054b50);
  });
});
