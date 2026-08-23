import { StudioAsset, StudioSceneMeta } from "../types";
export type DragType = "FixedToPlane" | "FixedDistance" | undefined;
export type DragPlane = {
    planePoint: [number, number, number];
    planeNormal: [number, number, number];
    maxDistance: number;
};
export declare class DragConfiguration {
    /**
     * FixedToPlane when the scene uses plane detection; otherwise FixedDistance,
     * which keeps the object at its grab distance and follows the finger.
     * (FixedToWorld raycast-snapped objects toward the camera on drag start, so
     * they appeared to grow and were hard to place.) undefined if not draggable.
     */
    static getDragType(asset: StudioAsset, scene: StudioSceneMeta | null): DragType;
    /**
     * Returns a drag plane that passes through the object's current position,
     * preventing objects from jumping on drag start. maxDistance caps how far
     * objects can travel from the camera.
     */
    static getDragPlane(planeAlignment: string, objectPosition: [number, number, number]): DragPlane;
}
