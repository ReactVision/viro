/**
 * How big the quad is for a picture on web, against VRTImage's rules.
 *
 * The case that matters most is the first one: the Studio node factory sends a
 * source and `resizeMode` but never a size, and before this existed web built a
 * 1x1 quad and squashed every picture that was not square.
 *
 * A 2:1 picture throughout, so a wrong axis is obvious rather than a rounding
 * difference.
 */
import { resolveSurface } from "../components/ViroImage.web";

const WIDE = 2; // 2:1, landscape
const TALL = 0.5; // 1:2, portrait

describe("resolveSurface", () => {
  test("derives the height from the picture when no size is authored", () => {
    // The Studio case. Width stays at the 1 default, height comes from the shape.
    expect(resolveSurface(1, 1, false, "ScaleToFill", true, WIDE)).toEqual([1, 0.5]);
    expect(resolveSurface(1, 1, false, "ScaleToFill", true, TALL)).toEqual([1, 2]);
  });

  test("keeps the authored box before the picture has loaded", () => {
    // Nothing to measure against yet, so the quad is what the author asked for.
    expect(resolveSurface(1, 1, false, "ScaleToFill", true, null)).toEqual([1, 1]);
    expect(resolveSurface(3, 2, true, "ScaleToFit", true, null)).toEqual([3, 2]);
  });

  test("ScaleToFit fits the picture inside the box", () => {
    // Box squarer than the picture: width is the limit, height shrinks.
    expect(resolveSurface(2, 2, true, "ScaleToFit", true, WIDE)).toEqual([2, 1]);
    // Box wider than the picture: height is the limit, width shrinks.
    expect(resolveSurface(4, 1, true, "ScaleToFit", true, WIDE)).toEqual([2, 1]);
  });

  test("ScaleToFill covers the box", () => {
    // The mirror of the two above: the axis with room to spare is the one that grows.
    expect(resolveSurface(2, 2, true, "ScaleToFill", true, WIDE)).toEqual([4, 2]);
    expect(resolveSurface(4, 1, true, "ScaleToFill", true, WIDE)).toEqual([4, 2]);
  });

  test("StretchToFill takes the box as given", () => {
    expect(resolveSurface(3, 1, true, "StretchToFill", true, WIDE)).toEqual([3, 1]);
  });

  test("honours an authored size that carries no resize mode", () => {
    // Native draws a 1x1 quad here, from a _scaledWidth it never initialised.
    // Web honours the box, which is what its own default mode should do.
    expect(resolveSurface(3, 1, true, "StretchToFill", false, WIDE)).toEqual([3, 1]);
  });

  test("never distorts a picture whose shape it knows", () => {
    // The regression this file exists for: on every mode that is not an explicit
    // stretch, the quad's aspect either matches the picture or matches the box
    // the author asked for — it is never some third shape.
    for (const mode of ["ScaleToFit", "ScaleToFill"] as const) {
      for (const aspect of [WIDE, TALL, 1]) {
        const [w, h] = resolveSurface(2, 2, true, mode, true, aspect);
        expect(w / h).toBeCloseTo(aspect, 6);
      }
    }
  });
});
