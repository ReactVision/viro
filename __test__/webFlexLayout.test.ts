/**
 * The two pure halves of ViroFlexView's layout: what a style becomes in CSS, and
 * what a measured frame becomes in 3D.
 *
 * The measuring itself belongs to the browser and is checked in the harness. The
 * parts here are the ones that have a right answer independent of any engine,
 * and both of them are places where a plausible-looking mistake produces a scene
 * that is merely wrong rather than broken: a row where a column belongs, or
 * every child half its own size off.
 */
import {
  rectToSlot,
  styleToCss,
  FLEX_POINTS_PER_METER,
  FLEX_CHILD_Z,
} from "../components/Web/viroFlexLayout";

describe("rectToSlot", () => {
  const W = 2 * FLEX_POINTS_PER_METER; // a 2m x 1m container
  const H = 1 * FLEX_POINTS_PER_METER;

  test("a frame filling the container sits at its centre", () => {
    const slot = rectToSlot({ x: 0, y: 0, width: W, height: H }, W, H);
    expect(slot.position[0]).toBeCloseTo(0, 6);
    expect(slot.position[1]).toBeCloseTo(0, 6);
    expect(slot.width).toBeCloseTo(2, 6);
    expect(slot.height).toBeCloseTo(1, 6);
  });

  test("a top-left frame lands up and to the left, not at the corner", () => {
    // The frame is a top-left box and a Viro node is centred on its geometry, so
    // what crosses over is the frame's centre. Passing the corner through would
    // put every child half its own size out.
    const slot = rectToSlot(
      { x: 0, y: 0, width: W / 2, height: H / 2 },
      W,
      H,
    );
    expect(slot.position[0]).toBeCloseTo(-0.5, 6);
    expect(slot.position[1]).toBeCloseTo(0.25, 6);
  });

  test("y is flipped: layout counts down, the scene counts up", () => {
    const top = rectToSlot({ x: 0, y: 0, width: W, height: H / 4 }, W, H);
    const bottom = rectToSlot(
      { x: 0, y: (H * 3) / 4, width: W, height: H / 4 },
      W,
      H,
    );
    expect(top.position[1]).toBeGreaterThan(0);
    expect(bottom.position[1]).toBeLessThan(0);
    expect(top.position[1]).toBeCloseTo(-bottom.position[1], 6);
  });

  test("every child is nudged in front of its container", () => {
    // Coplanar quads z-fight, and the child has to win the hit test against the
    // background it sits on. Native applies the same 1cm.
    const slot = rectToSlot({ x: 0, y: 0, width: W, height: H }, W, H);
    expect(slot.position[2]).toBe(FLEX_CHILD_Z);
  });
});

describe("styleToCss", () => {
  test("React Native's defaults, not the browser's", () => {
    // CSS lays out in a row and shrinks items to fit; RN stacks a column and
    // never shrinks. Leaving it to the browser turns a column of fixed-height
    // children into a squashed row.
    const css = styleToCss(undefined, true);
    expect(css.flexDirection).toBe("column");
    expect(css.alignItems).toBe("stretch");
    expect(css.flexShrink).toBe("0");
  });

  test("an authored value wins over the default", () => {
    const css = styleToCss({ flexDirection: "row", alignItems: "center" }, true);
    expect(css.flexDirection).toBe("row");
    expect(css.alignItems).toBe("center");
  });

  test("lengths are points and other numbers are not", () => {
    const css = styleToCss({ width: 500, padding: 20, flexGrow: 2 }, true);
    expect(css.width).toBe("500px");
    expect(css.padding).toBe("20px");
    expect(css.flexGrow).toBe("2");
  });

  test("the axis shorthands become both sides", () => {
    const css = styleToCss({ paddingHorizontal: 10, marginVertical: 4 }, true);
    expect(css.paddingLeft).toBe("10px");
    expect(css.paddingRight).toBe("10px");
    expect(css.marginTop).toBe("4px");
    expect(css.marginBottom).toBe("4px");
  });

  test("`flex: n` keeps React Native's meaning", () => {
    // CSS's own `flex: 1` is `1 1 auto`, which sizes from the content; RN's is
    // `1 1 0%`, which splits the container evenly however big the content is.
    expect(styleToCss({ flex: 1 }, true).flex).toBe("1 1 0%");
  });

  test("appearance is left alone", () => {
    const css = styleToCss({ backgroundColor: "#f00", fontSize: 18, width: 10 }, true);
    expect(css.backgroundColor).toBeUndefined();
    expect(css.fontSize).toBeUndefined();
    expect(css.width).toBe("10px");
  });
});
