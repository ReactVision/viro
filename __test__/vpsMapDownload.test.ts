/**
 * bytesToBase64() is a pure function with no native/bridge dependency, so its
 * output can be checked directly here, against the RFC 4648 test vectors.
 */
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: {
    rvGetAuthHeaders: async () => ({ mode: "none", baseUrl: null, headers: {}, projectId: null }),
  },
}));

import {
  bytesToBase64,
  fetchMapBytes,
  findNearbyLocations,
  getLocationMapDownload,
  getLocationWorldMeshDownload,
} from "../components/AR/ViroVPSMapDownload";
import {
  VPS_REQUEST_TIMEOUT_MS,
  ViroVPSError,
  vpsDownloadTimeoutMs,
} from "../components/AR/ViroVPSClient";

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


describe("VPS requests", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  function respond(status: number, body: unknown) {
    const fetchMock = jest.fn(async () => ({
      ok: status < 400,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }
  const creds = { projectId: "5eed0000-0000-4000-8000-000000000013", apiKey: "k" };

  it("findNearbyLocations unwraps the backend's { locations } body", async () => {
    const loc = { id: "a", name: "Hall", lat: 1, lon: 2, active_scan_id: "s", distance_m: 3, created_at: 0 };
    respond(200, { locations: [loc] });
    await expect(findNearbyLocations(1, 2, undefined, undefined, { endpoint: "https://vps.test", credentials: creds })).resolves.toEqual([loc]);
  });

  it("asks for the world mesh by its asset kind, and surfaces a missing one as 404", async () => {
    const fetchMock = respond(200, { kind: "world_mesh", scan_id: "s", url: "u", expires_at: 0, bytes: 4 });
    await getLocationWorldMeshDownload("loc a", { endpoint: "https://vps.test/", credentials: creds });
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://vps.test/functions/v1/vps/locations/loc%20a/world_mesh");
    respond(404, { error: { code: "NO_ASSET", message: "the location has no active world_mesh" } });
    await expect(getLocationWorldMeshDownload("x", { endpoint: "https://vps.test", credentials: creds })).rejects.toMatchObject({
      status: 404,
    });
    await expect(getLocationWorldMeshDownload("x", { endpoint: "https://vps.test", credentials: creds })).rejects.toBeInstanceOf(
      ViroVPSError
    );
  });

  it("calls a credentials function for every request, and sends appUserId as x-app-user-id", async () => {
    const fetchMock = respond(200, { kind: "map", scan_id: "s", url: "u", expires_at: 0, bytes: 3, quality: null });
    let n = 0;
    const provider = jest.fn(async () => ({ projectId: "p", accessToken: `t${++n}`, appUserId: "user-1" }));
    await getLocationMapDownload("a", { endpoint: "https://vps.test", credentials: provider });
    await getLocationMapDownload("a", { endpoint: "https://vps.test", credentials: provider });
    await getLocationMapDownload("a", { endpoint: "https://vps.test", credentials: { ...creds, appUserId: "" } });

    expect(provider).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map((c) => ((c as unknown[])[1] as RequestInit).headers)).toEqual([
      { "x-project-id": "p", Authorization: "Bearer t1", "x-app-user-id": "user-1" },
      { "x-project-id": "p", Authorization: "Bearer t2", "x-app-user-id": "user-1" },
      { "x-project-id": creds.projectId, "x-api-key": "k" },
    ]);
  });

  it("refuses an appUserId Studio would refuse, or a failing credentials function, before any request", async () => {
    const fetchMock = respond(200, {});
    // 600 header bytes once UTF-8 encoded, though only 200 UTF-16 units.
    const cjk = "用".repeat(200);
    for (const appUserId of ["u".repeat(256), "josé", cjk, "a b", "tab\there", ".", ".."]) {
      await expect(
        getLocationMapDownload("a", { endpoint: "https://vps.test", credentials: { ...creds, appUserId } })
      ).rejects.toMatchObject({ code: "INVALID_APP_USER_ID", status: undefined });
    }
    await expect(
      getLocationMapDownload("a", { endpoint: "https://vps.test", credentials: async () => Promise.reject(new Error("signed out")) })
    ).rejects.toMatchObject({ code: "CREDENTIALS_UNAVAILABLE", message: "Could not get VPS credentials: signed out" });
    expect(fetchMock).not.toHaveBeenCalled();

    for (const appUserId of ["~".repeat(255), "...", "auth0|5f7c@example.com"]) {
      await findNearbyLocations(1, 2, undefined, undefined, { endpoint: "https://vps.test", credentials: { ...creds, appUserId } });
    }
    const headers = fetchMock.mock.calls.map((c) => ((c as unknown[])[1] as any).headers);
    expect(headers.map((h) => h["x-app-user-id"])).toEqual([
      "~".repeat(255),
      "...",
      "auth0|5f7c@example.com",
    ]);
  });

  it("reports a request that got no response as NETWORK_ERROR, with no status", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    await expect(findNearbyLocations(1, 2, undefined, undefined, { endpoint: "https://vps.test", credentials: creds })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: undefined,
      message: "Network request failed",
    });
  });

  it("gives up on a request with no answer in time, as NETWORK_ERROR", async () => {
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")))
          )
      ) as unknown as typeof fetch;
      const pending = findNearbyLocations(1, 2, undefined, undefined, { endpoint: "https://vps.test", credentials: creds });
      const outcome = expect(pending).rejects.toMatchObject({
        code: "NETWORK_ERROR",
        message: "No answer within 30 s",
      });
      await jest.advanceTimersByTimeAsync(VPS_REQUEST_TIMEOUT_MS);
      await outcome;
    } finally {
      jest.useRealTimers();
    }
  });

  it("gives up on a download whose body stalls after the headers, at the file's limit", async () => {
    jest.useFakeTimers();
    try {
      // Expo's fetch resolves when the headers arrive, and on iOS its body read
      // never settles once the request is aborted
      const signals: AbortSignal[] = [];
      global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
        signals.push(init!.signal!);
        return { ok: true, status: 200, arrayBuffer: () => new Promise(() => {}) };
      }) as unknown as typeof fetch;
      const pending = fetchMapBytes({
        kind: "map",
        url: "https://storage.test/map.rvmap",
        scan_id: "s",
        expires_at: 0,
        bytes: 480_000,
        quality: null,
      });
      const outcome = expect(pending).rejects.toMatchObject({
        code: "NETWORK_ERROR",
        message: "No answer within 35 s",
      });
      await jest.advanceTimersByTimeAsync(vpsDownloadTimeoutMs(480_000));
      await outcome;
      expect(signals[0].aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("gives a file download time by its size", () => {
    expect(vpsDownloadTimeoutMs(0)).toBe(30000);
    expect(vpsDownloadTimeoutMs(20_000_000)).toBe(230000);
    expect(vpsDownloadTimeoutMs(null)).toBe(300000);
  });
});
