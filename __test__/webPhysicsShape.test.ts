/**
 * Turning a Studio collider into what the C API takes.
 *
 * Every case here is one the native side already got wrong once and fixed, so
 * the point is not that the mapping is plausible but that it matches: an
 * inferred shape must stay absent rather than become a unit box, and a compound
 * must arrive flattened at the stride virocore reads.
 */
import {
  offsetImpulse,
  physicsForces,
  resolveShape,
  type ViroPhysicsShapeProp,
} from "../components/Web/viroPhysicsBody";
import { collisionQueries } from "../components/Web/useViroPhysicsWorld";
import {
  ViroPhysicsShapeType,
  VIRO_COMPOUND_CHILD_STRIDE,
} from "@reactvision/viro-web-renderer";

describe("resolveShape", () => {
  test("no shape means infer, not a unit box", () => {
    // The distinction that mattered: virocore fits a shape to the node's own
    // bounds and applies its scale. Substituting a 1x1x1 box gave a 0.4 m model
    // a 1 m collider and stood it off the ground.
    for (const input of [undefined, {}, { type: "Whatever" }]) {
      const s = resolveShape(input as ViroPhysicsShapeProp);
      expect(s.type).toBe(ViroPhysicsShapeType.Infer);
      expect(s.params).toEqual([]);
    }
  });

  test("a box passes its half spans through untouched", () => {
    // Already scaled by physicsConfig; nothing here may scale them again.
    expect(resolveShape({ type: "Box", params: [1, 0.3, 2] })).toEqual({
      type: ViroPhysicsShapeType.Box,
      params: [1, 0.3, 2],
    });
  });

  test("a sphere carries only its radius", () => {
    expect(resolveShape({ type: "Sphere", params: [0.35, 9, 9] })).toEqual({
      type: ViroPhysicsShapeType.Sphere,
      params: [0.35],
    });
  });

  test("a compound flattens to the stride virocore reads", () => {
    // Parity B's collider: a flat box with a sphere riding on top.
    const s = resolveShape({
      type: "Compound",
      children: [
        { type: "Box", params: [1, 0.3, 1], position: [0, -0.35, 0] },
        { type: "Sphere", params: [0.35], position: [0, 0.3, 0] },
      ],
    });

    expect(s.type).toBe(ViroPhysicsShapeType.Compound);
    expect(s.params).toHaveLength(2 * VIRO_COMPOUND_CHILD_STRIDE);
    // [type, then three span slots, then position]
    expect(s.params.slice(0, 7)).toEqual([0, 1, 0.3, 1, 0, -0.35, 0]);
    // A sphere's radius takes the first span slot and leaves the other two at 0.
    expect(s.params.slice(7)).toEqual([1, 0.35, 0, 0, 0, 0.3, 0]);
  });

  test("a compound with no parts is virocore's AutoCompound, built from the children", () => {
    // Infer would be one box around the node's own geometry: a 1 m box on a
    // node that draws nothing itself.
    for (const shape of [{ type: "Compound", children: [] }, { type: "Compound" }]) {
      const s = resolveShape(shape);
      expect(s.type).toBe(1);
      expect(s.params).toEqual([]);
    }
  });

  test("a part missing its numbers still occupies its slots", () => {
    // A short part would shift every later part by the difference and silently
    // rearrange the whole collider, so the gaps are filled rather than skipped.
    const s = resolveShape({
      type: "Compound",
      children: [{ type: "Box" }, { type: "Sphere", params: [1], position: [2, 0, 0] }],
    });
    expect(s.params).toHaveLength(2 * VIRO_COMPOUND_CHILD_STRIDE);
    expect(s.params.slice(0, 7)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(s.params.slice(7)).toEqual([1, 1, 0, 0, 2, 0, 0]);
  });
});

describe("offsetImpulse", () => {
  test("is Bullet's split: the impulse through the centre, offset x impulse as torque", () => {
    // A push along -Z at +X spins the body about +Y (counter-clockwise from above).
    const torque = (i: [number, number, number], o: [number, number, number]) => offsetImpulse(i, o).torque.map((v) => v + 0);
    expect(torque([0, 0, -1], [0.5, 0, 0])).toEqual([0, 0.5, 0]);
    expect(torque([2, 0, 0], [0, 1, 0])).toEqual([0, 0, -2]);
    expect(offsetImpulse([2, 0, 0], [0, 1, 0]).central).toEqual([2, 0, 0]);
  });

  test("an impulse at the centre has no torque", () => {
    expect(offsetImpulse([1, 2, 3], [0, 0, 0]).torque.map(Math.abs)).toEqual([0, 0, 0]);
  });
});

describe("physicsForces", () => {
  test("one force object or a list, the position defaulting to the centre", () => {
    expect(physicsForces({ force: { value: [1, 0, 0] } })).toEqual({
      forces: [{ value: [1, 0, 0], position: undefined }],
      torque: [0, 0, 0],
    });
    expect(
      physicsForces({ force: [{ value: [0, 2, 0], position: [0.5, 0, 0] }, { value: [0, 0, 3] }], torque: [0, 1, 0] }),
    ).toEqual({
      forces: [
        { value: [0, 2, 0], position: [0.5, 0, 0] },
        { value: [0, 0, 3], position: undefined },
      ],
      torque: [0, 1, 0],
    });
  });

  test("leaves out a force without a 3-value `value`, as native refuses it", () => {
    expect(physicsForces({ force: [{ value: [1, 0] }, { position: [0, 0, 0] }] }).forces).toEqual([]);
  });
});

describe("collisionQueries", () => {
  const scene = (hit: boolean | null) =>
    ({
      findCollisionsWithRay: jest.fn(() => hit),
      findCollisionsWithShape: jest.fn(() => hit),
    }) as any;

  test("a ray passes its ends, closest flag and tag through", async () => {
    const s = scene(true);
    await expect(collisionQueries(s).findCollisionsWithRayAsync([0, 0, 0], [0, 0, -5], true, "ray")).resolves.toBe(true);
    expect(s.findCollisionsWithRay).toHaveBeenCalledWith([0, 0, 0], [0, 0, -5], true, "ray");
  });

  test("a shape takes the physicsBody shape's types and params", async () => {
    const s = scene(false);
    const q = collisionQueries(s);
    await expect(q.findCollisionsWithShapeAsync([0, 0, 0], [0, 0, -5], "Sphere", [0.4], "s")).resolves.toBe(false);
    expect(s.findCollisionsWithShape).toHaveBeenCalledWith([0, 0, 0], [0, 0, -5], ViroPhysicsShapeType.Sphere, [0.4], "s");
    await expect(q.findCollisionsWithShapeAsync([0, 0, 0], [0, 0, -5], "Compound", [], "s")).rejects.toThrow("Box [x, y, z]");
    // A short box would have the wasm read past its params.
    await expect(q.findCollisionsWithShapeAsync([0, 0, 0], [0, 0, -5], "Box", [1], "s")).rejects.toThrow("Box [x, y, z]");
  });

  test("a renderer without the queries resolves false rather than throwing", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(collisionQueries({} as any).findCollisionsWithRayAsync([0, 0, 0], [0, 0, 1], true, "r")).resolves.toBe(false);
    await expect(collisionQueries(scene(null)).findCollisionsWithRayAsync([0, 0, 0], [0, 0, 1], true, "r")).resolves.toBe(false);
    jest.restoreAllMocks();
  });
});
