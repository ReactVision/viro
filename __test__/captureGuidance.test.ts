import {
  createViroCaptureGuidance,
  createViroCaptureHitSampler,
  nearestHitDistance,
  VIRO_CAPTURE_RULES,
  type ViroCaptureGuidance,
} from "../components/AR/ViroCaptureGuidance";
import type { Viro3DPoint } from "../components/Types/ViroUtils";

const UP: Viro3DPoint = [0, 1, 0];
const ORIGIN: Viro3DPoint = [0, 0, 0];
const yaw = (degrees: number): Viro3DPoint => {
  const r = (degrees * Math.PI) / 180;
  return [Math.sin(r), 0, -Math.cos(r)];
};

/** Feeds poses at 30 Hz from t0 to t1, with forward(t) and position(t). */
function walk(
  g: ViroCaptureGuidance,
  t0: number,
  t1: number,
  forward: (t: number) => Viro3DPoint,
  position: (t: number) => Viro3DPoint = () => ORIGIN
) {
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 30) {
    g.pose(t, position(t), forward(t), UP);
  }
}

describe("createViroCaptureGuidance", () => {
  it("says slow down only after turning fast for over a second", () => {
    const g = createViroCaptureGuidance();
    walk(g, 0, 0.8, (t) => yaw(45 * t));
    expect(g.tick(0.8, 0.25).hint).toBeNull();
    walk(g, 0.8, 1.5, (t) => yaw(45 * t));
    expect(g.tick(1.5, 0.25).hint).toBe("fast");
  });

  it("leaves a slow turn alone", () => {
    const g = createViroCaptureGuidance();
    walk(g, 0, 3, (t) => yaw(15 * t));
    g.hit(0, 1.5);
    expect(g.tick(3, 0.25).hint).toBeNull();
  });

  it("points at the walls after two seconds at the floor", () => {
    const g = createViroCaptureGuidance();
    walk(g, 0, 2.1, () => [0, -0.95, -0.3]);
    g.hit(0, 1.5);
    expect(g.tick(2.1, 0.25).hint).toBe("pitch");
  });

  it("reads the centre hit test as too close or blank", () => {
    const close = createViroCaptureGuidance();
    close.hit(0, 0.3);
    expect(close.tick(1, 0.25).hint).toBeNull();
    expect(close.tick(2, 0.25).hint).toBe("close");

    const blank = createViroCaptureGuidance();
    blank.hit(0, null);
    const state = blank.tick(2.5, 0.25);
    expect(state.hint).toBe("blank");
    expect(state.seconds.blank).toBe(0.25);
  });

  it("drops a hint the moment its condition clears", () => {
    const g = createViroCaptureGuidance();
    g.hit(0, null);
    expect(g.tick(2, 0.25).hint).toBe("blank");
    g.hit(2.1, 1.5);
    expect(g.tick(2.2, 0.25).hint).toBeNull();
    // and the hold starts again from the next blank
    g.hit(3, null);
    expect(g.tick(4, 0.25).hint).toBeNull();
    expect(g.tick(5, 0.25).hint).toBe("blank");
  });

  it("shows the faster turn first when several hints hold", () => {
    const g = createViroCaptureGuidance();
    g.hit(0, null);
    walk(g, 0, 2.5, (t) => yaw(60 * t));
    expect(g.tick(2.5, 0.25).hint).toBe("fast");
  });

  it("adds each tick's dt to every hint that is showing", () => {
    const g = createViroCaptureGuidance();
    g.hit(0, null);
    walk(g, 0, 2.5, () => [0, -0.95, -0.3]);
    g.tick(2.5, 0.25);
    const state = g.tick(2.75, 0.25);
    expect(state.hint).toBe("pitch");
    expect(state.seconds).toEqual({ fast: 0, pitch: 0.5, close: 0, blank: 0.5 });
  });

  it("counts a pose jump, but not across a stalled thread", () => {
    const g = createViroCaptureGuidance();
    g.pose(0, ORIGIN, yaw(0), UP);
    g.pose(0.1, [0.5, 0, 0], yaw(0), UP);
    expect(g.tick(0.1, 0.1).jumps).toBe(1);
    g.pose(1, [2, 0, 0], yaw(0), UP);
    expect(g.tick(1, 0.1).jumps).toBe(1);
  });

  it("counts a sudden turn as a jump, not as turning fast", () => {
    const g = createViroCaptureGuidance();
    walk(g, 0, 1, () => yaw(0));
    g.pose(1.03, ORIGIN, yaw(45), UP);
    walk(g, 1.06, 2.5, () => yaw(45));
    const state = g.tick(2.5, 0.25);
    expect(state.jumps).toBe(1);
    expect(state.hint).toBeNull();
  });

  it("takes rule overrides, hold times included", () => {
    const g = createViroCaptureGuidance({ blankHoldS: 0.5, closeM: 1 });
    g.hit(0, null);
    expect(g.tick(0.5, 0.25).hint).toBe("blank");
    const close = createViroCaptureGuidance({ closeM: 1 });
    close.hit(0, 0.8);
    expect(close.tick(VIRO_CAPTURE_RULES.closeHoldS, 0.25).hint).toBe("close");
  });

  it("keeps each guidance's totals to itself", () => {
    const a = createViroCaptureGuidance();
    a.hit(0, null);
    a.tick(3, 1);
    const b = createViroCaptureGuidance();
    expect(b.tick(3, 1).seconds.blank).toBe(0);
  });
});

describe("nearestHitDistance", () => {
  it("measures from the camera to the nearest result", () => {
    expect(
      nearestHitDistance(
        [0, 1, 0],
        [
          { transform: { position: [0, 1, -3] } },
          { transform: { position: [0, 1, -2] } },
        ]
      )
    ).toBe(2);
    expect(nearestHitDistance(ORIGIN, [])).toBeNull();
    expect(nearestHitDistance(ORIGIN, null)).toBeNull();
  });
});

describe("createViroCaptureHitSampler", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  const at = (z: number) => [{ transform: { position: [0, 0, z] as Viro3DPoint } }];

  it("runs one hit test at a time, and none before the first pose", async () => {
    const pending = deferred<any>();
    const hitTest = jest.fn(() => pending.promise);
    let camera: Viro3DPoint | null = null;
    const reportHit = jest.fn();
    const sampler = createViroCaptureHitSampler({
      hitTest,
      getCameraPosition: () => camera,
      reportHit,
    });
    sampler.sample();
    expect(hitTest).not.toHaveBeenCalled();
    camera = ORIGIN;
    sampler.sample();
    sampler.sample();
    expect(hitTest).toHaveBeenCalledTimes(1);
    pending.resolve(at(-2));
    await jest.advanceTimersByTimeAsync(0);
    expect(reportHit).toHaveBeenCalledWith(2);
    sampler.sample();
    expect(hitTest).toHaveBeenCalledTimes(2);
  });

  it("gives up on a hit test that never settles, and drops its late result", async () => {
    const stuck = deferred<any>();
    const next = deferred<any>();
    const hitTest = jest
      .fn<Promise<any>, []>()
      .mockReturnValueOnce(stuck.promise)
      .mockReturnValueOnce(next.promise);
    const reportHit = jest.fn();
    const sampler = createViroCaptureHitSampler({
      hitTest,
      getCameraPosition: () => ORIGIN,
      reportHit,
      timeoutMs: 1000,
    });
    sampler.sample();
    await jest.advanceTimersByTimeAsync(999);
    sampler.sample();
    expect(hitTest).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    sampler.sample();
    expect(hitTest).toHaveBeenCalledTimes(2);
    stuck.resolve(at(-5));
    await jest.advanceTimersByTimeAsync(0);
    expect(reportHit).not.toHaveBeenCalled();
    next.resolve(null);
    await jest.advanceTimersByTimeAsync(0);
    expect(reportHit).toHaveBeenCalledWith(null);
  });

  it("reports nothing for a failed hit test and samples again", async () => {
    const hitTest = jest
      .fn<Promise<any>, []>()
      .mockRejectedValueOnce(new Error("no session"))
      .mockResolvedValueOnce(at(-1));
    const reportHit = jest.fn();
    const sampler = createViroCaptureHitSampler({
      hitTest,
      getCameraPosition: () => ORIGIN,
      reportHit,
    });
    sampler.sample();
    await jest.advanceTimersByTimeAsync(0);
    expect(reportHit).not.toHaveBeenCalled();
    sampler.sample();
    await jest.advanceTimersByTimeAsync(0);
    expect(reportHit).toHaveBeenCalledWith(1);
  });

  it("measures from where the camera is when the result arrives", async () => {
    const pending = deferred<any>();
    let camera: Viro3DPoint = ORIGIN;
    const reportHit = jest.fn();
    const sampler = createViroCaptureHitSampler({
      hitTest: () => pending.promise,
      getCameraPosition: () => camera,
      reportHit,
    });
    sampler.sample();
    camera = [0, 0, -1];
    pending.resolve(at(-3));
    await jest.advanceTimersByTimeAsync(0);
    expect(reportHit).toHaveBeenCalledWith(2);
  });

  it("drops a pending result once cancelled", async () => {
    const pending = deferred<any>();
    const hitTest = jest.fn(() => pending.promise);
    const reportHit = jest.fn();
    const sampler = createViroCaptureHitSampler({
      hitTest,
      getCameraPosition: () => ORIGIN,
      reportHit,
    });
    sampler.sample();
    sampler.cancel();
    pending.resolve(at(-1));
    await jest.advanceTimersByTimeAsync(0);
    expect(reportHit).not.toHaveBeenCalled();
    sampler.sample();
    expect(hitTest).toHaveBeenCalledTimes(1);
  });
});
