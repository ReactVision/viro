/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroSmoothing
 */
export type ViroVec3 = [number, number, number];
export type ViroQuat = [number, number, number, number];
/** Metres, and the radian-ish quaternion distance, below which a value is there. */
export declare const DEFAULT_SNAP_EPSILON = 0.001;
/**
 * How far to move toward a target this frame, as a fraction.
 *
 * Expressed as a half-life rather than a per-frame fraction because a fixed
 * fraction moves twice as fast on a 90 Hz headset as on a 45 Hz phone, which is
 * how smoothing gets tuned on one device and looks wrong on the other. A frame
 * long enough to cover several half-lives returns 1, so an app coming back from
 * the background snaps rather than gliding in from wherever it was.
 */
export declare function approachFactor(dtMs: number, halfLifeMs: number): number;
export declare function isVec3(value: unknown): value is ViroVec3;
export declare function isQuat(value: unknown): value is ViroQuat;
/**
 * Move a position toward its target, returning `target` itself once it arrives.
 *
 * That identity is the settled signal: exponential approach never exactly
 * reaches anything, so without a snap a released object would sit a fraction of
 * a millimetre off the authoritative position for the life of the session, and
 * the frame loop would keep re-rendering to get there.
 */
export declare function approachVec3(current: ViroVec3, target: ViroVec3, factor: number, snapEpsilon?: number): ViroVec3;
/**
 * The same for an orientation, over the shorter of the two arcs.
 *
 * A quaternion and its negation are the same rotation, so without the sign flip
 * a peer turning slightly can be interpolated the long way round and spin
 * through 300 degrees to arrive somewhere it already nearly was. Normalised
 * lerp rather than true slerp: at the angles between two samples a tenth of a
 * second apart the difference is not visible, and it costs no trigonometry.
 */
export declare function approachQuat(current: ViroQuat, target: ViroQuat, factor: number, snapEpsilon?: number): ViroQuat;
