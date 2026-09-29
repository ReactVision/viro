import { type ViroLocationTransform } from "../../AR/ViroLocationFrame";
import type { DragSurface } from "../domain/dragConfiguration";
/** Column-major 4x4, the same layout as a location transform token. */
export type Mat4 = ViroLocationTransform;
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export declare function isVec3(v: unknown): v is Vec3;
/** What a ViroNode needs to sit at a matrix: Euler degrees, R = Rz·Ry·Rx. */
export type NodeTransform = {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
};
export declare const IDENTITY: Mat4;
export declare function multiply(a: Mat4, b: Mat4): Mat4;
export declare function invert(m: Mat4): Mat4 | null;
export declare function transformPoint(m: Mat4, p: Vec3): Vec3;
export declare function rotateDirection(m: Mat4, d: Vec3): Vec3;
/** A pose as ViroNode props describe it (the renderer's Z·Y·X Euler order). */
export declare function fromPositionEuler(position: Vec3, rotationDegrees: Vec3, scale?: Vec3): Mat4;
export declare function fromPositionQuat(position: Vec3, q: Quat): Mat4;
export declare function toNodeTransform(m: Mat4): NodeTransform;
/** Position and unit quaternion [x, y, z, w]; any scale is dropped. */
export declare function toPositionQuat(m: Mat4): {
    p: Vec3;
    q: Quat;
};
export declare function normaliseQuat(q: Quat): Quat | null;
export declare function quatToEuler(q: Quat): Vec3;
/** The `scene:origin` fields as a scene-to-location matrix, null when malformed. */
export declare function parseOriginFields(fields: Record<string, unknown>): Mat4 | null;
/**
 * The plane a shared origin sits on, in world space. A plane anchor's local +Y
 * is its surface normal, and the origin keeps the anchor's orientation.
 */
export declare function dragSurfaceFromSceneToWorld(sceneToWorld: Mat4): DragSurface;
