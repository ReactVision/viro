// Wrapper-level tests for VRTStudioModule.rvSetStudioSession: config/null
// pass-through to the native module, and the not-available guard. The wrapper
// captures `NativeModules.VRTStudio` at import time, so each case loads the
// module in an isolated registry with a fresh react-native mock.

function loadWrapper(nativeModule?: Record<string, unknown>) {
  let wrapper!: (typeof import("../components/Studio/VRTStudioModule"))["VRTStudioModule"];
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({
      NativeModules: nativeModule ? { VRTStudio: nativeModule } : {},
    }));
    wrapper = require("../components/Studio/VRTStudioModule").VRTStudioModule;
  });
  return wrapper;
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock("react-native");
});

describe("VRTStudioModule.rvSetStudioSession", () => {
  test("passes the session config through to the native module", async () => {
    const rvSetStudioSession = jest.fn().mockResolvedValue(undefined);
    const wrapper = loadWrapper({ rvSetStudioSession });

    const config = {
      baseUrl: "https://project.supabase.co",
      accessToken: "jwt-token",
      clientTag: "studio-go",
    };
    await wrapper.rvSetStudioSession(config);

    expect(rvSetStudioSession).toHaveBeenCalledWith(config);
  });

  test("forwards null to revert to API-key mode", async () => {
    const rvSetStudioSession = jest.fn().mockResolvedValue(undefined);
    const wrapper = loadWrapper({ rvSetStudioSession });

    await wrapper.rvSetStudioSession(null);

    expect(rvSetStudioSession).toHaveBeenCalledWith(null);
  });

  test("resolves without throwing when the native module is unavailable", async () => {
    const wrapper = loadWrapper(undefined);

    await expect(
      wrapper.rvSetStudioSession({
        baseUrl: "https://project.supabase.co",
        accessToken: "jwt-token",
      }),
    ).resolves.toBeUndefined();
  });
});
