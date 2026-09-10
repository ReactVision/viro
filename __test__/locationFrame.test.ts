import {
  invertTransform,
  locationToWorld,
  parseLocationTransform,
  worldToLocation,
  type ViroLocationTransform,
} from "../components/AR/ViroLocationFrame";

/** Column-major, matching VROMatrix4f::getArray(). */
const IDENTITY: ViroLocationTransform = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

/** Translation only: frame origin sits at (10, 1, -4) in world space. */
const TRANSLATED: ViroLocationTransform = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  10, 1, -4, 1,
];

/** 90° yaw about +Y, then translated — the shape a real scan produces. */
const YAW90_TRANSLATED: ViroLocationTransform = [
  0, 0, -1, 0,
  0, 1, 0, 0,
  1, 0, 0, 0,
  2, 0, 3, 1,
];

const closeTo = (actual: number[], expected: number[], digits = 5) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], digits));
};

describe("parseLocationTransform", () => {
  it("parses the 16-float CSV both platforms emit", () => {
    expect(parseLocationTransform(TRANSLATED.join(","))).toEqual(TRANSLATED);
  });

  it("accepts the %g exponent form snprintf can produce", () => {
    const parsed = parseLocationTransform(
      "1,0,0,0,0,1,0,0,0,0,1,0,1.5e-07,1,-4,1"
    );
    expect(parsed).not.toBeNull();
    expect(parsed![12]).toBeCloseTo(1.5e-7, 12);
  });

  it("rejects a malformed token rather than half-parsing it", () => {
    expect(parseLocationTransform("")).toBeNull();
    expect(parseLocationTransform(undefined)).toBeNull();
    expect(parseLocationTransform("1,2,3")).toBeNull();
    expect(parseLocationTransform(new Array(16).fill("x").join(","))).toBeNull();
  });
});

describe("locationToWorld / worldToLocation", () => {
  it("is a no-op through identity", () => {
    closeTo(locationToWorld(IDENTITY, [1, 2, 3]), [1, 2, 3]);
  });

  it("offsets by the frame origin", () => {
    closeTo(locationToWorld(TRANSLATED, [0, 0, 0]), [10, 1, -4]);
    closeTo(locationToWorld(TRANSLATED, [1, 1, 1]), [11, 2, -3]);
  });

  it("applies rotation, not just translation", () => {
    // +X in the frame maps to -Z in the world under a 90° yaw.
    closeTo(locationToWorld(YAW90_TRANSLATED, [1, 0, 0]), [2, 0, 2]);
  });

  it("round-trips a point through both directions", () => {
    // The property co-location depends on: device A sends frame coordinates,
    // device B converts to its own world and back, and lands where it started.
    const point: [number, number, number] = [0.4, -1.25, 2.75];
    const world = locationToWorld(YAW90_TRANSLATED, point);
    closeTo(worldToLocation(YAW90_TRANSLATED, world)!, point);
  });

  it("returns null instead of NaNs for a singular transform", () => {
    const collapsed: ViroLocationTransform = new Array(16).fill(0);
    expect(invertTransform(collapsed)).toBeNull();
    expect(worldToLocation(collapsed, [1, 2, 3])).toBeNull();
  });

  it("inverts a scaled frame correctly", () => {
    // Not a rigid transform: a transpose-based shortcut would be wrong here,
    // which is why the general inverse is used.
    const scaled: ViroLocationTransform = [
      2, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 2, 0,
      1, 2, 3, 1,
    ];
    closeTo(locationToWorld(scaled, [1, 1, 1]), [3, 4, 5]);
    closeTo(worldToLocation(scaled, [3, 4, 5])!, [1, 1, 1]);
  });
});
