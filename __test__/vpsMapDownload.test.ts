/**
 * bytesToBase64() is a pure function with no native/bridge dependency, so its
 * output can be checked directly here, against the RFC 4648 test vectors.
 */
import { bytesToBase64 } from "../components/AR/ViroVPSMapDownload";

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

describe("bytesToBase64", () => {
  it("matches the RFC 4648 test vectors", () => {
    expect(bytesToBase64(asciiBytes(""))).toBe("");
    expect(bytesToBase64(asciiBytes("f"))).toBe("Zg==");
    expect(bytesToBase64(asciiBytes("fo"))).toBe("Zm8=");
    expect(bytesToBase64(asciiBytes("foo"))).toBe("Zm9v");
    expect(bytesToBase64(asciiBytes("foob"))).toBe("Zm9vYg==");
    expect(bytesToBase64(asciiBytes("fooba"))).toBe("Zm9vYmE=");
    expect(bytesToBase64(asciiBytes("foobar"))).toBe("Zm9vYmFy");
  });

  it("round-trips arbitrary byte values, including 0x00 and 0xff", () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x10, 0x80, 0x7f, 0x01, 0x02]);
    const decoded = Buffer.from(bytesToBase64(bytes), "base64");
    expect(new Uint8Array(decoded)).toEqual(bytes);
  });

  it("matches Buffer's encoding across chunk boundaries, for every padding length", () => {
    for (const len of [3 * 16384 - 1, 3 * 16384, 3 * 16384 + 1, 3 * 16384 + 2, 200001]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 2654435761) >>> 24;
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
  });
});
