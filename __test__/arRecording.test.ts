/**
 * Copyright © 2026 ReactVision
 *
 * The navigator's recording calls: stopRecording() hands back what native wrote, and a
 * platform without the native module answers with a failed result instead of undefined;
 * isRecordingSupported() always sends its depth option and answers false without native.
 */
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

// Loaded after the native module is in place: the navigator reads it at import.
function navigatorWith(nativeModule: Record<string, unknown> | null) {
  mockNativeModules = nativeModule ? { VRTARSceneNavigatorModule: nativeModule } : {};
  let Navigator: any;
  jest.isolateModules(() => {
    Navigator = require("../components/AR/ViroARSceneNavigator").ViroARSceneNavigator;
  });
  return new Navigator({ initialScene: { scene: () => null } }).arSceneNavigator;
}

describe("stopRecording", () => {
  it("resolves to what native reports once the files are complete", async () => {
    const result = {
      success: true,
      durationSec: 12.5,
      frames: 370,
      depthFrames: 120,
      gpsFixes: 11,
      bytes: 48_000_000,
    };
    const stopRecording = jest.fn(async () => result);
    const nav = navigatorWith({ stopRecording });
    await expect(nav.stopRecording()).resolves.toEqual(result);
    expect(stopRecording).toHaveBeenCalledWith(42);
  });

  it("answers with a failed result where the native module is missing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const nav = navigatorWith(null);
    await expect(nav.stopRecording()).resolves.toEqual({
      success: false,
      error: expect.stringMatching(/not available/),
      durationSec: 0,
      frames: 0,
      depthFrames: 0,
      gpsFixes: 0,
    });
    warn.mockRestore();
  });
});

describe("isRecordingSupported", () => {
  it("sends the depth option every time and passes the answer on", async () => {
    const isRecordingSupported = jest.fn(async () => true);
    const nav = navigatorWith({ isRecordingSupported });
    await expect(nav.isRecordingSupported({ depth: true })).resolves.toBe(true);
    await expect(nav.isRecordingSupported()).resolves.toBe(true);
    expect(isRecordingSupported.mock.calls).toEqual([
      [42, { depth: true }],
      [42, { depth: false }],
    ]);
  });

  it("answers false when native has no such method", async () => {
    const nav = navigatorWith({});
    await expect(nav.isRecordingSupported({ depth: true })).resolves.toBe(false);
  });
});
