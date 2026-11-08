/**
 * Copyright © 2026 ReactVision
 *
 * <ViroVPS localization="server">: no map download, frames sent to the
 * backend, its answers reported to the native fuser with each frame's pose,
 * against a scripted navigator and a mocked localise call.
 */
jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios", constants: {} },
  requireNativeComponent: (name: string) => name,
}));

jest.mock("../components/AR/ViroVPSMapDownload", () => ({
  getLocationMapDownload: jest.fn(),
  fetchMapBytes: jest.fn(),
  findNearestMap: jest.fn(async () => null),
  getLocationWorldMeshDownload: jest.fn(),
  fetchAssetBytes: jest.fn(),
  fetchLocationSemanticObjects: jest.fn(async () => []),
}));

const mockLocalise = jest.fn();
jest.mock("../components/AR/ViroVPSQuery", () => ({
  ...jest.requireActual("../components/AR/ViroVPSQuery"),
  localiseFrameOnServer: (...args: unknown[]) => mockLocalise(...args),
}));

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { ViroVPS, ViroVPSTrackingStateEvent } from "../components/AR/ViroVPS";
import { ViroVPSError } from "../components/AR/ViroVPSClient";
import { nearFromRenderPose } from "../components/AR/ViroVPSQuery";
import * as MapDownload from "../components/AR/ViroVPSMapDownload";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const POSE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.5, 1.2, -2, 1];
const FRAME = { success: true, image: "AA==", width: 4, height: 2, fx: 9, fy: 9, cx: 2, cy: 1, worldFromCamera: POSE };
const T = [1, 0, 0, 0.3, 0, 1, 0, 0, 0, 0, 1, 1.5, 0, 0, 0, 1];
const fix = (localised = true) => ({
  location_id: "loc",
  scan_id: "scan",
  localised,
  inliers: localised ? 120 : 0,
  T_map_cam: localised ? T : null,
});

function makeNav(extra: Record<string, unknown> = {}) {
  return {
    loadVPSMap: jest.fn(async () => ({ success: true })),
    unloadVPSMap: jest.fn(),
    startVPSServerSession: jest.fn(async () => ({ success: true })),
    reportVPSServerFix: jest.fn(async () => ({ success: true })),
    getVPSLocalization: jest.fn(async () => ({ available: true, loaded: true, mode: "server", converged: false })),
    captureVPSQueryFrame: jest.fn(async () => FRAME),
    ...extra,
  };
}

function mount(nav: any, extra: Record<string, unknown> = {}) {
  const ref = React.createRef<ViroVPS>();
  const states: ViroVPSTrackingStateEvent[] = [];
  let renderer: any;
  act(() => {
    renderer = TestRenderer.create(
      <ViroVPS
        ref={ref}
        arSceneNavigator={nav}
        endpoint="https://vps.example.com"
        credentials={{ projectId: "p", apiKey: "k" }}
        localization="server"
        pollIntervalMs={100}
        serverFixIntervalMs={1000}
        serverRefreshIntervalMs={10000}
        onTrackingState={(e) => states.push(e)}
        {...extra}
      />
    );
  });
  return { ref, states, renderer };
}

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Advances fake time in poll-sized steps, letting promises settle in between. */
async function tick(ms: number) {
  for (let t = 0; t < ms; t += 100) {
    jest.advanceTimersByTime(100);
    await flush();
  }
}

let consoleErrorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  mockLocalise.mockReset();
  (MapDownload.getLocationMapDownload as jest.Mock).mockClear();
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

describe('<ViroVPS localization="server">', () => {
  it("starts a native server session instead of downloading a map, then reports fixes with the frame's pose", async () => {
    mockLocalise.mockResolvedValue(fix());
    const nav = makeNav();
    const { ref } = mount(nav);

    let result: any;
    await act(async () => {
      result = await ref.current!.startTracking("loc");
    });
    expect(result).toEqual({ success: true, locationId: "loc" });
    expect(MapDownload.getLocationMapDownload).not.toHaveBeenCalled();
    expect(nav.loadVPSMap).not.toHaveBeenCalled();
    expect(nav.startVPSServerSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await flush();
    });
    expect(mockLocalise).toHaveBeenCalledTimes(1);
    expect(mockLocalise.mock.calls[0][0]).toBe("loc");
    expect(mockLocalise.mock.calls[0][1]).toBe(FRAME);
    expect(mockLocalise.mock.calls[0][2]).toBeUndefined(); // no hint before it converges
    expect(nav.reportVPSServerFix).toHaveBeenCalledWith(POSE, T, 120);

    // the next frame goes a second later, until it converges, with the same device id
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(mockLocalise).toHaveBeenCalledTimes(2);
    expect(mockLocalise.mock.calls[0][3]).toMatch(/^[0-9a-z]{8,}$/);
    expect(mockLocalise.mock.calls[1][3]).toBe(mockLocalise.mock.calls[0][3]);
  });

  it("a frame that does not localise reports nothing and is retried", async () => {
    mockLocalise.mockResolvedValueOnce(fix(false)).mockResolvedValue(fix());
    const nav = makeNav();
    const { ref } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("loc");
      await flush();
    });
    expect(nav.reportVPSServerFix).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(nav.reportVPSServerFix).toHaveBeenCalledTimes(1);
  });

  it("once converged, frames slow down and carry the last pose as a hint", async () => {
    mockLocalise.mockResolvedValue(fix());
    const renderPose = "1,0,0,0,0,1,0,0,0,0,1,0,2,3,4,1";
    const nav = makeNav({
      getVPSLocalization: jest.fn(async () => ({
        available: true,
        loaded: true,
        mode: "server",
        converged: true,
        renderPose,
      })),
    });
    const { ref } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("loc");
      await flush();
    });
    // the poll sees the convergence; the frame after it is the first slow one
    await act(async () => {
      await tick(1100);
    });
    const sent = mockLocalise.mock.calls.length;
    await act(async () => {
      await tick(9000);
    });
    expect(mockLocalise.mock.calls.length).toBe(sent); // not every second any more
    await act(async () => {
      await tick(2000);
    });
    expect(mockLocalise.mock.calls.length).toBe(sent + 1);
    expect(mockLocalise.mock.calls.at(-1)[2]).toEqual(nearFromRenderPose(renderPose));
  });

  it("a location without a server map ends tracking with NO_SERVER_MAP", async () => {
    mockLocalise.mockRejectedValue(new ViroVPSError("built without server mode", "NO_SERVER_MAP", 409));
    const nav = makeNav();
    const { ref, states } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("loc");
      await flush();
    });
    expect(states.at(-1)?.state).toBe("error");
    expect(states.at(-1)?.errorDetail?.code).toBe("NO_SERVER_MAP");
    expect(nav.unloadVPSMap).toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flush();
    });
    expect(mockLocalise).toHaveBeenCalledTimes(1);
  });

  it("a refusal for the plan or the team's compute billing, or no server, ends tracking with its code", async () => {
    for (const [code, status] of [
      ["COMPUTE_SPEND_LIMIT_REACHED", 403],
      ["PAID_PLAN_REQUIRED", 403],
      ["INVALID_API_KEY", 401],
      ["VPS_SERVER_NOT_CONFIGURED", undefined],
    ] as const) {
      mockLocalise.mockReset();
      mockLocalise.mockRejectedValue(new ViroVPSError("refused", code, status));
      const nav = makeNav();
      const { ref, states } = mount(nav);
      await act(async () => {
        await ref.current!.startTracking("loc");
        await flush();
        jest.advanceTimersByTime(5000);
        await flush();
      });
      expect(states.at(-1)?.state).toBe("error");
      expect(states.at(-1)?.errorDetail).toMatchObject({ code, status: status ?? null });
      expect(mockLocalise).toHaveBeenCalledTimes(1);
    }
  });

  it("a busy server or billing it could not check is retried", async () => {
    mockLocalise
      .mockRejectedValueOnce(new ViroVPSError("busy", "SERVER_BUSY", 503))
      .mockRejectedValueOnce(new ViroVPSError("try again", "COMPUTE_BILLING_UNAVAILABLE", 503))
      .mockResolvedValue(fix());
    const nav = makeNav();
    const { ref, states } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("loc");
      await flush();
      await tick(2000);
    });
    expect(states.some((s) => s.state === "error")).toBe(false);
    expect(nav.reportVPSServerFix).toHaveBeenCalledTimes(1);
  });

  it("a network failure is retried, not fatal", async () => {
    mockLocalise.mockRejectedValueOnce(new ViroVPSError("offline", "NETWORK_ERROR")).mockResolvedValue(fix());
    const nav = makeNav();
    const { ref, states } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("loc");
      await flush();
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(states.some((s) => s.state === "error")).toBe(false);
    expect(nav.reportVPSServerFix).toHaveBeenCalledTimes(1);
  });

  it("a native build without the frame pose is unsupported", async () => {
    const { worldFromCamera: _, ...old } = FRAME;
    const nav = makeNav({ captureVPSQueryFrame: jest.fn(async () => old) });
    const { ref, states } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("loc");
      await flush();
    });
    expect(states.at(-1)?.state).toBe("unsupported");
    expect(mockLocalise).not.toHaveBeenCalled();
  });

  it("a navigator without server mode is unsupported up front", async () => {
    const nav = makeNav({ startVPSServerSession: undefined });
    const { ref } = mount(nav);
    let result: any;
    await act(async () => {
      result = await ref.current!.startTracking("loc");
    });
    expect(result.success).toBe(false);
    expect(result.errorDetail.code).toBe("UNSUPPORTED");
  });

  it("stopTracking ends the loop", async () => {
    mockLocalise.mockResolvedValue(fix(false));
    const nav = makeNav();
    const { ref } = mount(nav);
    await act(async () => {
      await ref.current!.startTracking("loc");
      await flush();
    });
    act(() => ref.current!.stopTracking());
    const sent = mockLocalise.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flush();
    });
    expect(mockLocalise.mock.calls.length).toBe(sent);
  });
});

describe("nearFromRenderPose", () => {
  it("turns a column-major GL pose into a row-major OpenCV T_map_cam", () => {
    // identity rotation at (2, 3, 4): GL's y and z camera axes flip to OpenCV's
    expect(nearFromRenderPose("1,0,0,0,0,1,0,0,0,0,1,0,2,3,4,1")).toEqual([
      1, -0, -0, 2, 0, -1, -0, 3, 0, -0, -1, 4, 0, -0, -0, 1,
    ]);
    expect(nearFromRenderPose(undefined)).toBeUndefined();
    expect(nearFromRenderPose("1,2,3")).toBeUndefined();
  });
});
