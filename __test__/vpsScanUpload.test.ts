/**
 * Copyright © 2026 ReactVision
 *
 * uploadScanRecording(): the native module zips the recording, Studio creates
 * the scan and admits the upload (answering with a signed Storage URL), and
 * the native module sends the zip and tells Studio it arrived. What is checked
 * here is the JS half: the requests to Studio, what is handed to native, and
 * how each failure becomes a scan or a ViroVPSError naming the scan to resume.
 * Also that the navigator forwards the upload and the VPS map and mesh load
 * numbers to the native module unchanged.
 */
let mockNativeModules: Record<string, unknown> = {};
const mockAuthContext = jest.fn();

jest.mock("react-native", () => ({
  get NativeModules() {
    return mockNativeModules;
  },
  Platform: { OS: "ios", constants: {}, select: (o: any) => o.ios ?? o.default },
  StyleSheet: { create: (s: any) => s },
  findNodeHandle: () => 42,
  requireNativeComponent: () => "VRTARSceneNavigator",
  Text: "Text",
  View: "View",
}));

jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: { rvGetAuthHeaders: () => mockAuthContext() },
}));

import { uploadScanRecording } from "../components/AR/ViroVPSScanUpload";
import { ViroVPSError } from "../components/AR/ViroVPSClient";

const scan = {
  id: "s1",
  location_id: "l1",
  status: "queued",
  stage: null,
  error: null,
  recording_bytes: 10,
  assets: [],
  quality: null,
  map_accepted: null,
  map_rejected_reason: null,
  created_at: 1,
  updated_at: 2,
};
const waiting = { ...scan, status: "awaiting_upload" };
const PUT = {
  url: "https://studio.test/storage/v1/object/upload/sign/vps/p/s1/recording.zip?token=t",
  method: "PUT",
  headers: { "content-type": "application/zip" },
  expires_at: 9,
};
const CONNECTION = { endpoint: "https://studio.test", credentials: { projectId: "p", apiKey: "k" } };

type Answer = [number, unknown];
let routes: Record<string, () => Answer> = {};
const fetchSpy = jest.fn(async (url: string, init?: RequestInit) => {
  const path = new URL(url).pathname.replace(/^\/functions\/v1/, "");
  const key = path === "/vps/scans" ? "create" : path.endsWith("/upload") ? "upload" : path;
  const [status, body] = routes[key]?.() ?? [404, { error: { code: "NOT_FOUND", message: url } }];
  return {
    ok: status < 400,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
});

/** Studio's answers by route: `create` and `upload`. */
function studio(answers: Record<string, () => Answer>) {
  routes = { create: () => [201, waiting], ...answers };
}

function requests() {
  return fetchSpy.mock.calls.map(([url, init]) => ({
    url: url as string,
    path: new URL(url as string).pathname.replace(/^\/functions\/v1/, ""),
    method: (init as RequestInit | undefined)?.method ?? "GET",
    headers: (init as RequestInit | undefined)?.headers as Record<string, string>,
    body: (init as RequestInit | undefined)?.body
      ? JSON.parse((init as RequestInit).body as string)
      : undefined,
  }));
}

let native: {
  rvPrepareScanRecording: jest.Mock;
  rvTransferScanRecording: jest.Mock;
  rvDiscardScanRecording: jest.Mock;
};

function transferRequest() {
  return JSON.parse(native.rvTransferScanRecording.mock.calls[0][0]);
}

function transferAnswers(result: Record<string, unknown>) {
  native.rvTransferScanRecording.mockResolvedValue(JSON.stringify(result));
}

const done = { success: true, stage: "complete", status: 200, body: JSON.stringify({ scan }) };

beforeEach(() => {
  fetchSpy.mockClear();
  mockAuthContext.mockReset();
  mockAuthContext.mockResolvedValue({ mode: "none", baseUrl: null, headers: {}, projectId: null });
  (globalThis as any).fetch = fetchSpy;
  native = {
    rvPrepareScanRecording: jest.fn(async () =>
      JSON.stringify({ success: true, path: "/support/ViroVPSUploads/a.zip", bytes: 10 })
    ),
    rvTransferScanRecording: jest.fn(async () => JSON.stringify(done)),
    rvDiscardScanRecording: jest.fn(async () => {}),
  };
  mockNativeModules = { VRTARSceneNavigatorModule: native };
  studio({ upload: () => [200, { scan: waiting, upload: PUT }] });
});

describe("uploadScanRecording", () => {
  it("zips, creates the scan, admits the upload and hands the transfer to native", async () => {
    const result = await uploadScanRecording(
      { location: { name: "Hall", lat: 1, lon: 2 } },
      "file:///data/rec/",
      CONNECTION
    );

    expect(result).toEqual(scan);
    expect(native.rvPrepareScanRecording).toHaveBeenCalledWith("/data/rec");
    expect(requests().map(({ url, method, body }) => [method, url, body])).toEqual([
      ["POST", "https://studio.test/functions/v1/vps/scans", { location: { name: "Hall", lat: 1, lon: 2 } }],
      ["POST", "https://studio.test/functions/v1/vps/scans/s1/upload", { recording_bytes: 10 }],
    ]);
    expect(requests()[0].headers).toEqual({
      "x-project-id": "p",
      "x-api-key": "k",
      "Content-Type": "application/json",
    });
    expect(transferRequest()).toEqual({
      scan_id: "s1",
      zip_path: "/support/ViroVPSUploads/a.zip",
      bytes: 10,
      put_url: PUT.url,
      put_headers: PUT.headers,
      complete_url: "https://studio.test/functions/v1/vps/scans/s1/upload/complete",
      complete_headers: { "x-project-id": "p", "x-api-key": "k", "content-type": "application/json" },
    });
    expect(native.rvDiscardScanRecording).not.toHaveBeenCalled();
  });

  it("resumes into options.scanId without creating a scan", async () => {
    const result = await uploadScanRecording({ location: { name: "Hall" } }, "/data/rec", {
      ...CONNECTION,
      scanId: "s1",
      outputs: ["mesh"],
      keepRecording: false,
    });
    expect(result).toEqual(scan);
    expect(requests().map((r) => r.path)).toEqual(["/vps/scans/s1/upload"]);
    expect(transferRequest().scan_id).toBe("s1");
  });

  it("renews a refused user token, and hands native the new one for the complete call", async () => {
    let n = 0;
    const credentials = jest.fn(async () => ({ projectId: "p", accessToken: `t${++n}` }));
    let refused = false;
    studio({
      create: () =>
        refused
          ? [201, waiting]
          : ((refused = true), [401, { error: { code: "APP_USER_TOKEN_EXPIRED", message: "expired" } }]),
      upload: () => [200, { scan: waiting, upload: PUT }],
    });

    await uploadScanRecording({ locationId: "l1" }, "/data/rec", {
      endpoint: "https://studio.test",
      credentials,
    });

    expect(requests().map((r) => [r.path, r.headers.Authorization])).toEqual([
      ["/vps/scans", "Bearer t1"],
      ["/vps/scans", "Bearer t2"],
      ["/vps/scans/s1/upload", "Bearer t2"],
    ]);
    expect(transferRequest().complete_headers.Authorization).toBe("Bearer t2");
  });

  it("skips the PUT when Studio already holds the recording", async () => {
    studio({ upload: () => [200, { scan: waiting, upload: null }] });
    await uploadScanRecording({ locationId: "l1" }, "/data/rec", CONNECTION);
    expect(transferRequest().put_url).toBeNull();
  });

  it("names the scan on every failure once it exists, and discards a zip that was never sent", async () => {
    const upload = (options: Record<string, unknown> = {}) =>
      uploadScanRecording({ locationId: "l1" }, "/data/rec", { ...CONNECTION, ...options }).catch(
        (e) => e
      );

    studio({ create: () => [429, { error: { code: "VPS_USER_LIMIT_REACHED", message: "limit" } }] });
    expect(await upload()).toMatchObject({ code: "VPS_USER_LIMIT_REACHED", status: 429, scanId: undefined });
    expect(native.rvDiscardScanRecording).toHaveBeenLastCalledWith("/support/ViroVPSUploads/a.zip");

    studio({ upload: () => [403, { error: { code: "COMPUTE_SPEND_LIMIT_REACHED", message: "limit" } }] });
    expect(await upload()).toMatchObject({ code: "COMPUTE_SPEND_LIMIT_REACHED", status: 403, scanId: "s1" });
    expect(native.rvDiscardScanRecording).toHaveBeenCalledTimes(2);

    studio({ upload: () => [200, { scan: waiting, upload: PUT }] });
    transferAnswers({
      success: false,
      stage: "upload",
      status: 403,
      body: JSON.stringify({ statusCode: "403", error: "Unauthorized", message: "jwt expired" }),
    });
    expect(await upload()).toMatchObject({ status: 403, scanId: "s1" });

    transferAnswers({ success: false, stage: "upload", error: "The network connection was lost." });
    const lost = await upload();
    expect(lost).toBeInstanceOf(ViroVPSError);
    expect(lost).toMatchObject({
      message: "The network connection was lost.",
      status: undefined,
      code: undefined,
      scanId: "s1",
    });

    transferAnswers({ success: false, stage: "upload", code: "UPLOAD_IN_PROGRESS", error: "running" });
    expect(await upload()).toMatchObject({ code: "UPLOAD_IN_PROGRESS", scanId: "s1" });
    // native deletes the zip of a transfer it ran
    expect(native.rvDiscardScanRecording).toHaveBeenCalledTimes(2);

    native.rvPrepareScanRecording.mockResolvedValueOnce(
      JSON.stringify({ success: false, stage: "zip", error: "video.mp4 is missing" })
    );
    expect(await upload({ scanId: "s5" })).toMatchObject({
      message: "video.mp4 is missing",
      status: undefined,
      scanId: "s5",
    });
  });

  it("answers with the admitted scan when the recording is stored but Studio was not told", async () => {
    for (const result of [
      { success: false, stage: "complete", error: "timed out" },
      { success: false, stage: "complete", status: 503, body: "{}" },
      {
        success: false,
        stage: "complete",
        status: 401,
        body: JSON.stringify({ error: { code: "INVALID_SESSION", message: "expired" } }),
      },
    ]) {
      transferAnswers(result);
      await expect(uploadScanRecording({ locationId: "l1" }, "/data/rec", CONNECTION)).resolves.toEqual(
        waiting
      );
    }
    for (const [status, code] of [
      [400, "RECORDING_SIZE_MISMATCH"],
      [409, "RECORDING_NOT_UPLOADED"],
      [404, "NOT_FOUND"],
    ] as const) {
      transferAnswers({
        success: false,
        stage: "complete",
        status,
        body: JSON.stringify({ error: { code, message: "no" } }),
      });
      await expect(uploadScanRecording({ locationId: "l1" }, "/data/rec", CONNECTION)).rejects.toMatchObject({
        code,
        status,
        scanId: "s1",
      });
    }
  });

  it("sends appUserId as x-app-user-id, and outputs and keep_recording in the create body", async () => {
    const credentials = jest.fn(async () => ({ projectId: "p", accessToken: "fresh" }));
    await uploadScanRecording({ locationId: "l1" }, "/data/rec", {
      endpoint: "https://studio.test",
      credentials,
      appUserId: "user-1",
      outputs: ["mesh", "semantic"],
      keepRecording: false,
    });
    expect(credentials).toHaveBeenCalledTimes(1);
    const auth = { "x-project-id": "p", Authorization: "Bearer fresh", "x-app-user-id": "user-1" };
    expect(requests()[0].headers).toEqual({ ...auth, "Content-Type": "application/json" });
    expect(requests()[0].body).toEqual({
      location_id: "l1",
      outputs: ["mesh", "semantic"],
      keep_recording: false,
    });
    expect(transferRequest().complete_headers).toEqual({ ...auth, "content-type": "application/json" });
  });

  it("refuses options and an appUserId Studio would refuse, before the native zip", async () => {
    const upload = (options: Record<string, unknown>) =>
      uploadScanRecording({ locationId: "l1" }, "/data/rec", { ...CONNECTION, ...options } as any).catch(
        (e) => e
      );

    expect(await upload({ outputs: ["semantic"] })).toMatchObject({
      code: "BAD_REQUEST",
      message: "semantic needs mesh",
      status: undefined,
    });
    for (const outputs of [["mesh", "map"], "mesh", [null]]) {
      expect(await upload({ outputs })).toMatchObject({
        code: "BAD_REQUEST",
        message: "outputs is a list of mesh, splat, semantic",
      });
    }
    expect(await upload({ keepRecording: "false" })).toMatchObject({
      code: "BAD_REQUEST",
      message: "keepRecording is a boolean",
    });
    expect(await upload({ appUserId: "josé" })).toMatchObject({ code: "INVALID_APP_USER_ID" });
    expect(await upload({ scanId: 7 })).toMatchObject({
      code: "BAD_REQUEST",
      message: "scanId is a string",
    });
    expect(native.rvPrepareScanRecording).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports a zip failure without an HTTP status: no scan was created", async () => {
    native.rvPrepareScanRecording.mockResolvedValue(
      JSON.stringify({ success: false, stage: "zip", error: "video.mp4 is missing" })
    );
    const error = await uploadScanRecording({ locationId: "l1" }, "/data/rec", CONNECTION).catch((e) => e);
    expect(error).toBeInstanceOf(ViroVPSError);
    expect(error).toMatchObject({ message: "video.mp4 is missing", status: undefined, scanId: undefined });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("goes to the app's own Studio, as the native layer's credential, when given nothing", async () => {
    mockAuthContext.mockResolvedValue({
      mode: "session",
      baseUrl: "https://studio.test",
      headers: { Authorization: "Bearer s", "x-region": "eu-west-1", "x-rv-client": "c" },
      projectId: "manifest-project",
    });
    await uploadScanRecording({ locationId: "l1" }, "/data/rec");
    expect(requests().map((r) => r.url)).toEqual([
      "https://studio.test/functions/v1/vps/scans?forceFunctionRegion=eu-west-1",
      "https://studio.test/functions/v1/vps/scans/s1/upload?forceFunctionRegion=eu-west-1",
    ]);
    expect(requests()[0].headers).toEqual({
      "x-project-id": "manifest-project",
      Authorization: "Bearer s",
      "Content-Type": "application/json",
    });
    expect(transferRequest().complete_url).toBe(
      "https://studio.test/functions/v1/vps/scans/s1/upload/complete?forceFunctionRegion=eu-west-1"
    );
  });

  it("fails clearly when the native module is not there", async () => {
    mockNativeModules = { VRTARSceneNavigatorModule: { rvUploadScanRecording: jest.fn() } };
    await expect(uploadScanRecording({ locationId: "l" }, "/d", CONNECTION)).rejects.toMatchObject({
      code: "UNSUPPORTED",
      message: expect.stringMatching(/not available/),
    });
  });
});

describe("ViroARSceneNavigator forwarding", () => {
  // Loaded after the native module is in place: the navigator reads it at import.
  function navigatorWith(nativeModule: Record<string, unknown>) {
    mockNativeModules = { VRTARSceneNavigatorModule: nativeModule };
    let Navigator: any;
    jest.isolateModules(() => {
      Navigator = require("../components/AR/ViroARSceneNavigator").ViroARSceneNavigator;
    });
    return new Navigator({ initialScene: { scene: () => null } }).arSceneNavigator;
  }

  it("passes uploadScanRecording's target, directory and options on", async () => {
    studio({ upload: () => [200, { scan: { ...scan, status: "awaiting_upload" }, upload: PUT }] });
    const nav = navigatorWith(native);
    await nav.uploadScanRecording({ locationId: "l1" }, "/data/rec", { ...CONNECTION, scanId: "s1" });
    expect(native.rvPrepareScanRecording).toHaveBeenCalledWith("/data/rec");
    expect(transferRequest().scan_id).toBe("s1");
    expect(requests().map((r) => r.path)).toEqual(["/vps/scans/s1/upload"]);
  });

  it("passes the map and mesh load numbers to native, and 0 when they are left out", async () => {
    const nativeModule = {
      rvLoadVPSMap: jest.fn(async () => JSON.stringify({ success: true })),
      rvUnloadVPSMap: jest.fn(),
      rvLoadVPSMapMesh: jest.fn(async () => JSON.stringify({ success: true })),
      rvUnloadVPSMapMesh: jest.fn(),
    };
    const nav = navigatorWith(nativeModule);
    const bytes = new Uint8Array([1, 2, 3]);
    await nav.loadVPSMap(bytes, 3);
    await nav.loadVPSMap(bytes);
    nav.unloadVPSMap(3);
    nav.unloadVPSMap();
    await nav.loadVPSMapMesh(bytes, { physics: false }, 2);
    await nav.loadVPSMapMesh(bytes);
    nav.unloadVPSMapMesh(2);
    nav.unloadVPSMapMesh();

    expect(nativeModule.rvLoadVPSMap.mock.calls).toEqual([
      [42, "AQID", 3],
      [42, "AQID", 0],
    ]);
    expect(nativeModule.rvUnloadVPSMap.mock.calls).toEqual([
      [42, 3],
      [42, 0],
    ]);
    expect(nativeModule.rvLoadVPSMapMesh.mock.calls).toEqual([
      [42, "AQID", true, false, 2],
      [42, "AQID", true, true, 0],
    ]);
    expect(nativeModule.rvUnloadVPSMapMesh.mock.calls).toEqual([
      [42, 2],
      [42, 0],
    ]);
  });
});
