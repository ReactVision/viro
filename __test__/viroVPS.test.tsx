/**
 * Copyright © 2026 ReactVision
 *
 * <ViroVPS> lifecycle against a scripted navigator: what happens to a map
 * load that is still in flight when the component unmounts or tracking is
 * stopped or restarted, that polls never overlap, and that a native call that
 * never answers ends in `error` instead of hanging. The map download itself
 * is mocked; only the component's own sequencing is under test.
 */
jest.mock("../components/AR/ViroVPSMapDownload", () => ({
  getLocationMapDownload: jest.fn(async (_e: string, _c: unknown, id: string) => ({
    kind: "map",
    scan_id: `scan_${id}`,
    url: `https://vps.example.com/files/${id}`,
    expires_at: 0,
    bytes: 3,
    quality: null,
  })),
  fetchMapBytes: jest.fn(async () => new Uint8Array([1, 2, 3])),
  findNearestMap: jest.fn(),
}));

import * as React from "react";
import { act } from "react";
import TestRenderer, { ReactTestRenderer } from "react-test-renderer";
import { ViroVPS, ViroVPSTrackingStateEvent } from "../components/AR/ViroVPS";
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
    await expect(started).resolves.toEqual({ success: false, error: "superseded" });

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
  });
});
