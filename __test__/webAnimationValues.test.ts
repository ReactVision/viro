/**
 * What a declarative animation's property values mean on web: the same four
 * relative operators virocore parses, applied to where the node is; and how a
 * chain lays out one pass.
 */
import {
  isRelativeViroAnimation,
  planViroAnimation,
  registerViroAnimations,
  resolveViroAnimation,
  viroAnimationEnd,
  type ViroAnimationStep,
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

describe("animation chains", () => {
  beforeAll(() =>
    registerViroAnimations({
      up: { duration: 500, properties: { positionY: "+=1" } },
      fade: { duration: 200, delay: 100, properties: { opacity: 0 } },
      upThenSpin: [["up", "spin"]],
      upAndFade: ["up", "fade"],
      bob: [["up", { duration: 500, properties: { positionY: "-=1" } }]],
      alias: "upAndFade",
      loopy: [["loopy"]],
    }),
  );
  const pass = (name: string) => {
    const steps: ViroAnimationStep[] = [];
    const r = planViroAnimation(resolveViroAnimation(name)!, at(), steps);
    return { ...r, steps: steps.map((s) => ({ at: s.at, y: s.end.position[1], opacity: s.end.opacity })) };
  };

  test("an array inside the registered one runs its members one after another", () => {
    const r = pass("upThenSpin");
    expect(r.ms).toBe(3500);
    expect(r.steps.map((s) => s.at)).toEqual([0, 500]);
    expect(r.end.position).toEqual([0, 2, -2]);
    expect(r.end.rotation).toEqual([0, 360, 0]);
  });

  test("the registered array runs its members together, with their own delays", () => {
    const r = pass("upAndFade");
    expect(r.ms).toBe(500);
    expect(r.steps.map((s) => s.at)).toEqual([0, 0]);
    expect(r.end.position[1]).toBe(2);
    expect(r.end.opacity).toBe(0);
  });

  test("an inline animation in a chain, and a pass that comes back where it started", () => {
    expect(pass("bob").end.position).toEqual([0, 1, -2]);
  });

  test("a name for a chain runs it in sequence, as native does", () => {
    const r = pass("alias");
    expect(r.steps.map((s) => s.at)).toEqual([0, 500]);
    expect(r.ms).toBe(800);
  });

  test("members turning different axes together each head for both, since the renderer sets the whole rotation", () => {
    registerViroAnimations({
      turnX: { duration: 500, properties: { rotateX: 90 } },
      turnY: { duration: 500, properties: { rotateY: 45 } },
      turnBoth: ["turnX", "turnY"],
    });
    const steps: ViroAnimationStep[] = [];
    const r = planViroAnimation(resolveViroAnimation("turnBoth")!, at(), steps);
    expect(r.end.rotation).toEqual([90, 45, 0]);
    expect(steps.map((s) => s.end.rotation)).toEqual([[90, 45, 0], [90, 45, 0]]);
    expect(steps.map((s) => s.from.rotation)).toEqual([[0, 0, 0], [0, 0, 0]]);
  });

  test("a chain that names itself is not an animation", () => {
    expect(resolveViroAnimation("loopy")).toBeNull();
  });
});
