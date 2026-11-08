import {
  createViroTrackingReadiness,
  viroTrackingLimitedMs,
  viroTrackingReadinessReducer,
  viroTrackingReadyInMs,
  type ViroTrackingReadiness,
} from "../components/hooks/useViroTrackingReady";
import { ViroTrackingStateConstants } from "../components/ViroConstants";

const { TRACKING_NORMAL, TRACKING_LIMITED, TRACKING_UNAVAILABLE } =
  ViroTrackingStateConstants;

const to = (
  r: ViroTrackingReadiness,
  state: ViroTrackingReadiness["state"],
  at: number
) => viroTrackingReadinessReducer(r, { type: "state", state, at });

describe("viroTrackingReadyInMs", () => {
  it("is ready after a second of normal tracking", () => {
    const r = createViroTrackingReadiness(TRACKING_NORMAL, 0);
    expect(viroTrackingReadyInMs(r, 999)).toBe(1);
    expect(viroTrackingReadyInMs(r, 1000)).toBe(0);
    expect(viroTrackingReadyInMs(r, 5000)).toBe(0);
  });

  it("lets limited tracking through after the longer wait", () => {
    const r = createViroTrackingReadiness(TRACKING_LIMITED, 0);
    expect(viroTrackingReadyInMs(r, 3999)).toBe(1);
    expect(viroTrackingReadyInMs(r, 4000)).toBe(0);
  });

  it("is never ready while tracking is unavailable or unknown", () => {
    expect(
      viroTrackingReadyInMs(createViroTrackingReadiness(TRACKING_UNAVAILABLE, 0), 60_000)
    ).toBeNull();
    expect(viroTrackingReadyInMs(createViroTrackingReadiness(null, 0), 60_000)).toBeNull();
  });

  it("starts the wait again on any change of state", () => {
    let r = createViroTrackingReadiness(TRACKING_NORMAL, 0);
    r = to(r, TRACKING_LIMITED, 2000);
    expect(viroTrackingReadyInMs(r, 2500)).toBe(3500);
    r = to(r, TRACKING_NORMAL, 3000);
    expect(viroTrackingReadyInMs(r, 3500)).toBe(500);
  });

  it("does not restart the wait when the same state is reported again", () => {
    const r = createViroTrackingReadiness(TRACKING_NORMAL, 0);
    expect(to(r, TRACKING_NORMAL, 800)).toBe(r);
  });

  it("takes other waits", () => {
    const normal = createViroTrackingReadiness(TRACKING_NORMAL, 0);
    expect(viroTrackingReadyInMs(normal, 0, { normalMs: 0 })).toBe(0);
    const limited = createViroTrackingReadiness(TRACKING_LIMITED, 0);
    expect(viroTrackingReadyInMs(limited, 1000, { limitedMs: 1500 })).toBe(500);
  });
});

describe("viroTrackingLimitedMs", () => {
  it("adds up the time spent other than normal, up to now", () => {
    let r = createViroTrackingReadiness(null, 0);
    r = to(r, TRACKING_NORMAL, 500);
    r = to(r, TRACKING_LIMITED, 1500);
    expect(viroTrackingLimitedMs(r, 2000)).toBe(1000);
    r = to(r, TRACKING_UNAVAILABLE, 2000);
    r = to(r, TRACKING_NORMAL, 2300);
    expect(viroTrackingLimitedMs(r, 9000)).toBe(1300);
  });

  it("counts from a reset, also partway through a limited stretch", () => {
    let r = createViroTrackingReadiness(TRACKING_LIMITED, 0);
    r = viroTrackingReadinessReducer(r, { type: "resetCount", at: 1800 });
    expect(viroTrackingLimitedMs(r, 2000)).toBe(200);
    r = to(r, TRACKING_NORMAL, 2100);
    expect(viroTrackingLimitedMs(r, 5000)).toBe(300);
  });

  it("leaves the wait alone on a reset", () => {
    const r = createViroTrackingReadiness(TRACKING_NORMAL, 0);
    const reset = viroTrackingReadinessReducer(r, { type: "resetCount", at: 600 });
    expect(viroTrackingReadyInMs(reset, 1000)).toBe(0);
  });
});
