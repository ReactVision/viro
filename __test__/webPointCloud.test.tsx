/**
 * The tracker's feature points on the web: native's onARPointCloudUpdate payload,
 * FeaturePoint hit results, and the session and renderer calls the scene makes.
 */
import * as React from "react";
import { act, create } from "react-test-renderer";
import { featurePointHitResult } from "../components/Web/viroHitTest";
import { toViroPointCloud, useViroPointCloud } from "../components/Web/viroPointCloud";

describe("point cloud payload", () => {
  it("is native's shape: [x, y, z, confidence] and an id per point", () => {
    expect(toViroPointCloud({ points: [[1, 2, 3], [4, 5, 6]], identifiers: [7, 8] })).toEqual({
      points: [[1, 2, 3, 1], [4, 5, 6, 1]],
      identifiers: [7, 8],
    });
  });
});

describe("featurePointHitResult", () => {
  it("is a FeaturePoint result with no anchor", () => {
    const hit = featurePointHitResult([0, -1, -2], 2.2, [0, 0, 1]);
    expect(hit).toMatchObject({ type: "FeaturePoint", anchorId: "", hasDepthData: false, distance: 2.2 });
    expect(hit.transform.position).toEqual([0, -1, -2]);
  });
});

describe("useViroPointCloud", () => {
  function Host(props: { session: any; scene: any; onUpdate?: (c: any) => void; display?: any }) {
    useViroPointCloud(props.session, props.scene, props.onUpdate, props.display);
    return null;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    (global as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 16);
    (global as any).cancelAnimationFrame = (h: number) => clearTimeout(h);
  });
  afterEach(() => jest.useRealTimers());

  it("reads points only while a prop wants them, and reports them each frame", () => {
    const enabled: boolean[] = [];
    let points = { points: [] as [number, number, number][], identifiers: [] as number[] };
    const session = { setPointCloudEnabled: (on: boolean) => enabled.push(on), getPointCloud: () => points };
    const updates: any[] = [];
    let root: any;
    act(() => {
      root = create(<Host session={session} scene={{}} onUpdate={(c) => updates.push(c)} />);
    });
    expect(enabled).toEqual([true]);
    act(() => jest.advanceTimersByTime(20));
    expect(updates).toHaveLength(0); // nothing until the tracker has points
    points = { points: [[0, 0, -1]], identifiers: [3] };
    act(() => jest.advanceTimersByTime(20));
    expect(updates.at(-1)).toEqual({ points: [[0, 0, -1, 1]], identifiers: [3] });
    act(() => root.unmount());
    expect(enabled).toEqual([true, false]);
  });

  it("displayPointCloud asks the renderer to draw the points, and stops on unmount", () => {
    const calls: any[] = [];
    const session = { setPointCloudEnabled: () => {}, getPointCloud: () => ({ points: [], identifiers: [] }) };
    const scene = { arDisplayPointCloud: (on: boolean, o?: any) => (calls.push([on, o]), true) };
    let root: any;
    act(() => {
      root = create(<Host session={session} scene={scene} display={{ imageScale: [0.02, 0.02, 1], maxPoints: 200 }} />);
    });
    expect(calls[0]).toEqual([true, { texture: null, scale: [0.02, 0.02, 1], maxPoints: 200 }]);
    act(() => root.unmount());
    expect(calls.at(-1)).toEqual([false, undefined]);
  });
});
