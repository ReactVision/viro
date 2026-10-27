/**
 * Copyright © 2026 ReactVision
 *
 * <ViroVPS> lifecycle against a scripted navigator: what happens to a map
 * load that is still in flight when the component unmounts, tracking is
 * stopped or restarted, or another <ViroVPS> on the same navigator loads its
 * own map, that polls never overlap, and that a native call that
 * never answers ends in `error` instead of hanging. The map download itself
 * is mocked; only the component's own sequencing is under test.
 */
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: {
    rvGetAuthHeaders: async () => ({ mode: "none", baseUrl: null, headers: {}, projectId: null }),
  },
}));

jest.mock("../components/AR/ViroVPSMapDownload", () => ({
  getLocationMapDownload: jest.fn(async (id: string) => {
    const { ViroVPSError } = jest.requireActual("../components/AR/ViroVPSClient");
    if (id === "loc_no_map") throw new ViroVPSError("the location has no active map", "NO_ASSET", 404);
    if (id === "loc_unpaid") throw new ViroVPSError("VPS needs a paid plan", "PAID_PLAN_REQUIRED", 403);
    if (id === "loc_offline") throw new ViroVPSError("Network request failed", "NETWORK_ERROR");
    return {
      kind: "map",
      scan_id: `scan_${id}`,
      url: `https://vps.example.com/files/${id}`,
      expires_at: 0,
      bytes: 3,
      quality: null,
    };
  }),
  fetchMapBytes: jest.fn(async () => new Uint8Array([1, 2, 3])),
  findNearestMap: jest.fn(),
  getLocationWorldMeshDownload: jest.fn(async (id: string) => {
    if (id === "loc_no_mesh") {
      const { ViroVPSError } = jest.requireActual("../components/AR/ViroVPSClient");
      throw new ViroVPSError("the location has no active world_mesh", "NO_ASSET", 404);
    }
    return { kind: "world_mesh", scan_id: `scan_${id}`, url: `https://vps.example.com/files/m_${id}`, expires_at: 0, bytes: 4 };
  }),
  fetchAssetBytes: jest.fn(async () => new Uint8Array([82, 86, 87, 77])),
}));

import * as React from "react";
import { act } from "react";
import TestRenderer, { ReactTestRenderer } from "react-test-renderer";
import { ViroVPS, ViroVPSTrackingStateEvent } from "../components/AR/ViroVPS";
import * as MapDownload from "../components/AR/ViroVPSMapDownload";
import type {
  ViroVPSLocalizationResult,
  ViroVPSMapLoadResult,
} from "../components/Types/ViroEvents";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function makeNav() {
  const loads: Deferred<ViroVPSMapLoadResult>[] = [];
  const polls: Deferred<ViroVPSLocalizationResult>[] = [];
  const nav = {
    loadVPSMap: jest.fn(() => {
      const d = deferred<ViroVPSMapLoadResult>();
      loads.push(d);
      return d.promise;
    }),
    unloadVPSMap: jest.fn(),
    getVPSLocalization: jest.fn(() => {
      const d = deferred<ViroVPSLocalizationResult>();
      polls.push(d);
      return d.promise;
    }),
  };
  return { nav, loads, polls };
}

function mount(nav: any, extra: Record<string, unknown> = {}) {
  const ref = React.createRef<ViroVPS>();
  const states: ViroVPSTrackingStateEvent[] = [];
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ViroVPS
        ref={ref}
        arSceneNavigator={nav}
        endpoint="https://vps.example.com"
        credentials={{ projectId: "p", apiKey: "k" }}
        pollIntervalMs={100}
        onTrackingState={(e) => states.push(e)}
        {...extra}
      />
    );
  });
  return { ref, states, renderer };
}

let consoleErrorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  // react-test-renderer announces its own deprecation on every create(); any
  // other console.error (a setState after unmount, say) still prints.
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

describe("<ViroVPS> unmount", () => {
  it("unloads a map whose load lands after unmount, and reports nothing after unmount", async () => {
    const { nav, loads } = makeNav();
    const { ref, states, renderer } = mount(nav);

    let started!: Promise<unknown>;
    await act(async () => {
      started = ref.current!.startTracking("loc_a");
      await flush();
    });
    expect(nav.loadVPSMap).toHaveBeenCalledTimes(1);
    const statesBeforeUnmount = states.length;

    act(() => renderer.unmount());
    nav.unloadVPSMap.mockClear();

    await act(async () => {
      loads[0].resolve({ success: true });
      await flush();
    });
    await expect(started).resolves.toEqual({
      success: false,
      error: "superseded",
      errorDetail: { code: "SUPERSEDED", status: null, message: "superseded" },
    });

    expect(nav.unloadVPSMap).toHaveBeenCalledTimes(1);
    expect(states.length).toBe(statesBeforeUnmount);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(nav.getVPSLocalization).not.toHaveBeenCalled();
  });

  it("stops polling and unloads the map it loaded", async () => {
    const { nav, loads } = makeNav();
    const { ref, renderer } = mount(nav);

    await act(async () => {
      const started = ref.current!.startTracking("loc_a");
      await flush();
      loads[0].resolve({ success: true });
      await started;
    });
    nav.unloadVPSMap.mockClear();

    act(() => renderer.unmount());
    expect(nav.unloadVPSMap).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(nav.getVPSLocalization).not.toHaveBeenCalled();
  });
});

describe("<ViroVPS> superseded loads", () => {
  it("unloads a load that lands after stopTracking()", async () => {
    const { nav, loads } = makeNav();
    const { ref, states } = mount(nav);

    await act(async () => {
      ref.current!.startTracking("loc_a");
      await flush();
    });
    act(() => ref.current!.stopTracking());
    expect(states[states.length - 1].state).toBe("idle");
    nav.unloadVPSMap.mockClear();

    await act(async () => {
      loads[0].resolve({ success: true });
      await flush();
    });
    expect(nav.unloadVPSMap).toHaveBeenCalledTimes(1);
    expect(states[states.length - 1].state).toBe("idle");

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(nav.getVPSLocalization).not.toHaveBeenCalled();
  });

  it("leaves a newer session's loaded map alone", async () => {
    const { nav, loads } = makeNav();
    const { ref } = mount(nav);

    await act(async () => {
      ref.current!.startTracking("loc_a");
      await flush();
    });
    let second!: Promise<unknown>;
    await act(async () => {
      second = ref.current!.startTracking("loc_b");
      await flush();
    });
    expect(loads.length).toBe(2);

    await act(async () => {
      loads[1].resolve({ success: true });
      await flush();
    });
    await expect(second).resolves.toEqual({ success: true, locationId: "loc_b" });
    nav.unloadVPSMap.mockClear();

    await act(async () => {
      loads[0].resolve({ success: true });
      await flush();
    });
    expect(nav.unloadVPSMap).not.toHaveBeenCalled();
  });

  it("keeps a superseded load that lands first for the newer one, and drops it if that one fails", async () => {
    const { nav, loads } = makeNav();
    const { ref } = mount(nav);

    await act(async () => {
      ref.current!.startTracking("loc_a");
      await flush();
    });
    let second!: Promise<unknown>;
    await act(async () => {
      second = ref.current!.startTracking("loc_b");
      await flush();
    });
    nav.unloadVPSMap.mockClear();

    // Native runs loads in order, so an unload now would land after loc_b's load.
    await act(async () => {
      loads[0].resolve({ success: true });
      await flush();
    });
    expect(nav.unloadVPSMap).not.toHaveBeenCalled();

    await act(async () => {
      loads[1].resolve({ success: false, error: "bad map" });
      await flush();
    });
    await expect(second).resolves.toMatchObject({ success: false, error: "bad map" });
    expect(nav.unloadVPSMap).toHaveBeenCalledTimes(1);
  });

  it("times out a load that never answers, and unloads it if it lands later", async () => {
    const { nav, loads } = makeNav();
    const { ref, states } = mount(nav, { loadTimeoutMs: 1000 });

    let started!: Promise<any>;
    await act(async () => {
      started = ref.current!.startTracking("loc_a");
      await flush();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    const result = await started;
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/did not answer/);
    expect(states[states.length - 1].state).toBe("error");
    nav.unloadVPSMap.mockClear();

    await act(async () => {
      loads[0].resolve({ success: true });
      await flush();
    });
    expect(nav.unloadVPSMap).toHaveBeenCalledTimes(1);
  });
});

describe("<ViroVPS> two scenes on one navigator", () => {
  // One map and one mesh slot, applied in call order as the native side does,
  // so the covered scene's load lands before the newer scene's.
  function slotNav() {
    const slot: { map: string | null; mesh: string | null } = { map: null, mesh: null };
    const pending: Record<"map" | "mesh", (() => void)[]> = { map: [], mesh: [] };
    const load = (kind: "map" | "mesh") => () =>
      new Promise<ViroVPSMapLoadResult>((resolve) => {
        const name = `${kind}${pending[kind].length + 1}`;
        pending[kind].push(() => {
          slot[kind] = name;
          resolve({ success: true });
        });
      });
    const nav = {
      loadVPSMap: jest.fn(load("map")),
      unloadVPSMap: jest.fn(() => (slot.map = null)),
      loadVPSMapMesh: jest.fn(load("mesh")),
      unloadVPSMapMesh: jest.fn(() => (slot.mesh = null)),
      getVPSLocalization: jest.fn(async () => ({
        available: true,
        loaded: slot.map !== null,
        converged: false,
      })),
    };
    return { nav, slot, pending };
  }

  it("leaves the new scene's map loaded when the covered scene's load lands late", async () => {
    const { nav, slot, pending } = slotNav();
    const covered = mount(nav);
    await act(async () => {
      covered.ref.current!.startTracking("loc_a");
      await flush();
    });
    act(() => covered.renderer.unmount());
    const shown = mount(nav);
    await act(async () => {
      shown.ref.current!.startTracking("loc_b");
      await flush();
    });

    await act(async () => {
      pending.map[0]();
      pending.map[1]();
      await flush();
    });
    expect(slot.map).toBe("map2");

    await act(async () => {
      jest.advanceTimersByTime(100);
      await flush();
    });
    expect(nav.getVPSLocalization).toHaveBeenCalled();
    expect(shown.states.map((s) => s.state)).toEqual(["searching", "mapLoaded"]);
  });

  it("leaves the new scene's mesh loaded when the covered scene's mesh lands late", async () => {
    const { nav, slot, pending } = slotNav();
    const covered = mount(nav, { worldMesh: true });
    await act(async () => {
      covered.ref.current!.startTracking("loc_a");
      await flush();
      pending.map[0]();
      await flush();
    });
    expect(pending.mesh.length).toBe(1);
    act(() => covered.renderer.unmount());
    const shown = mount(nav, { worldMesh: true });
    await act(async () => {
      shown.ref.current!.startTracking("loc_b");
      await flush();
      pending.map[1]();
      await flush();
    });
    expect(pending.mesh.length).toBe(2);

    await act(async () => {
      pending.mesh[0]();
      pending.mesh[1]();
      await flush();
    });
    expect(slot).toEqual({ map: "map2", mesh: "mesh2" });
  });

  it("passes each load's number to the native load and to the unload that drops it", async () => {
    const { nav, pending } = slotNav();
    const covered = mount(nav, { worldMesh: true });
    await act(async () => {
      covered.ref.current!.startTracking("loc_a");
      await flush();
      pending.map[0]();
      await flush();
      pending.mesh[0]();
      await flush();
    });
    act(() => covered.renderer.unmount());
    const shown = mount(nav, { worldMesh: true });
    await act(async () => {
      shown.ref.current!.startTracking("loc_b");
      await flush();
      pending.map[1]();
      await flush();
      pending.mesh[1]();
      await flush();
    });
    act(() => shown.ref.current!.stopTracking());

    expect(nav.loadVPSMap.mock.calls.map((call: unknown[]) => call[1])).toEqual([1, 2]);
    expect(nav.loadVPSMapMesh.mock.calls.map((call: unknown[]) => call[2])).toEqual([1, 2]);
    expect(nav.unloadVPSMap.mock.calls).toEqual([[1], [2]]);
    expect(nav.unloadVPSMapMesh.mock.calls).toEqual([[1], [2]]);
  });

  it("keeps the new scene's map when the native side applies the covered scene's load last", async () => {
    // The native rule: a load is applied only while no newer load or unload
    // has been called, and an unload naming a replaced load does nothing.
    const slot = { map: null as string | null };
    let requests = 0;
    let newest = 0;
    const finish: (() => void)[] = [];
    const nav = {
      loadVPSMap: jest.fn((_bytes: Uint8Array, load = 0) => {
        newest = load;
        const request = ++requests;
        return new Promise<ViroVPSMapLoadResult>((resolve) => {
          finish.push(() => {
            if (request !== requests) return resolve({ success: false, error: "Superseded" });
            slot.map = `map${load}`;
            resolve({ success: true });
          });
        });
      }),
      unloadVPSMap: jest.fn((load = 0) => {
        if (load !== 0 && load !== newest) return;
        requests++;
        slot.map = null;
      }),
      getVPSLocalization: jest.fn(async () => ({
        available: true,
        loaded: slot.map !== null,
        converged: false,
      })),
    };

    const covered = mount(nav);
    await act(async () => {
      covered.ref.current!.startTracking("loc_a");
      await flush();
    });
    act(() => covered.renderer.unmount());
    const shown = mount(nav);
    await act(async () => {
      shown.ref.current!.startTracking("loc_b");
      await flush();
    });

    await act(async () => {
      finish[1]();
      await flush();
      finish[0]();
      await flush();
      jest.advanceTimersByTime(100);
      await flush();
    });
    expect(slot.map).toBe("map2");
    expect(nav.getVPSLocalization).toHaveBeenCalled();
    expect(shown.states.map((s) => s.state)).toEqual(["searching", "mapLoaded"]);
  });
});

describe("<ViroVPS> polling", () => {
  async function startLoaded(extra: Record<string, unknown> = {}) {
    const ctx = makeNav();
    const mounted = mount(ctx.nav, extra);
    await act(async () => {
      const started = mounted.ref.current!.startTracking("loc_a");
      await flush();
      ctx.loads[0].resolve({ success: true });
      await started;
    });
    return { ...ctx, ...mounted };
  }

  it("does not start a poll while the previous one is pending, and errors on timeout", async () => {
    const { nav, polls, states } = await startLoaded({ localizationTimeoutMs: 450 });

    await act(async () => {
      jest.advanceTimersByTime(100); // first tick
      await flush();
    });
    expect(nav.getVPSLocalization).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(300); // three more ticks, all skipped
      await flush();
    });
    expect(nav.getVPSLocalization).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(200); // past the 450 ms timeout
      await flush();
    });
    expect(states[states.length - 1].state).toBe("error");
    expect(states[states.length - 1].error).toMatch(/did not answer/);
    // Still pending natively, so still no second call.
    expect(nav.getVPSLocalization).toHaveBeenCalledTimes(1);

    await act(async () => {
      polls[0].resolve({ available: true, loaded: true, converged: false });
      await flush();
      jest.advanceTimersByTime(100);
      await flush();
    });
    expect(nav.getVPSLocalization).toHaveBeenCalledTimes(2);
    await act(async () => {
      polls[1].resolve({ available: true, loaded: true, converged: false });
      await flush();
    });
    expect(states[states.length - 1].state).toBe("mapLoaded");
  });

  it("goes idle and stops polling when the native side reports no map loaded", async () => {
    const { nav, polls, states } = await startLoaded();

    await act(async () => {
      jest.advanceTimersByTime(100);
      await flush();
      polls[0].resolve({ available: true, loaded: false });
      await flush();
    });
    expect(states[states.length - 1]).toEqual({
      state: "idle",
      locationId: "loc_a",
      error: undefined,
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flush();
    });
    expect(nav.getVPSLocalization).toHaveBeenCalledTimes(1);
  });

  it("reports error -> error when the message changes, not when it repeats", async () => {
    const { polls, states } = await startLoaded();

    const tick = async (result: ViroVPSLocalizationResult, index: number) => {
      await act(async () => {
        jest.advanceTimersByTime(100);
        await flush();
        polls[index].resolve(result);
        await flush();
      });
    };
    await tick({ available: false, error: "first" }, 0);
    await tick({ available: false, error: "first" }, 1);
    await tick({ available: false, error: "second" }, 2);

    const errors = states.filter((s) => s.state === "error").map((s) => s.error);
    expect(errors).toEqual(["first", "second"]);
    expect(states.filter((s) => s.state === "error").map((s) => s.errorDetail)).toEqual([
      { code: "LOCALIZATION_UNAVAILABLE", status: null, message: "first" },
      { code: "LOCALIZATION_UNAVAILABLE", status: null, message: "second" },
    ]);
  });
});

describe("<ViroVPS> errors and credentials", () => {
  it("reports vps-server's code and status, and a null status when there was no response", async () => {
    const { nav } = makeNav();
    const { ref, states } = mount(nav);

    const results: any[] = [];
    for (const id of ["loc_no_map", "loc_unpaid", "loc_offline"]) {
      await act(async () => {
        results.push(await ref.current!.startTracking(id));
      });
    }

    const expected = [
      { code: "NO_ASSET", status: 404, message: "the location has no active map" },
      { code: "PAID_PLAN_REQUIRED", status: 403, message: "VPS needs a paid plan" },
      { code: "NETWORK_ERROR", status: null, message: "Network request failed" },
    ];
    expect(results.map((r) => r.errorDetail)).toEqual(expected);
    expect(results.map((r) => r.error)).toEqual(expected.map((e) => e.message));
    expect(states.filter((s) => s.state === "error").map((s) => s.errorDetail)).toEqual(expected);
    expect(nav.loadVPSMap).not.toHaveBeenCalled();
  });

  it("reports unsupported, without searching, for a navigator with no VPS (as on web)", async () => {
    const { ref, states } = mount(undefined);
    let result: any;
    await act(async () => {
      result = await ref.current!.startTracking("loc_a");
    });
    const errorDetail = {
      code: "UNSUPPORTED",
      status: null,
      message: "This navigator does not expose loadVPSMap",
    };
    expect(result).toEqual({ success: false, error: errorDetail.message, errorDetail });
    expect(states).toEqual([
      { state: "unsupported", error: errorDetail.message, errorDetail },
    ]);
  });

  it("hands each request the host's connection, so its credentials function is read again", async () => {
    const { nav, loads } = makeNav();
    let token = "t1";
    const credentials = jest.fn(async () => ({ projectId: "p", accessToken: token }));
    const { ref } = mount(nav, { credentials, appUserId: "user-1" });
    await act(async () => {
      const started = ref.current!.startTracking("loc_a");
      await flush();
      loads[0].resolve({ success: true });
      await started;
    });

    const calls = (MapDownload.getLocationMapDownload as jest.Mock).mock.calls;
    const passed = calls[calls.length - 1][1];
    expect(passed).toEqual({
      endpoint: "https://vps.example.com",
      serverEndpoint: undefined,
      credentials,
      appUserId: "user-1",
    });
    const { resolveVPSCredentials } = jest.requireActual("../components/AR/ViroVPSClient");
    await expect(resolveVPSCredentials(passed.credentials, passed.appUserId)).resolves.toEqual({
      projectId: "p",
      accessToken: "t1",
      appUserId: "user-1",
    });
    token = "t2";
    await expect(resolveVPSCredentials(passed.credentials, passed.appUserId)).resolves.toEqual({
      projectId: "p",
      accessToken: "t2",
      appUserId: "user-1",
    });
    expect(credentials).toHaveBeenCalledTimes(2);
  });
});


describe("<ViroVPS> worldMesh", () => {
  function meshNav() {
    const made = makeNav();
    const nav = {
      ...made.nav,
      loadVPSMapMesh: jest.fn(async () => ({ success: true })),
      unloadVPSMapMesh: jest.fn(),
    };
    return { ...made, nav };
  }

  async function track(ref: React.RefObject<ViroVPS | null>, loads: any[], id: string) {
    await act(async () => {
      const started = ref.current!.startTracking(id);
      await flush();
      loads[loads.length - 1].resolve({ success: true });
      await started;
      await flush();
    });
  }

  it("loads the location's mesh after its map, and unloads it with the map", async () => {
    const { nav, loads } = meshNav();
    const events: unknown[] = [];
    const { ref } = mount(nav, { worldMesh: { physics: false }, onWorldMesh: (e: unknown) => events.push(e) });
    await track(ref, loads, "loc_a");
    expect(nav.loadVPSMapMesh).toHaveBeenCalledWith(
      new Uint8Array([82, 86, 87, 77]),
      { occlusion: true, physics: false },
      1
    );
    expect(events).toEqual([{ locationId: "loc_a", success: true, error: undefined }]);

    act(() => ref.current!.stopTracking());
    expect(nav.unloadVPSMapMesh).toHaveBeenCalled();
  });

  it("reports a location without a mesh as missing, not as an error", async () => {
    const { nav, loads } = meshNav();
    const events: unknown[] = [];
    const states: string[] = [];
    const { ref } = mount(nav, {
      worldMesh: true,
      onWorldMesh: (e: unknown) => events.push(e),
      onTrackingState: (e: ViroVPSTrackingStateEvent) => states.push(e.state),
    });
    await track(ref, loads, "loc_no_mesh");
    expect(events).toEqual([{ locationId: "loc_no_mesh", success: false, missing: true }]);
    expect(nav.loadVPSMapMesh).not.toHaveBeenCalled();
    expect(states).not.toContain("error"); // tracking carries on without it
  });

  it("does nothing without the prop", async () => {
    const { nav, loads } = meshNav();
    const { ref } = mount(nav);
    await track(ref, loads, "loc_a");
    expect(nav.loadVPSMapMesh).not.toHaveBeenCalled();
  });
});
