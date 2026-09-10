/**
 * Copyright © 2026 ReactVision
 *
 * Location-frame maths for co-located AR.
 *
 * A resolved cloud anchor defines a *location frame*: an origin every device in
 * the space agrees on. World coordinates do not survive the trip between
 * devices — each AR session picks its own origin wherever tracking started — so
 * anything two devices exchange (a placed object, a peer's pose) has to be
 * expressed in this frame and converted on arrival.
 *
 * That is the whole contract: **send location-frame coordinates, never world
 * coordinates.**
 *
 * @providesModule ViroLocationFrame
 */
import { Viro3DPoint } from "../Types/ViroUtils";
/**
 * The 16 floats behind a `resolvedTransform` / `locationTransform` token.
 *
 * Column-major, matching `VROMatrix4f::getArray()` on both platforms
 * (`rvMatrixToCsv` on iOS, `rvMatrixToCsvJNI` on Android): elements 12, 13 and
 * 14 are the translation.
 */
export type ViroLocationTransform = number[];
/**
 * Parse the opaque transform token handed back by `resolveCloudAnchor()` or
 * `finishScan()`.
 *
 * The token stays opaque for the mesh APIs — pass it straight through to
 * `loadWorldMeshFromFile()` / `snapshotWorldMeshToFile()` rather than
 * round-tripping it through here.
 *
 * @returns the 16 floats, or `null` when the token is malformed.
 */
export declare function parseLocationTransform(token: string | undefined | null): ViroLocationTransform | null;
/**
 * Location frame → world. Use on a position that arrived from another device.
 */
export declare function locationToWorld(transform: ViroLocationTransform, point: Viro3DPoint): Viro3DPoint;
/**
 * World → location frame. Use on a position before sending it to another device.
 */
export declare function worldToLocation(transform: ViroLocationTransform, point: Viro3DPoint): Viro3DPoint | null;
/**
 * General 4×4 inverse.
 *
 * A rigid transform could be inverted far more cheaply, but the resolved
 * transform is not guaranteed rigid — the resolve path composes scale into it —
 * and a transpose-based shortcut would silently produce wrong positions in that
 * case rather than failing.
 *
 * @returns null for a singular matrix.
 */
export declare function invertTransform(m: ViroLocationTransform): ViroLocationTransform | null;
