/**
 * Copyright © 2026 ReactVision
 *
 * The pure halves of the VPS visual query and semantics: parsing what the
 * renderer answers for a query frame, the multipart body sent to
 * POST /vps/locations/query, choosing a candidate, and reading semantic.json.
 */
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: {
    rvGetAuthHeaders: async () => ({ mode: "none", baseUrl: null, headers: {}, projectId: null }),
  },
}));

import { parseVPSQueryFrame } from "../components/AR/ViroScanStatus";
import {
  base64ToBytes,
  buildQueryMultipart,
  localiseFrameOnServer,
  pickVisualCandidate,
  queryLocationsByImage,
} from "../components/AR/ViroVPSQuery";
import {
  bytesToBase64,
  fetchLocationSemanticObjects,
  parseSemanticObjects,
} from "../components/AR/ViroVPSMapDownload";

const creds = { projectId: "5eed0000-0000-4000-8000-000000000013", apiKey: "k" };

describe("parseVPSQueryFrame", () => {
  const good = { success: true, image: "/9j/4A==", width: 1280, height: 960, fx: 900, fy: 900, cx: 640, cy: 480 };

  it("passes a complete frame through", () => {
    expect(parseVPSQueryFrame(JSON.stringify(good))).toEqual(good);
  });

  it("keeps the renderer's reason for a failure", () => {
    expect(parseVPSQueryFrame(JSON.stringify({ success: false, error: "No AR scene" }))).toEqual({
      success: false,
      error: "No AR scene",
    });
  });

  it("never throws on missing, malformed or incomplete answers", () => {
    expect(parseVPSQueryFrame(undefined).success).toBe(false);
    expect(parseVPSQueryFrame("{").success).toBe(false);
    expect(parseVPSQueryFrame("null").success).toBe(false);
    expect(parseVPSQueryFrame(JSON.stringify({ ...good, image: "" })).success).toBe(false);
    expect(parseVPSQueryFrame(JSON.stringify({ ...good, fx: 0 })).success).toBe(false);
    expect(parseVPSQueryFrame(JSON.stringify({ ...good, cy: "480" })).success).toBe(false);
  });
});

describe("base64ToBytes", () => {
  it("round-trips with bytesToBase64 for every padding length", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 1000, 1001, 1002]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 2654435761) >>> 24;
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    }
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => base64ToBytes("ab$c")).toThrow();
  });
});

describe("buildQueryMultipart", () => {
  it("puts the fields first and the JPEG bytes unchanged in the image part", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x80, 0xff, 0xd9]);
    const body = buildQueryMultipart({ intrinsics: "1,2,3,4" }, jpeg, "B");
    const text = Buffer.from(body).toString("latin1");
    expect(text.startsWith('--B\r\nContent-Disposition: form-data; name="intrinsics"\r\n\r\n1,2,3,4\r\n')).toBe(true);
    expect(text).toContain('name="image"; filename="query.jpg"\r\nContent-Type: image/jpeg\r\n\r\n');
    expect(text.endsWith("\r\n--B--\r\n")).toBe(true);
    const start = text.indexOf("image/jpeg\r\n\r\n") + "image/jpeg\r\n\r\n".length;
    expect(Array.from(body.subarray(start, start + jpeg.length))).toEqual(Array.from(jpeg));
  });
});

describe("pickVisualCandidate", () => {
  it("takes the localised candidate with the most inliers, never an unlocalised one", () => {
    const c = (id: string, localised: boolean, inliers: number, score = 0.5) => ({
      location_id: id,
      scan_id: `s_${id}`,
      score,
      localised,
      inliers,
    });
    expect(pickVisualCandidate([])).toBeNull();
    expect(pickVisualCandidate([c("a", false, 0, 0.9)])).toBeNull();
    expect(pickVisualCandidate([c("a", false, 0, 0.9), c("b", true, 30), c("c", true, 57)])?.location_id).toBe("c");
  });
});

describe("vps-server requests", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("queryLocationsByImage posts the image and intrinsics, with the GPS prefilter when given", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ location_id: "l", scan_id: "s", score: 0.4, localised: true, inliers: 40 }] }),
      text: async () => "",
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const frame = { image: bytesToBase64(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), width: 4, height: 2, fx: 9, fy: 9, cx: 2, cy: 1 };

    const candidates = await queryLocationsByImage(frame, { lat: 19.4, lon: -99.1, radiusM: 500 }, { serverEndpoint: "https://vps.test/", endpoint: "https://vps.test/", credentials: creds });

    expect(candidates).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://vps.test/vps/locations/query");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("k");
    const boundary = headers["Content-Type"].split("boundary=")[1];
    const text = Buffer.from(init.body as Uint8Array).toString("latin1");
    expect(text).toContain(`--${boundary}\r\n`);
    expect(text).toContain('name="intrinsics"\r\n\r\n9,9,2,1\r\n');
    expect(text).toContain('name="lat"\r\n\r\n19.4\r\n');
    expect(text).toContain('name="radius_m"\r\n\r\n500\r\n');
  });

  it("localiseFrameOnServer sends the device id it is given, and none without one", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ location_id: "l", scan_id: "s", localised: false, inliers: 0, T_map_cam: null }),
      text: async () => "",
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const frame = { image: "AA==", width: 1, height: 1, fx: 1, fy: 1, cx: 0, cy: 0 };

    await localiseFrameOnServer("l", frame, undefined, "phone-1", { serverEndpoint: "https://vps.test", endpoint: "https://vps.test", credentials: creds });
    await localiseFrameOnServer("l", frame, undefined, undefined, { serverEndpoint: "https://vps.test", endpoint: "https://vps.test", credentials: creds });

    const headersOf = (i: number) =>
      (fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://vps.test/vps/locations/l/localise");
    expect(headersOf(0)["x-rv-device"]).toBe("phone-1");
    expect(headersOf(1)).not.toHaveProperty("x-rv-device");
  });

  it("queryLocationsByImage surfaces a server error", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 413,
      json: async () => ({}),
      text: async () => JSON.stringify({ error: { code: "TOO_LARGE", message: "image over 8 MB" } }),
    })) as unknown as typeof fetch;
    const frame = { image: "AA==", width: 1, height: 1, fx: 1, fy: 1, cx: 0, cy: 0 };
    await expect(queryLocationsByImage(frame, {}, { serverEndpoint: "https://vps.test", endpoint: "https://vps.test", credentials: creds })).rejects.toMatchObject({
      status: 413,
      code: "TOO_LARGE",
    });
  });

  it("fetchLocationSemanticObjects follows the signed link, and a scan without semantics is []", async () => {
    const semantic = {
      version: 1,
      frame: "map",
      objects: [
        { id: 0, label: "chair", confidence: 0.8, position: [1, 0.4, -2], bounds: { min: [0.8, 0, -2.2], max: [1.2, 0.9, -1.8] }, observations: 12 },
      ],
    };
    const fetchMock = jest.fn(async (url: string) =>
      url.endsWith("/semantic")
        ? { ok: true, status: 200, json: async () => ({ kind: "semantic", scan_id: "s", url: "https://vps.test/files/t", expires_at: 0, bytes: 10 }), text: async () => "" }
        : { ok: true, status: 200, json: async () => semantic, text: async () => "" }
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchLocationSemanticObjects("loc", { endpoint: "https://vps.test", credentials: creds })).resolves.toEqual(semantic.objects);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://vps.test/functions/v1/vps/locations/loc/semantic");
    expect((fetchMock.mock.calls[1] as unknown[])[0]).toBe("https://vps.test/files/t");

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => JSON.stringify({ error: { code: "NO_ASSET", message: "no semantic" } }),
    })) as unknown as typeof fetch;
    await expect(fetchLocationSemanticObjects("loc", { endpoint: "https://vps.test", credentials: creds })).resolves.toEqual([]);
  });
});

describe("parseSemanticObjects", () => {
  it("drops malformed entries and fills defaults", () => {
    const objects = parseSemanticObjects({
      objects: [
        { label: "tv", position: [0, 1, 2], bounds: { min: [0, 0, 0], max: [1, 1, 1] } },
        { label: "bad", position: [0, 1], bounds: { min: [0, 0, 0], max: [1, 1, 1] } },
        { position: [0, 1, 2], bounds: { min: [0, 0, 0], max: [1, 1, 1] } },
        null,
      ],
    });
    expect(objects).toEqual([
      { id: 0, label: "tv", confidence: 0, position: [0, 1, 2], bounds: { min: [0, 0, 0], max: [1, 1, 1] }, observations: 0 },
    ]);
    expect(parseSemanticObjects(null)).toEqual([]);
    expect(parseSemanticObjects({ objects: "x" })).toEqual([]);
  });
});
