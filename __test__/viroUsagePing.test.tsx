/**
 * Every scene navigator mount sends one usage ping, built from the native VRTUsageModule (or the
 * page on web) and posted with fetch. ViroXRSceneNavigator counts as one mount: the navigator it
 * renders reads the suppression context and stays quiet.
 */
jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: {
    OS: "ios",
    select: (o: any) => o.ios ?? o.default,
    constants: { reactNativeVersion: { major: 0, minor: 86, patch: 1, prerelease: null } },
  },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
  PermissionsAndroid: { requestMultiple: () => Promise.resolve({}) },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  requireNativeComponent: (name: string) => name,
  findNodeHandle: () => null,
  processColor: (c: any) => c,
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { NativeModules } from "react-native";
import { sendViroUsagePing, ViroTelemetry } from "../components/Utilities/ViroUsagePing";
import { Viro3DSceneNavigator } from "../components/Viro3DSceneNavigator";
import { ViroXRSceneNavigator } from "../components/ViroXRSceneNavigator";
import { ViroQuestEntryPoint } from "../components/ViroQuestEntryPoint";
import { VRQuestNavigatorBridge } from "../components/Utilities/VRQuestNavigatorBridge";
import { VIRO_VERSION } from "../components/Utilities/ViroVersion";

const SCENE = { scene: () => null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const nativeInfo = {
  install_id: "11111111-2222-4333-8444-555555555555",
  app_id: "com.example.app",
  platform: "ios",
  os_version: "26.0",
  device_model: "iPhone16,2",
  app_version: "1.2.0",
  app_build: "42",
  has_rv_credentials: true,
  rv_project_id: "project-1",
  telemetry_enabled: true,
};

const realFetch = globalThis.fetch;
let fetchMock: jest.Mock;

function pings(): any[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
}

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  act(() => renderer.unmount());
}

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ ok: true });
  globalThis.fetch = fetchMock as any;
  (NativeModules as any).VRTUsageModule = {
    getUsageInfo: jest.fn().mockResolvedValue({ ...nativeInfo }),
  };
  ViroTelemetry.setEnabled(true);
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("sendViroUsagePing", () => {
  it("posts the v2 payload with the shared token", async () => {
    sendViroUsagePing("ar", {
      provider: "reactvision",
      depth_enabled: undefined,
      occlusion_mode: "x".repeat(150),
      bad: { nested: true } as any,
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://xyvpofhebevmdnrujnhx.supabase.co/functions/v1/register-device");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer 3oKY0sbd6H46zDQwQhxCR4aAgJ8k79",
    });
    const body = pings()[0];
    expect(body.ping_id).toMatch(UUID);
    expect({ ...body, ping_id: undefined }).toEqual({
      v: 2,
      ping_id: undefined,
      install_id: nativeInfo.install_id,
      app_id: "com.example.app",
      platform: "ios",
      navigator: "ar",
      os_version: "26.0",
      device_model: "iPhone16,2",
      app_version: "1.2.0",
      app_build: "42",
      viro_version: VIRO_VERSION,
      rn_version: "0.86.1",
      is_dev: false,
      has_rv_credentials: true,
      rv_project_id: "project-1",
      features: { provider: "reactvision", occlusion_mode: "x".repeat(100) },
    });
  });

  it("sends a new ping id every time", async () => {
    sendViroUsagePing("3d");
    sendViroUsagePing("3d");
    await flush();
    const [first, second] = pings();
    expect(first.ping_id).not.toBe(second.ping_id);
    expect(first.install_id).toBe(second.install_id);
  });

  it("sends nothing while ViroTelemetry is disabled", async () => {
    ViroTelemetry.setEnabled(false);
    expect(ViroTelemetry.isEnabled()).toBe(false);
    sendViroUsagePing("ar");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(NativeModules.VRTUsageModule.getUsageInfo).not.toHaveBeenCalled();
  });

  it("sends nothing when the native flag turns telemetry off", async () => {
    NativeModules.VRTUsageModule.getUsageInfo.mockResolvedValue({
      ...nativeInfo,
      telemetry_enabled: false,
    });
    sendViroUsagePing("ar");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing on a binary without the native module", async () => {
    delete (NativeModules as any).VRTUsageModule;
    sendViroUsagePing("ar");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing without a global fetch", async () => {
    (globalThis as any).fetch = undefined;
    sendViroUsagePing("ar");
    await flush();
    expect(NativeModules.VRTUsageModule.getUsageInfo).not.toHaveBeenCalled();
  });

  it("swallows a failed request", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    sendViroUsagePing("ar");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("navigator mounts", () => {
  it("pings on every mount", async () => {
    mount(<Viro3DSceneNavigator initialScene={SCENE} pbrEnabled />);
    mount(<Viro3DSceneNavigator initialScene={SCENE} />);
    await flush();
    expect(pings().map((p) => p.navigator)).toEqual(["3d", "3d"]);
    expect(pings()[0].features).toEqual({ pbr_enabled: true });
  });

  it("counts ViroXRSceneNavigator once, as xr", async () => {
    mount(<ViroXRSceneNavigator initialScene={SCENE} occlusionMode="depthBased" />);
    await flush();
    expect(pings()).toHaveLength(1);
    expect(pings()[0].navigator).toBe("xr");
    expect(pings()[0].features).toEqual({ occlusion_mode: "depthBased" });
  });

  it("keeps the Quest headset view quiet, since its XR navigator already pinged", async () => {
    VRQuestNavigatorBridge.setIntent(SCENE, {});
    mount(<ViroQuestEntryPoint />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("on the web", () => {
  function loadWeb() {
    let web!: typeof import("../components/Utilities/ViroUsagePing");
    jest.isolateModules(() => {
      jest.doMock("../components/Utilities/ViroUsageInfo", () =>
        jest.requireActual("../components/Utilities/ViroUsageInfo.web")
      );
      web = require("../components/Utilities/ViroUsagePing");
    });
    return web;
  }

  function setPage(hostname: string, userAgent: string) {
    Object.defineProperty(globalThis, "location", {
      value: { hostname },
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent, maxTouchPoints: 0 },
      configurable: true,
    });
  }

  const realNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  afterEach(() => {
    delete (globalThis as any).location;
    if (realNavigator) Object.defineProperty(globalThis, "navigator", realNavigator);
    jest.dontMock("../components/Utilities/ViroUsageInfo");
  });

  const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

  it("keys the ping on the hostname and reports the browser", async () => {
    setPage("viro.example.com", CHROME_MAC);
    loadWeb().sendViroUsagePing("ar");
    await flush();
    const body = pings()[0];
    expect(body).toMatchObject({
      app_id: "viro.example.com",
      platform: "web",
      os_version: "macOS",
      device_model: null,
      app_version: null,
      rn_version: null,
      has_rv_credentials: null,
      rv_project_id: null,
      features: { browser: "chrome" },
    });
    expect(body.install_id).toMatch(UUID);
  });

  it.each(["localhost", "127.0.0.1", "[::1]", "0.0.0.0", "", "my-mac.local"])(
    "sends nothing from %j",
    async (hostname) => {
      setPage(hostname, CHROME_MAC);
      loadWeb().sendViroUsagePing("3d");
      await flush();
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});
