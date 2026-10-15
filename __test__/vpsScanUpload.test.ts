/**
 * Copyright © 2026 ReactVision
 *
 * uploadScanRecording() hands the whole zip-and-upload to the native module
 * and turns its result into a scan or a ViroVPSError. The native side zips
 * before it creates the scan; what is checked here is the JS half of that
 * contract: the arguments it passes, that JS itself never issues the POST or
 * the PUT, and that a failure while zipping surfaces as an error with no HTTP
 * status (no scan was created). Also that the navigator forwards the upload
 * to the native module unchanged.
 */
const mockUpload = jest.fn();
let mockNativeModules: Record<string, unknown> = {};

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

const fetchSpy = jest.fn();

beforeEach(() => {
  mockUpload.mockReset();
  fetchSpy.mockReset();
  (globalThis as any).fetch = fetchSpy;
  mockNativeModules = { VRTARSceneNavigatorModule: { rvUploadScanRecording: mockUpload } };
});

describe("uploadScanRecording", () => {
  it("passes the endpoint, auth headers, create body and recording dir to native", async () => {
    mockUpload.mockResolvedValue(
      JSON.stringify({ success: true, status: 202, body: JSON.stringify(scan) })
    );

    const result = await uploadScanRecording(
      "https://vps.example.com/",
      { projectId: "p", apiKey: "k" },
      { location: { name: "Hall", lat: 1, lon: 2 } },
      "file:///data/rec/"
    );

    expect(result).toEqual(scan);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [endpoint, headersJson, createJson, dir, scanId] = mockUpload.mock.calls[0];
    expect(endpoint).toBe("https://vps.example.com");
    expect(JSON.parse(headersJson)).toEqual({ "x-project-id": "p", "x-api-key": "k" });
    expect(JSON.parse(createJson)).toEqual({ location: { name: "Hall", lat: 1, lon: 2 } });
    expect(dir).toBe("/data/rec");
    expect(scanId).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resumes an existing scan with options.scanId: no create body, the id goes to native", async () => {
    mockUpload.mockResolvedValue(
      JSON.stringify({ success: true, status: 202, body: JSON.stringify(scan), scan_id: "s1" })
    );
    const result = await uploadScanRecording(
      "https://vps.example.com",
      { projectId: "p", apiKey: "k" },
      { location: { name: "Hall" } },
      "/data/rec",
      { scanId: "s1", outputs: ["mesh"], keepRecording: false }
    );

    expect(result).toEqual(scan);
    const [, , createJson, dir, scanId] = mockUpload.mock.calls[0];
    expect(createJson).toBe("");
    expect(dir).toBe("/data/rec");
    expect(scanId).toBe("s1");
  });

  it("names the scan on an upload failure, with or without an HTTP status", async () => {
    const upload = (options: Record<string, unknown> = {}) =>
      uploadScanRecording(
        "https://vps.example.com",
        { projectId: "p", apiKey: "k" },
        { locationId: "l1" },
        "/data/rec",
        options
      ).catch((e) => e);
    const answer = (result: Record<string, unknown>) =>
      mockUpload.mockResolvedValueOnce(JSON.stringify(result));

    answer({
      success: false,
      stage: "upload",
      status: 503,
      body: JSON.stringify({ error: { code: "SERVER_STORAGE_FULL", message: "full" } }),
      scan_id: "s9",
    });
    expect(await upload()).toMatchObject({
      code: "SERVER_STORAGE_FULL",
      status: 503,
      scanId: "s9",
    });

    answer({
      success: false,
      stage: "upload",
      error: "The network connection was lost.",
      scan_id: "s9",
    });
    const lost = await upload();
    expect(lost).toBeInstanceOf(ViroVPSError);
    expect(lost.message).toBe("The network connection was lost.");
    expect(lost.status).toBeUndefined();
    expect(lost.code).toBeUndefined();
    expect(lost.scanId).toBe("s9");

    answer({
      success: false,
      stage: "create",
      status: 429,
      body: JSON.stringify({ error: { code: "VPS_USER_LIMIT_REACHED", message: "limit" } }),
    });
    expect((await upload()).scanId).toBeUndefined();

    // A resumed upload names its scan whatever step failed.
    answer({ success: false, stage: "zip", error: "video.mp4 is missing" });
    expect(await upload({ scanId: "s5" })).toMatchObject({
      message: "video.mp4 is missing",
      scanId: "s5",
    });
  });

  it("sends location_id for an existing location and a bearer token for a session", async () => {
    mockUpload.mockResolvedValue(
      JSON.stringify({ success: true, status: 202, body: JSON.stringify(scan) })
    );
    await uploadScanRecording(
      "https://vps.example.com",
      { projectId: "p", accessToken: "t" },
      { locationId: "l1" },
      "/data/rec"
    );
    const [, headersJson, createJson] = mockUpload.mock.calls[0];
    expect(JSON.parse(headersJson)).toEqual({ "x-project-id": "p", Authorization: "Bearer t" });
    expect(JSON.parse(createJson)).toEqual({ location_id: "l1" });
  });

  it("sends appUserId as x-app-user-id, and outputs and keep_recording in the create body", async () => {
    mockUpload.mockResolvedValue(
      JSON.stringify({ success: true, status: 202, body: JSON.stringify(scan) })
    );
    const credentials = jest.fn(async () => ({ projectId: "p", accessToken: "fresh" }));
    await uploadScanRecording(
      "https://vps.example.com",
      credentials,
      { locationId: "l1" },
      "/data/rec",
      { appUserId: "user-1", outputs: ["mesh", "semantic"], keepRecording: false }
    );
    expect(credentials).toHaveBeenCalledTimes(1);
    const [, headersJson, createJson] = mockUpload.mock.calls[0];
    expect(JSON.parse(headersJson)).toEqual({
      "x-project-id": "p",
      Authorization: "Bearer fresh",
      "x-app-user-id": "user-1",
    });
    expect(JSON.parse(createJson)).toEqual({
      location_id: "l1",
      outputs: ["mesh", "semantic"],
      keep_recording: false,
    });
  });

  it("refuses options and an appUserId vps-server would refuse, before the native zip", async () => {
    const upload = (options: Record<string, unknown>) =>
      uploadScanRecording(
        "https://vps.example.com",
        { projectId: "p", apiKey: "k" },
        { locationId: "l1" },
        "/data/rec",
        options as any
      ).catch((e) => e);

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
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("reports a zip failure without an HTTP status: no scan was created", async () => {
    mockUpload.mockResolvedValue(
      JSON.stringify({ success: false, stage: "zip", error: "video.mp4 is missing" })
    );
    const error = await uploadScanRecording(
      "https://vps.example.com",
      { projectId: "p", apiKey: "k" },
      { locationId: "l1" },
      "/data/rec"
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ViroVPSError);
    expect(error.message).toBe("video.mp4 is missing");
    expect(error.status).toBeUndefined();
    expect(error.scanId).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("turns a server error from either request into a ViroVPSError with its code", async () => {
    mockUpload.mockResolvedValue(
      JSON.stringify({
        success: false,
        stage: "upload",
        status: 413,
        body: JSON.stringify({ error: { code: "TOO_LARGE", message: "too big" } }),
      })
    );
    const error = await uploadScanRecording(
      "https://vps.example.com",
      { projectId: "p", apiKey: "k" },
      { locationId: "l1" },
      "/data/rec"
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ViroVPSError);
    expect(error.code).toBe("TOO_LARGE");
    expect(error.status).toBe(413);
    expect(error.message).toBe("too big");
  });

  it("fails clearly when the native module is not there", async () => {
    mockNativeModules = {};
    await expect(
      uploadScanRecording("https://x", { projectId: "p", apiKey: "k" }, { locationId: "l" }, "/d")
    ).rejects.toThrow(/not available/);
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

  it("passes uploadScanRecording's scanId to the native upload", async () => {
    mockUpload.mockResolvedValue(
      JSON.stringify({ success: true, status: 202, body: JSON.stringify(scan), scan_id: "s1" })
    );
    const nav = navigatorWith({ rvUploadScanRecording: mockUpload });
    await nav.uploadScanRecording(
      "https://vps.example.com",
      { projectId: "p", apiKey: "k" },
      { locationId: "l1" },
      "/data/rec",
      { scanId: "s1" }
    );
    expect(mockUpload.mock.calls[0][4]).toBe("s1");
  });
});
