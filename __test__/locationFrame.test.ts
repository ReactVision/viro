import {
  invertTransform,
  locationToWorld,
  parseLocationTransform,
  poseCsv,
  transformDirection,
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

describe("transformDirection", () => {
  it("rotates without picking up the frame's origin", () => {
    // locationToWorld would add the [2, 0, 3] translation, which is right for a
    // position and turns a unit forward vector into something 3.6 m long.
    closeTo(transformDirection(YAW90_TRANSLATED, [0, 0, 1]), [1, 0, 0]);
    closeTo(locationToWorld(YAW90_TRANSLATED, [0, 0, 1]), [3, 0, 3]);
  });

  it("leaves a direction unit length through a rigid frame", () => {
    const out = transformDirection(YAW90_TRANSLATED, [0.6, 0, 0.8]);
    expect(Math.hypot(...out)).toBeCloseTo(1, 5);
  });
});

describe("poseCsv", () => {
  const parse = (csv: string) => csv.split(",").map(Number);

  it("puts the position in the translation elements", () => {
    const m = parse(poseCsv([1.5, -2, 3], [0, 0, -1], [0, 1, 0]));
    expect(m).toHaveLength(16);
    closeTo(m.slice(12), [1.5, -2, 3, 1]);
  });

  it("points +Z against the look direction, not along it", () => {
    // The camera looks down its own -Z. Reversing this faces every avatar away
    // from where its device is pointing, which reads as a plausible scene.
    const m = parse(poseCsv([0, 0, 0], [0, 0, -1], [0, 1, 0]));
    closeTo(m.slice(8, 11), [0, 0, 1]);
  });

  it("produces an orthonormal basis", () => {
    const m = parse(poseCsv([0, 0, 0], [0.3, -0.5, -0.81], [0.1, 0.99, 0]));
    const [x, y, z] = [m.slice(0, 3), m.slice(4, 7), m.slice(8, 11)];
    for (const axis of [x, y, z]) expect(Math.hypot(...axis)).toBeCloseTo(1, 5);
    const dot = (a: number[], b: number[]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(x, y)).toBeCloseTo(0, 5);
    expect(dot(y, z)).toBeCloseTo(0, 5);
    expect(dot(x, z)).toBeCloseTo(0, 5);
  });

  it("survives looking straight up, where up and forward are parallel", () => {
    // The cross product collapses here. Roll is unobservable looking straight
    // up, so any perpendicular axis is correct, but NaNs are not.
    const m = parse(poseCsv([0, 0, 0], [0, 1, 0], [0, 1, 0]));
    expect(m.every((n) => Number.isFinite(n))).toBe(true);
    closeTo(m.slice(8, 11), [0, -1, 0]);
  });

  it("writes zeroes rather than NaN when handed a degenerate vector", () => {
    const m = parse(poseCsv([0, 0, 0], [0, 0, 0], [0, 0, 0]));
    expect(m.every((n) => Number.isFinite(n))).toBe(true);
  });
});
