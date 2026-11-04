/**
 * The location, scan and file routes of Studio's VPS device API: the method,
 * path and body each function sends, and what it makes of the answer.
 */
jest.mock("react-native", () => ({ NativeModules: {}, DeviceEventEmitter: {} }));
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: {
    rvGetAuthHeaders: async () => ({ mode: "none", baseUrl: null, headers: {}, projectId: null }),
  },
}));

import {
  createLocation,
  deleteLocation,
  getLocation,
  listLocations,
  listScans,
  renameLocation,
} from "../components/AR/ViroVPSLocations";
import { deleteScan } from "../components/AR/ViroVPSScanUpload";
import {
  getLocationFileDownload,
  getLocationMapDownload,
  getScanFileDownload,
} from "../components/AR/ViroVPSMapDownload";
import { ViroVPSError, ViroVPSErrorCodes, getVPSServerAddress } from "../components/AR/ViroVPSClient";

const CONNECTION = { endpoint: "https://studio.test", credentials: { projectId: "p", apiKey: "k" } };

let answer: [number, unknown] = [200, {}];
const fetchSpy = jest.fn(async (_url: string, _init?: RequestInit) => {
  const [status, body] = answer;
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
});

function respond(status: number, body: unknown) {
  answer = [status, body];
}

function sent() {
  const [url, init] = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  const parsed = new URL(url);
  return {
    method: init?.method ?? "GET",
    path: parsed.pathname.replace(/^\/functions\/v1/, "") + parsed.search,
    headers: init?.headers as Record<string, string>,
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  };
}

const location = {
  id: "l1",
  name: "Lobby",
  lat: null,
  lon: null,
  active_scan_id: null,
  app_user_id: "u1",
  created_at: 1,
};

beforeEach(() => {
  fetchSpy.mockClear();
  (globalThis as any).fetch = fetchSpy;
});

describe("locations", () => {
  it("lists a page, and passes limit and an encoded cursor through", async () => {
    respond(200, { locations: [{ ...location, active_scan: null }], next_cursor: "c/2" });
    await expect(listLocations({}, CONNECTION)).resolves.toEqual({
      locations: [{ ...location, active_scan: null }],
      next_cursor: "c/2",
    });
    expect(sent()).toMatchObject({ method: "GET", path: "/vps/locations" });

    respond(200, { locations: [] });
    await expect(listLocations({ limit: 10, cursor: "c/2" }, CONNECTION)).resolves.toEqual({
      locations: [],
      next_cursor: null,
    });
    expect(sent().path).toBe("/vps/locations?limit=10&cursor=c%2F2");
  });

  it("reads one location with its active scan", async () => {
    respond(200, { ...location, active_scan: null });
    await expect(getLocation("l 1", CONNECTION)).resolves.toEqual({ ...location, active_scan: null });
    expect(sent()).toMatchObject({ method: "GET", path: "/vps/locations/l%201" });
  });

  it("creates one, sending lat and lon only when given", async () => {
    respond(201, location);
    await expect(createLocation({ name: "Lobby" }, CONNECTION)).resolves.toEqual(location);
    expect(sent()).toMatchObject({ method: "POST", path: "/vps/locations", body: { name: "Lobby" } });
    expect(sent().headers).toMatchObject({ "x-api-key": "k", "Content-Type": "application/json" });

    await createLocation({ name: "Lobby", lat: 1, lon: 2 }, { ...CONNECTION, appUserId: "u1" });
    expect(sent().body).toEqual({ name: "Lobby", lat: 1, lon: 2 });
    expect(sent().headers["x-app-user-id"]).toBe("u1");
  });

  it("renames and deletes", async () => {
    respond(200, { ...location, name: "Hall" });
    await expect(renameLocation("l1", "Hall", CONNECTION)).resolves.toMatchObject({ name: "Hall" });
    expect(sent()).toMatchObject({ method: "PATCH", path: "/vps/locations/l1", body: { name: "Hall" } });

    respond(200, { deleted: { locations: 1, scans: 3 } });
    await expect(deleteLocation("l1", CONNECTION)).resolves.toEqual({ locations: 1, scans: 3 });
    expect(sent()).toMatchObject({ method: "DELETE", path: "/vps/locations/l1" });
  });

  it("lists a location's scans", async () => {
    respond(200, { scans: [{ id: "s1" }], next_cursor: null });
    await expect(listScans("l1", { limit: 200 }, CONNECTION)).resolves.toEqual({
      scans: [{ id: "s1" }],
      next_cursor: null,
    });
    expect(sent()).toMatchObject({ method: "GET", path: "/vps/locations/l1/scans?limit=200" });
  });

  it("throws the server's refusal", async () => {
    respond(403, { error: { code: "PAID_PLAN_REQUIRED", message: "paid" } });
    const error = await createLocation({ name: "Lobby" }, CONNECTION).catch((e) => e);
    expect(error).toBeInstanceOf(ViroVPSError);
    expect(error).toMatchObject({ code: "PAID_PLAN_REQUIRED", status: 403 });
  });
});

describe("scans and files", () => {
  it("deletes a scan", async () => {
    respond(200, { deleted: { scans: 1 } });
    await expect(deleteScan("s1", CONNECTION)).resolves.toBeUndefined();
    expect(sent()).toMatchObject({ method: "DELETE", path: "/vps/scans/s1" });
  });

  it("asks for a location's or a scan's file by kind", async () => {
    const link = { kind: "poses", scan_id: "s1", url: "https://x/y", expires_at: 9, bytes: 5 };
    respond(200, link);
    await expect(getLocationFileDownload("l1", "poses", CONNECTION)).resolves.toEqual(link);
    expect(sent().path).toBe("/vps/locations/l1/poses");
    await expect(getScanFileDownload("s1", "splat", CONNECTION)).resolves.toEqual(link);
    expect(sent().path).toBe("/vps/scans/s1/splat");
    await getLocationMapDownload("l1", CONNECTION);
    expect(sent().path).toBe("/vps/locations/l1/map");
  });
});

describe("getVPSServerAddress", () => {
  it("answers Studio's address, or null when it has none", async () => {
    respond(200, { url: "https://vps.test" });
    await expect(getVPSServerAddress(CONNECTION)).resolves.toBe("https://vps.test");
    expect(sent()).toMatchObject({ method: "GET", path: "/vps/server" });
    respond(200, { url: null });
    await expect(getVPSServerAddress(CONNECTION)).resolves.toBeNull();
  });
});

describe("ViroVPSErrorCodes", () => {
  it("names each code as itself, and cannot be changed", () => {
    for (const [name, code] of Object.entries(ViroVPSErrorCodes)) expect(code).toBe(name);
    expect(Object.isFrozen(ViroVPSErrorCodes)).toBe(true);
  });
});
