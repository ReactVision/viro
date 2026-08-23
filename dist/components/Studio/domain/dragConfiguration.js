"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DragConfiguration = void 0;
class DragConfiguration {
    /**
     * FixedToPlane when the scene uses plane detection; otherwise FixedDistance,
     * which keeps the object at its grab distance and follows the finger.
     * (FixedToWorld raycast-snapped objects toward the camera on drag start, so
     * they appeared to grow and were hard to place.) undefined if not draggable.
     */
    static getDragType(asset, scene) {
        if (!asset.is_draggable)
            return undefined;
        const planeDetection = (scene?.plane_detection ?? "NONE").toUpperCase();
        if (planeDetection === "AUTOMATIC" || planeDetection === "MANUAL") {
            return "FixedToPlane";
        }
        return "FixedDistance";
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
