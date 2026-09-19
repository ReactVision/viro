import {
  StudioPlacementStore,
  isTapToPlaceAsset,
} from "../components/Studio/domain/placementStore";
import { StudioAsset } from "../components/Studio/types";

type Vec3 = [number, number, number];

const RAD = Math.PI / 180;

/**
 * The euler triple as the renderer applies it, R = Rz·Ry·Rx: X first, then Y,
 * then Z, about the fixed world axes. Written out here rather than imported so
 * these tests fail if the store composes the placement in any other order.
 * Column 1 of this matrix is `dragSurfaceFromAnchor`'s plane normal, which was
 * checked against virocore's own extractRotation and toEuler.
 */
function rotationMatrix(deg: Vec3): [Vec3, Vec3, Vec3] {
  const cx = Math.cos(deg[0] * RAD);
  const sx = Math.sin(deg[0] * RAD);
  const cy = Math.cos(deg[1] * RAD);
  const sy = Math.sin(deg[1] * RAD);
  const cz = Math.cos(deg[2] * RAD);
  const sz = Math.sin(deg[2] * RAD);
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}

/** The world direction of a local axis under an euler triple. */
function localAxisInWorld(deg: Vec3, axis: 0 | 1 | 2): Vec3 {
  const m = rotationMatrix(deg);
  return [m[0][axis], m[1][axis], m[2][axis]];
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const combine = (basis: [Vec3, Vec3, Vec3], v: Vec3): Vec3 => [
  basis[0][0] * v[0] + basis[1][0] * v[1] + basis[2][0] * v[2],
  basis[0][1] * v[0] + basis[1][1] * v[1] + basis[2][1] * v[2],
  basis[0][2] * v[0] + basis[1][2] * v[1] + basis[2][2] * v[2],
];

/** The camera's right/up/backward axes, the frame a tap is authored in. */
function cameraAxes(forward: Vec3, up: Vec3): [Vec3, Vec3, Vec3] {
  const f = norm(forward);
  const right = norm(cross(f, norm(up)));
  const u = cross(right, f);
  return [right, u, [-f[0], -f[1], -f[2]]];
}

const asset = (id: string): StudioAsset =>
  ({ id, tap_to_place: true }) as unknown as StudioAsset;

function placedStore(
  id: string,
  tapPoint: Vec3,
  forward: Vec3,
  up: Vec3
): StudioPlacementStore {
  const store = new StudioPlacementStore();
  store.seed([asset(id)]);
  store.place(id, tapPoint, forward, up);
  return store;
}

const expectVecClose = (got: Vec3, want: Vec3, digits = 6) => {
  expect(got[0]).toBeCloseTo(want[0], digits);
  expect(got[1]).toBeCloseTo(want[1], digits);
  expect(got[2]).toBeCloseTo(want[2], digits);
};

describe("isTapToPlaceAsset", () => {
  test("a marker-triggered asset follows the marker instead", () => {
    expect(isTapToPlaceAsset(asset("a"))).toBe(true);
    expect(
      isTapToPlaceAsset({
        ...asset("a"),
        trigger_image_url: "https://example.test/m.png",
      })
    ).toBe(false);
    expect(isTapToPlaceAsset(null)).toBe(false);
  });
});

describe("resolvePlacedRotation", () => {
  // Looking along world -Z with world +Y up: the camera frame is the world one,
  // so the author rotation is already the answer.
  test("a level camera facing forward leaves the author rotation alone", () => {
    const store = placedStore("a", [0, 0, -2], [0, 0, -1], [0, 1, 0]);
    expectVecClose(
      store.resolvePlacedRotation("a", [20, 35, -15])!,
      [20, 35, -15]
    );
  });

  test("the placed asset's own axes land where the author put them relative to the camera", () => {
    // Turned most of the way round, pitched down and rolled: a pose where the
    // two euler orders disagree, and one an end user holding a phone reaches.
    const forward: Vec3 = [0.62, -0.35, 0.7];
    const up: Vec3 = [0.18, 0.93, 0.32];
    const author: Vec3 = [20, 35, -15];
    const store = placedStore("a", [1.1, -0.4, -2.3], forward, up);
    const resolved = store.resolvePlacedRotation("a", author)!;

    const axes = cameraAxes(forward, up);
    for (const axis of [0, 1, 2] as const) {
      expectVecClose(
        localAxisInWorld(resolved, axis),
        combine(axes, localAxisInWorld(author, axis))
      );
    }
  });

  test("a composed pose square to the camera still resolves to the same orientation", () => {
    // ry = ±90 in the composed rotation: X and Z turn about one axis there, so
    // the triple is not unique and only the orientation it names can be checked.
    const forward: Vec3 = [0, 0, -1];
    const up: Vec3 = [0, 1, 0];
    const author: Vec3 = [40, 90, -25];
    const store = placedStore("a", [0, 0, -2], forward, up);
    const resolved = store.resolvePlacedRotation("a", author)!;
    for (const axis of [0, 1, 2] as const) {
      expectVecClose(
        localAxisInWorld(resolved, axis),
        localAxisInWorld(author, axis)
      );
    }
  });

  test("undefined until placed, and the author rotation when no camera was reported", () => {
    const store = new StudioPlacementStore();
    store.seed([asset("a")]);
    expect(store.resolvePlacedRotation("a", [10, 20, 30])).toBeUndefined();
    store.place("a", [0, 0, -2]);
    expect(store.resolvePlacedRotation("a", [10, 20, 30])).toEqual([
      10, 20, 30,
    ]);
  });
});

describe("resolvePlacedPosition", () => {
  test("the author offset is read in the tap-time camera frame", () => {
    const forward: Vec3 = [0.62, -0.35, 0.7];
    const up: Vec3 = [0.18, 0.93, 0.32];
    const tap: Vec3 = [1.1, -0.4, -2.3];
    const offset: Vec3 = [0.5, 0.25, -1.2];
    const store = placedStore("a", tap, forward, up);
    const world = combine(cameraAxes(forward, up), offset);
    expectVecClose(store.resolvePlacedPosition("a", offset)!, [
      tap[0] + world[0],
      tap[1] + world[1],
      tap[2] + world[2],
    ]);
  });

  test("with no camera reported the offset is added on the world axes", () => {
    const store = new StudioPlacementStore();
    store.seed([asset("a")]);
    store.place("a", [1, 2, 3]);
    expect(store.resolvePlacedPosition("a", [0.5, 0, -1])).toEqual([1.5, 2, 2]);
  });
});
