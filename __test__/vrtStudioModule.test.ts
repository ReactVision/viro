// Wrapper-level tests for VRTStudioModule's internal auth methods: config/null
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

describe("VRTStudioModule.rvGetAuthHeaders", () => {
  test("passes the native context through", async () => {
    const context = {
      mode: "session",
      baseUrl: "https://project.supabase.co",
      headers: {
        Authorization: "Bearer jwt-token",
        "x-rv-client": "studio-go",
      },
      projectId: null,
    };
    const rvGetAuthHeaders = jest.fn().mockResolvedValue(context);
    const wrapper = loadWrapper({ rvGetAuthHeaders });

    await expect(wrapper.rvGetAuthHeaders()).resolves.toEqual(context);
  });

  test("answers mode none on a binary that predates the method", async () => {
    // The OTA-skew case: VRTStudio exists, the method does not.
    const wrapper = loadWrapper({ rvSetStudioSession: jest.fn() });

    await expect(wrapper.rvGetAuthHeaders()).resolves.toEqual({
      mode: "none",
      baseUrl: null,
      headers: {},
      projectId: null,
    });
  });

  test("answers mode none without the native module", async () => {
    const wrapper = loadWrapper(undefined);

    expect((await wrapper.rvGetAuthHeaders()).mode).toBe("none");
  });
});

describe("VRTStudioModule.rvSetCloudAnchorProject", () => {
  test("forwards a project id and null to the native module", async () => {
    const rvSetCloudAnchorProject = jest.fn().mockResolvedValue(undefined);
    const wrapper = loadWrapper({ rvSetCloudAnchorProject });

    await wrapper.rvSetCloudAnchorProject(
      "5eed0000-0000-4000-8000-000000000013"
    );
    await wrapper.rvSetCloudAnchorProject(null);

    expect(rvSetCloudAnchorProject.mock.calls).toEqual([
      ["5eed0000-0000-4000-8000-000000000013"],
      [null],
    ]);
  });

  test("is a no-op on a binary that predates the method", async () => {
    const wrapper = loadWrapper({ rvGetScene: jest.fn() });

    await expect(wrapper.rvSetCloudAnchorProject("p")).resolves.toBeUndefined();
  });
});
