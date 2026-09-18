/**
 * The post-processing Studio asks the web renderer for.
 *
 * This is a pin, not a description: the values were once hdrEnabled:false, with
 * a comment claiming it matched native, and every model in the web player
 * rendered white for it. virocore's isPBREnabled() is `_hdrEnabled &&
 * _pbrEnabled`, so HDR off drops the PBR branch of VROShaderFactory and a glTF
 * material falls back to Blinn, whose default specular washes it out. The curve
 * — which is the thing Studio actually wants off — belongs to the scene.
 */
import {
  STUDIO_RENDERER_EFFECTS,
  STUDIO_TONE_MAPPING_ENABLED,
} from "../components/Studio/domain/studioRendererEffects";

describe("Studio's web renderer effects", () => {
  test("HDR stays on, because PBR rides on it", () => {
    expect(STUDIO_RENDERER_EFFECTS.hdrEnabled).toBe(true);
  });

  test("bloom stays off, because the editor previews none", () => {
    expect(STUDIO_RENDERER_EFFECTS.bloomEnabled).toBe(false);
  });

  test("the curve is off, which is what Studio actually wanted", () => {
    expect(STUDIO_TONE_MAPPING_ENABLED).toBe(false);
  });

  test("nothing else is switched here", () => {
    // Shadows and PBR are left as the renderer built them, as they are natively.
    expect(Object.keys(STUDIO_RENDERER_EFFECTS).sort()).toEqual([
      "bloomEnabled",
      "hdrEnabled",
    ]);
  });
});
