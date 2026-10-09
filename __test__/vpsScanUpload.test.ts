/**
 * Copyright © 2026 ReactVision
 *
 * uploadScanRecording() hands the whole zip-and-upload to the native module
 * and turns its result into a scan or a ViroVPSError. The native side zips
 * before it creates the scan; what is checked here is the JS half of that
 * contract: the arguments it passes, that JS itself never issues the POST or
 * the PUT, and that a failure while zipping surfaces as an error with no HTTP
 * status (no scan was created).
 */
const mockUpload = jest.fn();
let mockNativeModules: Record<string, unknown> = {};

jest.mock("react-native", () => ({
  get NativeModules() {
    return mockNativeModules;
  },
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
    const [endpoint, headersJson, createJson, dir] = mockUpload.mock.calls[0];
    expect(endpoint).toBe("https://vps.example.com");
    expect(JSON.parse(headersJson)).toEqual({ "x-project-id": "p", "x-api-key": "k" });
    expect(JSON.parse(createJson)).toEqual({ location: { name: "Hall", lat: 1, lon: 2 } });
    expect(dir).toBe("/data/rec");
    expect(fetchSpy).not.toHaveBeenCalled();
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
