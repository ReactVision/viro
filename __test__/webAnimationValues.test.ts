/**
 * What a declarative animation's property values mean on web: the same four
 * relative operators virocore parses, applied to where the node is.
 */
import {
  isRelativeViroAnimation,
  registerViroAnimations,
  viroAnimationEnd,
  type ViroBaseTransform,
} from "../components/Web/viroAnimationRegistry";

const at = (over: Partial<ViroBaseTransform> = {}): ViroBaseTransform => ({
  position: [0, 1, -2],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  opacity: 1,
  ...over,
});

beforeAll(() =>
  registerViroAnimations({
    spin: { duration: 3000, properties: { rotateY: "+=360" } },
    drop: { duration: 500, properties: { positionY: "-=0.5", scaleX: "*=2", scaleZ: "/=4" } },
    moveTo: { duration: 500, properties: { positionX: 3, opacity: "0.5" } },
  }),
);

describe("viroAnimationEnd", () => {
  // The regression: "+=360" parsed as NaN and the node never moved.
  test("adds to the current rotation", () => {
    expect(viroAnimationEnd("spin", at())?.rotation).toEqual([0, 360, 0]);
  });

  test("subtracts, multiplies and divides", () => {
    const end = viroAnimationEnd("drop", at({ scale: [1, 1, 2] }));
    expect(end?.position).toEqual([0, 0.5, -2]);
    expect(end?.scale).toEqual([2, 1, 0.5]);
  });

  test("a plain number or numeric string is the value itself", () => {
    const end = viroAnimationEnd("moveTo", at());
    expect(end?.position).toEqual([3, 1, -2]);
    expect(end?.opacity).toBe(0.5);
  });

  // The renderer holds the angle within one turn and animates from there.
  test("starts from the angle within one turn", () => {
    expect(viroAnimationEnd("spin", at({ rotation: [0, 450, 0] }))?.rotation).toEqual([0, 450, 0]);
  });

  test("an unregistered name is not an animation", () => {
    expect(viroAnimationEnd("missing", at())).toBeNull();
  });
});

describe("isRelativeViroAnimation", () => {
  test("is true only when a value is relative", () => {
    expect(isRelativeViroAnimation("spin")).toBe(true);
    expect(isRelativeViroAnimation("moveTo")).toBe(false);
  });
});
