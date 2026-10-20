/**
 * Copyright © 2026 ReactVision
 *
 * <ViroVPS>'s visual search (finding a location from camera images when GPS
 * cannot) and <ViroVPSAnchor>'s props, against a scripted navigator and
 * mocked downloads and queries.
 */
jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios", constants: {} },
  // A string type renders as a host node, so the test sees the props that reach native.
  requireNativeComponent: (name: string) => name,
}));

jest.mock("../components/AR/ViroVPSMapDownload", () => ({
  getLocationMapDownload: jest.fn(async (id: string) => ({
    kind: "map",
    scan_id: `scan_${id}`,
    url: `https://vps.example.com/files/${id}`,
    expires_at: 0,
    bytes: 3,
    quality: null,
  })),
  fetchMapBytes: jest.fn(async () => new Uint8Array([1, 2, 3])),
  findNearestMap: jest.fn(async () => null),
  getLocationWorldMeshDownload: jest.fn(),
  fetchAssetBytes: jest.fn(),
  fetchLocationSemanticObjects: jest.fn(async () => [{ id: 0, label: "chair" }]),
}));

const mockQuery = jest.fn();
jest.mock("../components/AR/ViroVPSQuery", () => ({
  ...jest.requireActual("../components/AR/ViroVPSQuery"),
  queryLocationsByImage: (...args: unknown[]) => mockQuery(...args),
}));

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { ViroVPS, ViroVPSTrackingStateEvent } from "../components/AR/ViroVPS";
import { ViroVPSAnchor } from "../components/AR/ViroVPSAnchor";
import { ViroVPSAnchor as ViroVPSAnchorWeb } from "../components/AR/ViroVPSAnchor.web";
import { ViroVPSError } from "../components/AR/ViroVPSClient";
import * as MapDownload from "../components/AR/ViroVPSMapDownload";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const FRAME = { success: true, image: "AA==", width: 4, height: 2, fx: 9, fy: 9, cx: 2, cy: 1 };
const localised = (id: string) => ({ location_id: id, scan_id: `s_${id}`, score: 0.4, localised: true, inliers: 50 });

function makeNav(extra: Record<string, unknown> = {}) {
  return {
    loadVPSMap: jest.fn(async () => ({ success: true })),
    unloadVPSMap: jest.fn(),
    getVPSLocalization: jest.fn(async () => ({ available: true, loaded: true, converged: false })),
    captureVPSQueryFrame: jest.fn(async () => FRAME),
    getCameraGeospatialPose: jest.fn(async () => ({ success: false, error: "no geospatial pose" })),
    ...extra,
  };
}

function mount(nav: any, extra: Record<string, unknown> = {}) {
  const ref = React.createRef<ViroVPS>();
  const states: ViroVPSTrackingStateEvent[] = [];
  act(() => {
    TestRenderer.create(
      <ViroVPS
        ref={ref}
        arSceneNavigator={nav}
        endpoint="https://vps.example.com"
        credentials={{ projectId: "p", apiKey: "k" }}
        pollIntervalMs={100}
        visualSearchIntervalMs={1000}
        visualSearchTimeoutMs={5000}
        onTrackingState={(e) => states.push(e)}
        {...extra}
      />
    );
  });
  return { ref, states };
}

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

let consoleErrorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  mockQuery.mockReset();
  const original = console.error;
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("react-test-renderer is deprecated")) return;
    original(...args);
  });
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
  jest.useRealTimers();
});

describe("<ViroVPS> visual search", () => {
  it('"auto" without a geospatial pose finds the location from the camera image', async () => {
    mockQuery.mockResolvedValueOnce([localised("loc_indoor")]);
    const nav = makeNav();
    const { ref } = mount(nav);

    let result: any;
    await act(async () => {
      result = await ref.current!.startTracking("auto");
    });

    expect(result).toEqual({ success: true, locationId: "loc_indoor" });
    expect(nav.captureVPSQueryFrame).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toBe(FRAME);
    // No position known: no GPS prefilter.
    expect(mockQuery.mock.calls[0][1]).toEqual({});
    expect(nav.loadVPSMap).toHaveBeenCalledTimes(1);
  });

  it('"auto" with a pose but nothing nearby searches visually, prefiltered around that position', async () => {
    mockQuery.mockResolvedValueOnce([localised("loc_x")]);
    const nav = makeNav({
      getCameraGeospatialPose: jest.fn(async () => ({ success: true, pose: { latitude: 19.4, longitude: -99.1 } })),
    });
    const { ref } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("auto");
    });
    expect(MapDownload.findNearestMap).toHaveBeenCalled();
    expect(mockQuery.mock.calls[0][1]).toEqual({ lat: 19.4, lon: -99.1, radiusM: 500 });
  });

  it("retries until a view localises, without loading a map for an unlocalised match", async () => {
    mockQuery
      .mockResolvedValueOnce([{ ...localised("loc_wrong"), localised: false, score: 0.9 }])
      .mockResolvedValueOnce([localised("loc_right")]);
    const nav = makeNav();
    const { ref } = mount(nav);

    let started!: Promise<any>;
    await act(async () => {
      started = ref.current!.startTracking("visual");
      await flush();
    });
    expect(nav.loadVPSMap).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    await act(async () => {
      await started;
    });
    expect(await started).toEqual({ success: true, locationId: "loc_right" });
    expect(nav.captureVPSQueryFrame).toHaveBeenCalledTimes(2);
  });

  it("ends in error when no view localises before the timeout", async () => {
    mockQuery.mockResolvedValue([]);
    const nav = makeNav();
    const { ref, states } = mount(nav);

    let started!: Promise<any>;
    await act(async () => {
      started = ref.current!.startTracking("visual");
      await flush();
    });
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await flush();
      });
    }
    const result = await started;
    expect(result.success).toBe(false);
    expect(result.error).toBe("No VPS location matched the camera view");
    expect(result.errorDetail).toEqual({
      code: "NO_LOCATION",
      status: null,
      message: "No VPS location matched the camera view",
    });
    expect(states[states.length - 1].state).toBe("error");
    expect(nav.loadVPSMap).not.toHaveBeenCalled();
  });

  it("ends with the server's code and status when the last query was refused", async () => {
    mockQuery.mockRejectedValue(new ViroVPSError("VPS needs a paid plan", "PAID_PLAN_REQUIRED", 403));
    const nav = makeNav();
    const { ref, states } = mount(nav);

    let started!: Promise<any>;
    await act(async () => {
      started = ref.current!.startTracking("visual");
      await flush();
    });
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await flush();
      });
    }
    const errorDetail = { code: "PAID_PLAN_REQUIRED", status: 403, message: "VPS needs a paid plan" };
    expect((await started).errorDetail).toEqual(errorDetail);
    expect(states[states.length - 1].errorDetail).toEqual(errorDetail);
  });

  it("visualSearch={false} keeps \"auto\" GPS-only", async () => {
    const nav = makeNav();
    const { ref } = mount(nav, { visualSearch: false });
    let result: any;
    await act(async () => {
      result = await ref.current!.startTracking("auto");
    });
    expect(result).toEqual({
      success: false,
      locationId: undefined,
      error: "no geospatial pose",
      errorDetail: { code: "NO_LOCATION", status: null, message: "no geospatial pose" },
    });
    expect(nav.captureVPSQueryFrame).not.toHaveBeenCalled();
  });

  it("stopTracking during the search ends it without loading anything", async () => {
    mockQuery.mockResolvedValue([]);
    const nav = makeNav();
    const { ref } = mount(nav);
    let started!: Promise<any>;
    await act(async () => {
      started = ref.current!.startTracking("visual");
      await flush();
    });
    act(() => ref.current!.stopTracking());
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(await started).toEqual({
      success: false,
      error: "superseded",
      errorDetail: { code: "SUPERSEDED", status: null, message: "superseded" },
    });
    expect(nav.captureVPSQueryFrame).toHaveBeenCalledTimes(1);
  });

  it("getSemanticObjects reads the tracked location's objects, and [] when nothing is tracked", async () => {
    mockQuery.mockResolvedValueOnce([localised("loc_s")]);
    const nav = makeNav();
    const { ref } = mount(nav);
    await expect(ref.current!.getSemanticObjects()).resolves.toEqual([]);
    await act(async () => {
      await ref.current!.startTracking("visual");
    });
    await expect(ref.current!.getSemanticObjects()).resolves.toEqual([{ id: 0, label: "chair" }]);
    expect((MapDownload.fetchLocationSemanticObjects as jest.Mock).mock.calls[0][0]).toBe("loc_s");
  });
});

describe("<ViroVPSAnchor>", () => {
  it("renders the native anchor with no transform props, visible by default", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ViroVPSAnchor viroTag="statue">
          <React.Fragment />
        </ViroVPSAnchor>
      );
    });
    const host = renderer.root.findByType("VRTVPSAnchor" as any);
    expect(host.props.visible).toBe(true);
    expect(host.props.viroTag).toBe("statue");
    expect(host.props.position).toBeUndefined();
    expect(host.props.rotation).toBeUndefined();
  });

  it("passes visible={false} through and maps the native state event", () => {
    const onAnchorStateChange = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ViroVPSAnchor visible={false} onAnchorStateChange={onAnchorStateChange} />);
    });
    const host = renderer.root.findByType("VRTVPSAnchor" as any);
    expect(host.props.visible).toBe(false);
    host.props.onAnchorStateChangeViro({ nativeEvent: { state: "tracking" } });
    host.props.onAnchorStateChangeViro({ nativeEvent: { state: "bogus" } });
    host.props.onAnchorStateChangeViro({ nativeEvent: { state: "hidden" } });
    expect(onAnchorStateChange.mock.calls).toEqual([[{ state: "tracking" }], [{ state: "hidden" }]]);
  });

  it("renders nothing on web, children included, and warns once", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <React.Fragment>
          <ViroVPSAnchorWeb>
            <ViroVPSAnchor />
          </ViroVPSAnchorWeb>
          <ViroVPSAnchorWeb />
        </React.Fragment>
      );
    });
    expect(renderer.toJSON()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
