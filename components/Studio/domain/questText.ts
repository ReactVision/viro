import type { StudioAsset } from "../types";

/** The size every Studio text asset is drawn at. */
export const STUDIO_TEXT_FONT_SIZE = 20;

// ViroText rasterises a glyph at fontSize pixels and stretches it over fontSize
// centimetres, which a headset shows blurred. On Quest a text asset is drawn at
// this many times the size, in a box as many times larger, under its node scale
// divided by it: the same world size and wrapping with 64 times the texels.
// virocore's glyph atlas is 512 px, so a raster much above 400 px would not fit.
export const QUEST_TEXT_SUPERSAMPLE = 8;

export function studioTextAssetIds(
  assets: ReadonlyArray<Pick<StudioAsset, "id" | "asset_type_name">>
): Set<string> {
  return new Set(
    assets.filter((a) => a.asset_type_name === "TEXT").map((a) => a.id)
  );
}

const SCALE_KEYS = ["scaleX", "scaleY", "scaleZ"] as const;
const ABSOLUTE = /^-?\d+(?:\.\d+)?$/;
const ADDITIVE = /^([+-]=)\s*(-?\d+(?:\.\d+)?)$/;

/**
 * A supersampled text's node scale carries the division, so the scale its
 * animations set or add is divided too. "*=" and "/=" are ratios and stay.
 */
export function scaleKeyframesForSupersampledText(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...properties };
  for (const key of SCALE_KEYS) {
    const value = out[key];
    if (typeof value === "number") {
      out[key] = value / QUEST_TEXT_SUPERSAMPLE;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      const additive = ADDITIVE.exec(trimmed);
      if (additive) {
        out[key] = `${additive[1]}${Number(additive[2]) / QUEST_TEXT_SUPERSAMPLE}`;
      } else if (ABSOLUTE.test(trimmed)) {
        out[key] = Number(trimmed) / QUEST_TEXT_SUPERSAMPLE;
      }
    }
  }
  return out;
}
