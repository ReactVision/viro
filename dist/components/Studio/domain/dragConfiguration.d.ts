import { StudioAsset, StudioSceneMeta } from "../types";
export type DragType = "FixedToWorld" | "FixedToPlane" | undefined;
export type DragPlane = {
    planePoint: [number, number, number];
    planeNormal: [number, number, number];
    maxDistance: number;
};
export declare class DragConfiguration {
    /**
     * Chooses FixedToPlane when the scene uses plane detection, FixedToWorld otherwise.
     * Returns undefined if the asset is not draggable.
     */
    static getDragType(asset: StudioAsset, scene: StudioSceneMeta | null): DragType;
    /**
     * Returns a drag plane that passes through the object's current position,
     * preventing objects from jumping on drag start. maxDistance caps how far
     * objects can travel from the camera.
     */
    static getDragPlane(planeAlignment: string, objectPosition: [number, number, number]): DragPlane;
}
