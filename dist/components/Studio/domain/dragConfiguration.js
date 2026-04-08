"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DragConfiguration = void 0;
class DragConfiguration {
    /**
     * Chooses FixedToPlane when the scene uses plane detection, FixedToWorld otherwise.
     * Returns undefined if the asset is not draggable.
     */
    static getDragType(asset, scene) {
        if (!asset.is_draggable)
            return undefined;
        const planeDetection = (scene?.plane_detection ?? "NONE").toUpperCase();
        if (planeDetection === "AUTOMATIC" || planeDetection === "MANUAL") {
            return "FixedToPlane";
        }
        return "FixedToWorld";
    }
    /**
     * Returns a drag plane that passes through the object's current position,
     * preventing objects from jumping on drag start. maxDistance caps how far
     * objects can travel from the camera.
     */
    static getDragPlane(planeAlignment, objectPosition) {
        switch (planeAlignment.toLowerCase()) {
            case "horizontal":
            case "horizontalupward":
                return { planePoint: objectPosition, planeNormal: [0, 1, 0], maxDistance: 1.5 };
            case "horizontaldownward":
                return { planePoint: objectPosition, planeNormal: [0, -1, 0], maxDistance: 1.5 };
            case "vertical":
                return { planePoint: objectPosition, planeNormal: [0, 0, 1], maxDistance: 1.5 };
            default:
                return { planePoint: objectPosition, planeNormal: [0, 1, 0], maxDistance: 1.5 };
        }
    }
}
exports.DragConfiguration = DragConfiguration;
