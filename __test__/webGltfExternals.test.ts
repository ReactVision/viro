/**
 * A .gltf's external buffers and images, inlined before the wasm loader sees
 * the manifest: on web its own download of them is a pabort().
 */
import { inlineGltfExternals } from "../components/Web/viroModelLoader";

const OCTET = "data:application/octet-stream;base64,";
const encode = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
const decode = (b: Uint8Array) => JSON.parse(new TextDecoder().decode(b));

describe("inlineGltfExternals", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  function serve(files: Record<string, number[]>) {
    const fetchMock = jest.fn(async (url: string) => {
      const body = files[url];
      return body
        ? { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(body).buffer }
        : { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  test("inlines buffers and images found beside the model, percent-encoded names included", async () => {
    serve({
      "https://cdn.test/models/crate.bin": [1, 2, 3],
      "https://cdn.test/models/tex/crate%20wood.png": [4, 5],
    });
    const out = decode(
      await inlineGltfExternals(
        encode({ buffers: [{ uri: "crate.bin" }], images: [{ uri: "tex/crate%20wood.png" }] }),
        "https://cdn.test/models/crate.gltf?v=2",
      ),
    );
    expect(out.buffers[0].uri).toBe(OCTET + "AQID");
    expect(out.images[0].uri).toBe(OCTET + "BAU=");
  });

  test("takes a file from resources by name before fetching", async () => {
    const fetchMock = serve({});
    const out = decode(
      await inlineGltfExternals(
        encode({ buffers: [{ uri: "crate.bin" }] }),
        "https://cdn.test/crate.gltf",
        [{ name: "crate.bin", bytes: new Uint8Array([9]) }],
      ),
    );
    expect(out.buffers[0].uri).toBe(OCTET + "CQ==");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("leaves a self-contained file untouched", async () => {
    const bytes = encode({ buffers: [{ uri: OCTET + "AQID" }], images: [{ bufferView: 0 }] });
    expect(await inlineGltfExternals(bytes, "https://cdn.test/a.gltf")).toBe(bytes);
  });

  test("re-encodes a data URI tiny_gltf cannot decode", async () => {
    serve({ "data:image/webp;base64,AQID": [1, 2, 3] });
    const out = decode(
      await inlineGltfExternals(
        encode({ images: [{ uri: "data:image/webp;base64,AQID" }] }),
        "https://cdn.test/a.gltf",
      ),
    );
    expect(out.images[0].uri).toBe(OCTET + "AQID");
  });

  test("fails the model when a file is missing, as native does", async () => {
    serve({});
    await expect(
      inlineGltfExternals(encode({ buffers: [{ uri: "missing.bin" }] }), "https://cdn.test/a.gltf"),
    ).rejects.toThrow("https://cdn.test/missing.bin (404)");
  });
});
