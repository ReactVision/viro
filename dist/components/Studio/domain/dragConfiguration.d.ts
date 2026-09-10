import { StudioAsset, StudioSceneMeta } from "../types";
export type DragType = "FixedToPlane" | "FixedDistance" | undefined;
export type DragPlane = {
    planePoint: [number, number, number];
    planeNormal: [number, number, number];
    maxDistance: number;
};
/**
 * A detected AR plane as the world plane equation `normal · x = distance`.
 * Kept in that form rather than as the anchor's pose because the pose keeps
 * sliding around inside its own surface as the session grows the plane, which
 * leaves the equation alone: a caller can watch every anchor update and still
 * only react when the surface itself has moved.
 */
export type DragSurface = {
    /** Unit normal, in world space. */
    normal: [number, number, number];
    /** `normal · p` for any point p on the surface. */
    distance: number;
};
/**
 * The world plane a detected surface lies in, from the pose its anchor reports.
 *
 * ARKit and ARCore both orient a plane anchor so its local +Y is the surface
 * normal and its origin sits on the surface, whatever the alignment
 * (`ARPlaneAnchor.transform`, `ArPlane_getCenterPose`), and the transform is
 * passed through unchanged. So a wall differs from a floor only in where that
 * one axis ends up pointing.
 *
 * The euler triple is composed Z·Y·X, the order `VROQuaternion::toEuler`
 * inverts, because that function is what produced it (the anchor event carries
 * `extractRotation(...).toEuler()`). Read in any other order it gives the wrong
 * axis for every plane that is not already axis-aligned.
 */
export declare function dragSurfaceFromAnchor(position: [number, number, number], rotationDegrees: [number, number, number]): DragSurface;
/** Equal to within a tenth of a degree and a centimetre. */
export declare function isSameDragSurface(a: DragSurface, b: DragSurface): boolean;
export declare class DragConfiguration {
    /**
     * FixedToPlane when the scene uses plane detection; otherwise FixedDistance,
     * which keeps the object at its grab distance and follows the finger.
     * (FixedToWorld raycast-snapped objects toward the camera on drag start, so
     * they appeared to grow and were hard to place.) undefined if not draggable.
     */
    static getDragType(asset: StudioAsset, scene: StudioSceneMeta | null): DragType;
    /**
     * Where a dragged asset may travel. Both fields are read in world space:
     * VROInputControllerBase intersects the drag ray with them and compares
     * planePoint against the node's world position.
     *
     * Given the surface the asset is anchored to, the plane is that surface
     * pushed out along its normal by the asset's own Y, which is how far from the
     * surface it was authored. It then keeps that standoff and slides parallel to
     * the real wall, floor or ceiling.
     */
    static getDragPlane(planeAlignment: string, objectPosition: [number, number, number], surface?: DragSurface | null): DragPlane;
}
