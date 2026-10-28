/**
 * Copyright © 2026 ReactVision
 *
 * Where VPS calls go when the app passes nothing: Studio's address and the
 * credential come from the native layer (a Studio session, or the manifest's
 * RVApiKey and RVProjectId), the default platform is pinned to its region
 * with an unpinned resend when the region's gateway never answered, and image
 * search and server-mode frames go to the VPS server Studio gives out.
 */
const mockAuthContext = jest.fn();
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: { rvGetAuthHeaders: () => mockAuthContext() },
}));

import {
  clearVPSServerAddresses,
  resolveVPSServer,
  resolveVPSStudio,
  vpsJson,
  vpsStudioFetch,
} from "../components/AR/ViroVPSClient";
import { findNearbyLocations } from "../components/AR/ViroVPSMapDownload";
import { queryLocationsByImage } from "../components/AR/ViroVPSQuery";
import { createUserTokenCredentials } from "../components/AR/ViroUserTokenCredentials";

const API_KEY_CONTEXT = {
  mode: "api_key",
  baseUrl: "https://platform.reactvision.xyz",
  headers: { "x-api-key": "key-1", "x-region": "eu-west-2", "x-rv-capabilities": "c" },
  projectId: "manifest-project",
};

function answer(status: number, body: unknown, contentType = "application/json") {
  return {
    ok: status < 400,
    status,
    headers: { get: () => contentType },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

const fetchSpy = jest.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  (globalThis as any).fetch = fetchSpy;
  mockAuthContext.mockReset();
  mockAuthContext.mockResolvedValue(API_KEY_CONTEXT);
  clearVPSServerAddresses();
});

describe("resolveVPSStudio", () => {
  it("takes the manifest key and project, and the default platform's region, when given nothing", async () => {
    await expect(resolveVPSStudio()).resolves.toEqual({
      base: "https://platform.reactvision.xyz",
      region: "eu-west-2",
      headers: { "x-project-id": "manifest-project", "x-api-key": "key-1" },
      renewToken: expect.any(Function),
    });
  });

  it("takes a session's own address and region", async () => {
    mockAuthContext.mockResolvedValue({
      mode: "session",
      baseUrl: "https://studio.test",
      headers: { Authorization: "Bearer tok", "x-region": "eu-west-1" },
      projectId: null,
    });
    await expect(
      resolveVPSStudio({ credentials: { projectId: "p", accessToken: "own" } })
    ).resolves.toEqual({
      base: "https://studio.test",
      region: "eu-west-1",
      headers: { "x-project-id": "p", Authorization: "Bearer own" },
      renewToken: expect.any(Function),
    });
  });

  it("asks the native layer nothing when given both, and pins no region on another address", async () => {
    await expect(
      resolveVPSStudio({ endpoint: "https://studio.test/", credentials: { projectId: "p", apiKey: "k" } })
    ).resolves.toEqual({
      base: "https://studio.test",
      region: null,
      headers: { "x-project-id": "p", "x-api-key": "k" },
      renewToken: expect.any(Function),
    });
    expect(mockAuthContext).not.toHaveBeenCalled();
  });

  it("says how to set credentials up when there are none", async () => {
    mockAuthContext.mockResolvedValue({ mode: "none", baseUrl: null, headers: {}, projectId: null });
    await expect(resolveVPSStudio()).rejects.toMatchObject({
      code: "CREDENTIALS_UNAVAILABLE",
      message: expect.stringMatching(/rvApiKey and rvProjectId/),
    });
  });
});

describe("vpsStudioFetch", () => {
  it("pins the region, and sends once more unpinned when the region's gateway never answered", async () => {
    fetchSpy
      .mockResolvedValueOnce(answer(502, "<html>bad gateway</html>", "text/html"))
      .mockResolvedValueOnce(answer(200, { locations: [] }));
    await expect(findNearbyLocations(1, 2)).resolves.toEqual([]);
    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
      "https://platform.reactvision.xyz/functions/v1/vps/locations?lat=1&lon=2&radius_m=200&limit=20&forceFunctionRegion=eu-west-2",
      "https://platform.reactvision.xyz/functions/v1/vps/locations?lat=1&lon=2&radius_m=200&limit=20",
    ]);
  });

  it("does not resend an answer a function gave", async () => {
    fetchSpy.mockResolvedValueOnce(
      answer(503, { error: { code: "VPS_LOOKUP_FAILED", message: "retry" } })
    );
    await expect(findNearbyLocations(1, 2)).rejects.toMatchObject({
      code: "VPS_LOOKUP_FAILED",
      status: 503,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reads the gateway's own answer, such as a function that is not deployed", async () => {
    const studio = await resolveVPSStudio();
    fetchSpy
      .mockResolvedValueOnce(
        answer(404, { code: "NOT_FOUND", message: "Requested function was not found" })
      )
      .mockResolvedValueOnce(answer(401, { code: 401, message: "Invalid JWT" }));
    await expect(vpsStudioFetch(studio, "/vps/server", {}, vpsJson)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Requested function was not found",
    });
    await expect(vpsStudioFetch(studio, "/vps/server", {}, vpsJson)).rejects.toMatchObject({
      code: undefined,
      status: 401,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("resends after a network error only when the region also fails a probe", async () => {
    const studio = await resolveVPSStudio();
    fetchSpy
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(answer(200, {}))
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(answer(200, { ok: true }));

    await expect(vpsStudioFetch(studio, "/vps/server", {}, vpsJson)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(fetchSpy.mock.calls[1][0]).toBe(
      "https://platform.reactvision.xyz/functions/v1/?forceFunctionRegion=eu-west-2"
    );

    await expect(vpsStudioFetch(studio, "/vps/server", {}, vpsJson)).resolves.toEqual({ ok: true });
    expect(fetchSpy.mock.calls[4][0]).toBe("https://platform.reactvision.xyz/functions/v1/vps/server");
  });
});

describe("resolveVPSServer", () => {
  const frame = { image: "AQID", fx: 1, fy: 1, cx: 0, cy: 0 } as any;

  it("asks Studio for the VPS server once, and sends image search there with the same credential", async () => {
    fetchSpy.mockImplementation(async (url: string) =>
      url.includes("/functions/v1/vps/server")
        ? answer(200, { url: "https://gpu.test/" })
        : answer(200, { candidates: [] })
    );
    await queryLocationsByImage(frame);
    await queryLocationsByImage(frame);
    const urls = fetchSpy.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      "https://platform.reactvision.xyz/functions/v1/vps/server?forceFunctionRegion=eu-west-2",
      "https://gpu.test/vps/locations/query",
      "https://gpu.test/vps/locations/query",
    ]);
    expect(fetchSpy.mock.calls[1][1].headers).toMatchObject({
      "x-project-id": "manifest-project",
      "x-api-key": "key-1",
    });
  });

  it("takes serverEndpoint without asking Studio", async () => {
    await expect(
      resolveVPSServer({ serverEndpoint: "http://192.168.1.24:8788/" })
    ).resolves.toEqual({
      base: "http://192.168.1.24:8788",
      headers: { "x-project-id": "manifest-project", "x-api-key": "key-1" },
      renewToken: expect.any(Function),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses when Studio has no VPS server, and asks again next time", async () => {
    fetchSpy.mockResolvedValue(answer(200, { url: null }));
    await expect(resolveVPSServer()).rejects.toMatchObject({ code: "VPS_SERVER_NOT_CONFIGURED" });
    await expect(resolveVPSServer()).rejects.toMatchObject({ code: "VPS_SERVER_NOT_CONFIGURED" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("a refused user token", () => {
  const STUDIO = "https://studio.test";
  const refused = (code = "APP_USER_TOKEN_EXPIRED") =>
    answer(401, { error: { code, message: "refused" } });
  const sentTokens = () => fetchSpy.mock.calls.map((c) => c[1].headers.Authorization);
  /** Credentials giving t1, t2, ... one per call. */
  function rotating() {
    let n = 0;
    return jest.fn(async () => ({ projectId: "p", accessToken: `t${++n}` }));
  }

  it("is replaced and the call sent once more, and the new token stays for the calls that follow", async () => {
    const credentials = rotating();
    const studio = await resolveVPSStudio({ endpoint: STUDIO, credentials });
    fetchSpy.mockResolvedValueOnce(refused()).mockResolvedValue(answer(200, { url: null }));

    await expect(vpsStudioFetch(studio, "/vps/server", {}, vpsJson)).resolves.toEqual({ url: null });
    await vpsStudioFetch(studio, "/vps/server", {}, vpsJson);

    expect(sentTokens()).toEqual(["Bearer t1", "Bearer t2", "Bearer t2"]);
    expect(credentials).toHaveBeenLastCalledWith({ refusedToken: "t1" });
  });

  it("is sent once more at most", async () => {
    fetchSpy.mockResolvedValue(refused("INVALID_APP_USER_TOKEN"));
    const studio = await resolveVPSStudio({ endpoint: STUDIO, credentials: rotating() });
    await expect(vpsStudioFetch(studio, "/vps/server", {}, vpsJson)).rejects.toMatchObject({
      code: "INVALID_APP_USER_TOKEN",
      status: 401,
    });
    expect(sentTokens()).toEqual(["Bearer t1", "Bearer t2"]);
  });

  it("is not sent again when the credentials give the same token, or for any other refusal", async () => {
    const same = await resolveVPSStudio({
      endpoint: STUDIO,
      credentials: { projectId: "p", accessToken: "t1" },
    });
    fetchSpy.mockResolvedValueOnce(refused());
    await expect(vpsStudioFetch(same, "/vps/server", {}, vpsJson)).rejects.toMatchObject({
      code: "APP_USER_TOKEN_EXPIRED",
    });

    const other = await resolveVPSStudio({ endpoint: STUDIO, credentials: rotating() });
    fetchSpy.mockResolvedValueOnce(refused("PROJECT_ACCESS_DENIED"));
    await expect(vpsStudioFetch(other, "/vps/server", {}, vpsJson)).rejects.toMatchObject({
      code: "PROJECT_ACCESS_DENIED",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("stays refused when the credentials fail to give another", async () => {
    const credentials = jest
      .fn()
      .mockResolvedValueOnce({ projectId: "p", accessToken: "t1" })
      .mockRejectedValueOnce(new Error("token backend down"));
    const studio = await resolveVPSStudio({ endpoint: STUDIO, credentials });
    fetchSpy.mockResolvedValueOnce(refused());
    await expect(vpsStudioFetch(studio, "/vps/server", {}, vpsJson)).rejects.toMatchObject({
      code: "APP_USER_TOKEN_EXPIRED",
      status: 401,
    });
    expect(credentials).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("is renewed on the VPS server too", async () => {
    fetchSpy.mockResolvedValueOnce(refused()).mockResolvedValueOnce(answer(200, { candidates: [] }));
    await expect(
      queryLocationsByImage({ image: "AQID", fx: 1, fy: 1, cx: 0, cy: 0 } as any, {}, {
        endpoint: STUDIO,
        serverEndpoint: "https://gpu.test",
        credentials: rotating(),
      })
    ).resolves.toEqual([]);
    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
      "https://gpu.test/vps/locations/query",
      "https://gpu.test/vps/locations/query",
    ]);
    expect(sentTokens()).toEqual(["Bearer t1", "Bearer t2"]);
  });

  it("is fetched again by createUserTokenCredentials(), which otherwise keeps it", async () => {
    let n = 0;
    const fetchToken = jest.fn(async () => ({ token: `u${++n}`, expires_in: 3600 }));
    const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
    fetchSpy
      .mockResolvedValueOnce(answer(200, { locations: [] }))
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(answer(200, { locations: [] }));

    await findNearbyLocations(1, 2, undefined, undefined, { endpoint: STUDIO, credentials });
    await findNearbyLocations(1, 2, undefined, undefined, { endpoint: STUDIO, credentials });

    expect(sentTokens()).toEqual(["Bearer u1", "Bearer u1", "Bearer u2"]);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});
