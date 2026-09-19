/**
 * Turning a Studio collider into what the C API takes.
 *
 * Every case here is one the native side already got wrong once and fixed, so
 * the point is not that the mapping is plausible but that it matches: an
 * inferred shape must stay absent rather than become a unit box, and a compound
 * must arrive flattened at the stride virocore reads.
 */
import {
  resolveShape,
  type ViroPhysicsShapeProp,
} from "../components/Web/viroPhysicsBody";
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

  test("a compound with no parts falls back to inferring one", () => {
    // Which is what the tag has always meant with empty params, so sending an
    // empty explicit compound instead would be a collider of nothing.
    const s = resolveShape({ type: "Compound", children: [] });
    expect(s.type).toBe(ViroPhysicsShapeType.Infer);
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
