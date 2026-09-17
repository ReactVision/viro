import { StudioAsset } from "../types";
/**
 * Author position with the visibility clamp applied: Z defaults to -2 so an
 * asset with no authored Z sits in front of the camera, and a Z nearer than
 * -0.5 is read as a mistake rather than a placement inside the user's face.
 *
 * Three placements are exempt, since their coordinates are not the
 * camera-relative offset the clamp assumes. A trigger image's are in the
 * marker's frame. A tap-to-place asset's are an offset from the runtime tap
 * point that PlaceableNode adds, so its default is 0 rather than -2. And
 * `world_placement` coordinates are a fixed world point, which clamping
 * rewrites to -2 and pins in front of the view, reading as "the anchor does not
 * stay fixed" with only the warning below to say otherwise.
 *
 * The spatial-sound position lookup shares this rule, so a PLAY at an asset
 * comes from where that asset is mounted.
 */
export declare function studioAssetPosition(asset: StudioAsset): [number, number, number];
