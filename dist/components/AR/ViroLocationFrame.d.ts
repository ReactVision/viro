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
 * A direction through a transform, ignoring where the frame's origin sits.
 *
 * `locationToWorld` moves a *point*, which is right for a position and wrong
 * for a basis vector: a forward vector put through it comes back displaced by
 * the origin, so an avatar built from it faces a direction that drifts with the
 * frame. Only the rotation applies to a direction, which is the upper 3x3.
 */
export declare function transformDirection(transform: ViroLocationTransform, direction: Viro3DPoint): Viro3DPoint;
/**
 * The 16-float pose string the co-location channel carries, from a position and
 * a look direction. Everything passed in is already location-frame.
 *
 * Built from the camera's own forward and up rather than from Euler angles:
 * a triple of angles needs a convention to mean anything, the convention
 * differs between the editor, the renderer and the scene graph, and the wrong
 * one produces an avatar that is subtly wrong in a way nobody notices until
 * they are standing in the room. Two basis vectors have no convention to get
 * wrong.
 *
 * The camera looks down its own -Z, so the +Z basis is the negated forward.
 * Reversing that points every avatar away from where its device is pointing.
 */
export declare function poseCsv(position: Viro3DPoint, forward: Viro3DPoint, up: Viro3DPoint): string;
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
