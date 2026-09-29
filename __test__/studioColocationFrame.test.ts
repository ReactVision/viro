import {
  dragSurfaceFromSceneToWorld,
  fromPositionEuler,
  fromPositionQuat,
  IDENTITY,
  invert,
  type Mat4,
  multiply,
  parseOriginFields,
  toNodeTransform,
  toPositionQuat,
  transformPoint,
  type Vec3,
} from "../components/Studio/colocation/frameMath";

function expectClose(actual: number[], expected: number[], digits = 5) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], digits));
}

// Two AR sessions that started tracking in different places: the same room,
// with each session's world origin and heading wherever it happened to be.
const HOST_LOCATION = fromPositionEuler([1.2, -0.4, -2.5], [0, 35, 0]);
const JOINER_LOCATION = fromPositionEuler([-3, 0.1, 0.7], [0, -110, 0]);

describe("frameMath", () => {
  it("round-trips a node pose through a matrix", () => {
    const m = fromPositionEuler([1, 2, 3], [10, 20, 30], [2, 2, 2]);
    const node = toNodeTransform(m);
    expectClose(node.position, [1, 2, 3]);
    expectClose(node.rotation, [10, 20, 30]);
    expectClose(node.scale, [2, 2, 2]);
    expectClose(fromPositionEuler(node.position, node.rotation, node.scale), m);
  });

  it("round-trips a rotation through a quaternion", () => {
    const m = fromPositionEuler([0.5, 0, -1], [-40, 75, 12]);
    const { p, q } = toPositionQuat(m);
    expect(Math.hypot(...q)).toBeCloseTo(1, 6);
    expectClose(fromPositionQuat(p, q), m);
  });

  it("drops a location transform's scale from the quaternion, not the position", () => {
    const scaled = fromPositionEuler([4, 5, 6], [0, 90, 0], [1.5, 1.5, 1.5]);
    const { p, q } = toPositionQuat(scaled);
    expectClose(p, [4, 5, 6]);
    expectClose(
      fromPositionQuat(p, q),
      fromPositionEuler([4, 5, 6], [0, 90, 0])
    );
  });

  it("puts the host's origin in the same physical place for a joiner", () => {
    // Host: the scene's origin is a plane it picked, in its own world space.
    const hostWorldOrigin = fromPositionEuler([0.3, -1.1, -1.8], [0, 20, 0]);
    const originInLocation = multiply(invert(HOST_LOCATION)!, hostWorldOrigin);
    const { p, q } = toPositionQuat(originInLocation);

    // Joiner: only the replicated fields cross the wire.
    const origin = parseOriginFields({ p, q, sceneId: "scene-1" })!;
    const joinerSceneToWorld = multiply(JOINER_LOCATION, origin);

    // A point authored in the scene lands at one location-frame point on both.
    const authored: Vec3 = [0.25, 0.5, -0.75];
    const onHost = transformPoint(hostWorldOrigin, authored);
    const onJoiner = transformPoint(joinerSceneToWorld, authored);
    expectClose(
      transformPoint(invert(HOST_LOCATION)!, onHost),
      transformPoint(invert(JOINER_LOCATION)!, onJoiner)
    );
  });

  it("gives a NONE-mode host its own world origin back", () => {
    const originInLocation = multiply(invert(HOST_LOCATION)!, IDENTITY);
    const { p, q } = toPositionQuat(originInLocation);
    const sceneToWorld = multiply(HOST_LOCATION, fromPositionQuat(p, q));
    expectClose(sceneToWorld, IDENTITY);
  });

  it("refuses malformed origin fields", () => {
    expect(parseOriginFields({ p: [0, 0], q: [0, 0, 0, 1] })).toBeNull();
    expect(parseOriginFields({ p: [0, 0, 0], q: [0, 0, 0, 0] })).toBeNull();
    expect(parseOriginFields({ p: [0, NaN, 0], q: [0, 0, 0, 1] })).toBeNull();
    expect(parseOriginFields({ p: "0,0,0", q: [0, 0, 0, 1] })).toBeNull();
    expectClose(
      parseOriginFields({ p: [1, 2, 3], q: [0, 0, 0, 2] }) as Mat4,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]
    );
  });

  it("drags on the plane the origin was picked on", () => {
    // A wall facing +X, 2 m out: its local +Y (the normal) points along +X.
    const wall = fromPositionEuler([2, 1, 0], [0, 0, -90]);
    const surface = dragSurfaceFromSceneToWorld(wall);
    expectClose(surface.normal, [1, 0, 0]);
    expect(surface.distance).toBeCloseTo(2, 5);
  });
});
