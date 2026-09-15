import {
  DragConfiguration,
  dragSurfaceFromAnchor,
  isSameDragSurface,
  type DragSurface,
} from "../components/Studio/domain/dragConfiguration";

/**
 * The anchor poses below are the euler triples (degrees) the AR session reports
 * for a plane whose surface normal is the stated direction. They come from
 * running an anchor transform through virocore's own
 * `extractRotation(...).toEuler()`, which is what fills the event.
 */
const ANCHORS = {
  /** Wall whose normal is world -Z. */
  wallFacingMinusZ: [-90, 0, 0] as [number, number, number],
  /** Wall whose normal is world -X: the case a world +Z drag plane cannot serve. */
  wallFacingMinusX: [0, 90, 90] as [number, number, number],
  /** Wall turned 33 degrees off both axes. */
  wallSkewed: [-90, 33, 0] as [number, number, number],
  floorYawed: [0, 40, 0] as [number, number, number],
  ceiling: [0, -25, 180] as [number, number, number],
};

const dot = (
  a: [number, number, number],
  b: [number, number, number]
): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** How far off its own drag plane an asset authored at `local` ends up. */
const offPlane = (
  surface: DragSurface,
  anchorPosition: [number, number, number],
  anchorRotation: [number, number, number],
  local: [number, number, number]
): number => {
  const plane = DragConfiguration.getDragPlane("Vertical", local, surface);
  // The asset's world position: the anchor transform applied to its authored
  // position. Only the standoff along the normal can take it off the plane, so
  // the in-surface axes are free and the check is the plane equation itself.
  const world = dot(surface.normal, anchorPosition) + local[1];
  return Math.abs(world - dot(plane.planeNormal, plane.planePoint));
};

describe("dragSurfaceFromAnchor", () => {
  test("normal is the anchor's own Y axis, not an axis guessed from alignment", () => {
    const cases: Array<[[number, number, number], [number, number, number]]> = [
      [ANCHORS.wallFacingMinusZ, [0, 0, -1]],
      [ANCHORS.wallFacingMinusX, [-1, 0, 0]],
      [ANCHORS.wallSkewed, [-0.5446, 0, -0.8387]],
      [ANCHORS.floorYawed, [0, 1, 0]],
      [ANCHORS.ceiling, [0, -1, 0]],
    ];
    for (const [rotation, expected] of cases) {
      const { normal } = dragSurfaceFromAnchor([0, 0, 0], rotation);
      expect(normal[0]).toBeCloseTo(expected[0], 3);
      expect(normal[1]).toBeCloseTo(expected[1], 3);
      expect(normal[2]).toBeCloseTo(expected[2], 3);
    }
  });

  test("distance puts the anchor origin on the surface", () => {
    const position: [number, number, number] = [0.7, 0.05, -3.1];
    const surface = dragSurfaceFromAnchor(position, ANCHORS.wallSkewed);
    expect(dot(surface.normal, position) - surface.distance).toBeCloseTo(0, 6);
  });
});

describe("isSameDragSurface", () => {
  const wall = dragSurfaceFromAnchor([0.7, 0.05, -3.1], ANCHORS.wallSkewed);

  test("an anchor sliding inside its own surface leaves the plane alone", () => {
    // 1.6 m along the wall, which is a different pose reporting the same plane.
    // That is the common case: the session keeps re-centring an anchor as it
    // grows the surface it sits on.
    const along: [number, number, number] = [
      -wall.normal[2],
      0,
      wall.normal[0],
    ];
    const slid = dragSurfaceFromAnchor(
      [0.7 + along[0] * 1.6, 0.05, -3.1 + along[2] * 1.6],
      ANCHORS.wallSkewed
    );
    expect(slid.distance - wall.distance).toBeCloseTo(0, 6);
    expect(isSameDragSurface(wall, slid)).toBe(true);
  });

  test("a surface re-fitted outward or turned is a new plane", () => {
    expect(
      isSameDragSurface(wall, { ...wall, distance: wall.distance + 0.05 })
    ).toBe(false);
    expect(
      isSameDragSurface(
        wall,
        dragSurfaceFromAnchor([0.7, 0.05, -3.1], [-90, 34, 0])
      )
    ).toBe(false);
  });
});

describe("DragConfiguration.getDragPlane", () => {
  const LOCALS: Array<[number, number, number]> = [
    [0, 0, 0],
    [-1.8, 0, -2],
    [0.5, 0.25, 1.2],
    [-0.3, -0.15, 0.4],
  ];

  test("an anchored asset starts on its own drag plane, whatever way the wall faces", () => {
    const position: [number, number, number] = [0.7, 0.05, -3.1];
    for (const rotation of Object.values(ANCHORS)) {
      const surface = dragSurfaceFromAnchor(position, rotation);
      for (const local of LOCALS) {
        expect(offPlane(surface, position, rotation, local)).toBeCloseTo(0, 6);
      }
    }
  });

  test("the plane is parallel to the surface and keeps the authored standoff", () => {
    const surface = dragSurfaceFromAnchor(
      [0.7, 0.05, -3.1],
      ANCHORS.wallSkewed
    );
    const plane = DragConfiguration.getDragPlane(
      "Vertical",
      [0.5, 0.25, 1.2],
      surface
    );
    expect(plane.planeNormal).toEqual(surface.normal);
    expect(
      dot(plane.planeNormal, plane.planePoint) - surface.distance
    ).toBeCloseTo(0.25, 6);
  });

  test("the cap clears the distance anyone stands from a wall", () => {
    // virocore's fallback for a hit beyond this distance is
    // sqrtf(maxDistance^2 - cameraToPlane^2), unguarded, so a cap shorter than
    // the camera-to-surface distance hands the node a NaN transform.
    const surface = dragSurfaceFromAnchor(
      [0.7, 0.05, -3.1],
      ANCHORS.wallSkewed
    );
    expect(
      DragConfiguration.getDragPlane("Vertical", [0, 0, 0], surface).maxDistance
    ).toBeGreaterThan(5);
  });

  test("with no surface found it falls back to an axis from the scene's alignment", () => {
    const local: [number, number, number] = [0.5, 0.25, 1.2];
    for (const surface of [undefined, null]) {
      expect(
        DragConfiguration.getDragPlane("Horizontal", local, surface)
      ).toEqual({
        planePoint: local,
        planeNormal: [0, 1, 0],
        maxDistance: 12,
      });
      expect(
        DragConfiguration.getDragPlane("HorizontalDownward", local, surface)
          .planeNormal
      ).toEqual([0, -1, 0]);
      expect(
        DragConfiguration.getDragPlane("Vertical", local, surface).planeNormal
      ).toEqual([0, 0, 1]);
      expect(
        DragConfiguration.getDragPlane("", local, surface).planeNormal
      ).toEqual([0, 1, 0]);
    }
  });
});
