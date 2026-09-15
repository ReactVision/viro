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

/** The quad alone, for the cases that are about size rather than cropping. */
const size = (...args: Parameters<typeof resolveSurface>): [number, number] => {
  const s = resolveSurface(...args);
  return [s.width, s.height];
};

const WIDE = 2; // 2:1, landscape
const TALL = 0.5; // 1:2, portrait

describe("resolveSurface", () => {
  test("derives the height from the picture when no size is authored", () => {
    // The Studio case. Width stays at the 1 default, height comes from the shape.
    expect(size(1, 1, false, "ScaleToFill", true, WIDE)).toEqual([1, 0.5]);
    expect(size(1, 1, false, "ScaleToFill", true, TALL)).toEqual([1, 2]);
  });

  test("keeps the authored box before the picture has loaded", () => {
    // Nothing to measure against yet, so the quad is what the author asked for.
    expect(size(1, 1, false, "ScaleToFill", true, null)).toEqual([1, 1]);
    expect(size(3, 2, true, "ScaleToFit", true, null)).toEqual([3, 2]);
  });

  test("ScaleToFit fits the picture inside the box", () => {
    // Box squarer than the picture: width is the limit, height shrinks.
    expect(size(2, 2, true, "ScaleToFit", true, WIDE)).toEqual([2, 1]);
    // Box wider than the picture: height is the limit, width shrinks.
    expect(size(4, 1, true, "ScaleToFit", true, WIDE)).toEqual([2, 1]);
  });

  test("ScaleToFill covers the box", () => {
    // The mirror of the two above: the axis with room to spare is the one that
    // grows. Clipping off, since native's default is to crop the overflow back
    // to the box — that pairing has its own test below.
    expect(size(2, 2, true, "ScaleToFill", true, WIDE, "None")).toEqual([4, 2]);
    expect(size(4, 1, true, "ScaleToFill", true, WIDE, "None")).toEqual([4, 2]);
  });

  test("StretchToFill takes the box as given", () => {
    expect(size(3, 1, true, "StretchToFill", true, WIDE)).toEqual([3, 1]);
  });

  test("honours an authored size that carries no resize mode", () => {
    // Native draws a 1x1 quad here, from a _scaledWidth it never initialised.
    // Web honours the box, which is what its own default mode should do.
    expect(size(3, 1, true, "StretchToFill", false, WIDE)).toEqual([3, 1]);
  });

  test("ScaleToFill with ClipToBounds keeps the box and crops the overflow", () => {
    // Native's default pairing. A 2:1 picture in a square box: the sides are
    // what overflows, so half the crop comes off each side and the full height
    // survives.
    const s = resolveSurface(2, 2, true, "ScaleToFill", true, WIDE, "ClipToBounds");
    expect([s.width, s.height]).toEqual([2, 2]);
    const [u0, v0, u1, v1] = s.uv;
    expect(u0).toBeCloseTo(0.25, 6);
    expect(u1).toBeCloseTo(0.75, 6);
    expect(v0).toBeCloseTo(0, 6);
    expect(v1).toBeCloseTo(1, 6);
    // What survives is centred: the middle of the picture, not a corner.
    expect(u0 + u1).toBeCloseTo(1, 6);
  });

  test("ScaleToFill with clipping off overflows instead of cropping", () => {
    const s = resolveSurface(2, 2, true, "ScaleToFill", true, WIDE, "None");
    expect([s.width, s.height]).toEqual([4, 2]);
    expect(s.uv).toEqual([0, 0, 1, 1]);
  });

  test("every other mode shows the whole picture", () => {
    for (const mode of ["ScaleToFit", "StretchToFill"] as const) {
      expect(resolveSurface(2, 2, true, mode, true, WIDE).uv).toEqual([0, 0, 1, 1]);
    }
    expect(resolveSurface(1, 1, false, "ScaleToFill", true, WIDE).uv).toEqual([0, 0, 1, 1]);
  });

  test("never distorts a picture whose shape it knows", () => {
    // The regression this file exists for: on every mode that is not an explicit
    // stretch, the quad's aspect either matches the picture or matches the box
    // the author asked for — it is never some third shape.
    for (const mode of ["ScaleToFit", "ScaleToFill"] as const) {
      for (const aspect of [WIDE, TALL, 1]) {
        // Clipping off, so the quad itself carries the picture's shape; with it
        // on the quad is the box and the UVs carry it instead.
        const s = resolveSurface(2, 2, true, mode, true, aspect, "None");
        expect(s.width / s.height).toBeCloseTo(aspect, 6);
      }
    }
  });
});
