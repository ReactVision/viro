/**
 * bytesToBase64() is a pure function with no native/bridge dependency, so its
 * output can be checked directly here, against the RFC 4648 test vectors.
 */
import {
  bytesToBase64,
  findNearbyLocations,
  getLocationMapDownload,
  getLocationWorldMeshDownload,
} from "../components/AR/ViroVPSMapDownload";
import { ViroVPSError } from "../components/AR/ViroVPSClient";

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


describe("vps-server requests", () => {
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
    await expect(findNearbyLocations("https://vps.test", creds, 1, 2)).resolves.toEqual([loc]);
  });

  it("asks for the world mesh by its asset kind, and surfaces a missing one as 404", async () => {
    const fetchMock = respond(200, { kind: "world_mesh", scan_id: "s", url: "u", expires_at: 0, bytes: 4 });
    await getLocationWorldMeshDownload("https://vps.test/", creds, "loc a");
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://vps.test/vps/locations/loc%20a/world_mesh");
    respond(404, { error: { code: "NO_ASSET", message: "the location has no active world_mesh" } });
    await expect(getLocationWorldMeshDownload("https://vps.test", creds, "x")).rejects.toMatchObject({
      status: 404,
    });
    await expect(getLocationWorldMeshDownload("https://vps.test", creds, "x")).rejects.toBeInstanceOf(
      ViroVPSError
    );
  });

  it("calls a credentials function for every request, and sends appUserId as x-app-user-id", async () => {
    const fetchMock = respond(200, { kind: "map", scan_id: "s", url: "u", expires_at: 0, bytes: 3, quality: null });
    let n = 0;
    const provider = jest.fn(async () => ({ projectId: "p", accessToken: `t${++n}`, appUserId: "user-1" }));
    await getLocationMapDownload("https://vps.test", provider, "a");
    await getLocationMapDownload("https://vps.test", provider, "a");
    await getLocationMapDownload("https://vps.test", { ...creds, appUserId: "" }, "a");

    expect(provider).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map((c) => (c as unknown[])[1])).toEqual([
      { headers: { "x-project-id": "p", Authorization: "Bearer t1", "x-app-user-id": "user-1" } },
      { headers: { "x-project-id": "p", Authorization: "Bearer t2", "x-app-user-id": "user-1" } },
      { headers: { "x-project-id": creds.projectId, "x-api-key": "k" } },
    ]);
  });

  it("refuses an appUserId vps-server would refuse, or a failing credentials function, before any request", async () => {
    const fetchMock = respond(200, {});
    // 600 header bytes once UTF-8 encoded, though only 200 UTF-16 units.
    const cjk = "用".repeat(200);
    for (const appUserId of ["u".repeat(256), "josé", cjk, "a b", "tab\there", ".", ".."]) {
      await expect(
        getLocationMapDownload("https://vps.test", { ...creds, appUserId }, "a")
      ).rejects.toMatchObject({ code: "INVALID_APP_USER_ID", status: undefined });
    }
    await expect(
      getLocationMapDownload("https://vps.test", async () => Promise.reject(new Error("signed out")), "a")
    ).rejects.toMatchObject({ code: "CREDENTIALS_UNAVAILABLE", message: "Could not get VPS credentials: signed out" });
    expect(fetchMock).not.toHaveBeenCalled();

    for (const appUserId of ["~".repeat(255), "...", "auth0|5f7c@example.com"]) {
      await findNearbyLocations("https://vps.test", { ...creds, appUserId }, 1, 2);
    }
    const headers = fetchMock.mock.calls.map((c) => ((c as unknown[])[1] as any).headers);
    expect(headers.map((h) => h["x-app-user-id"])).toEqual([
      "~".repeat(255),
      "...",
      "auth0|5f7c@example.com",
    ]);
  });
});
