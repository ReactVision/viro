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
 * How far from the camera a dragged asset may travel. Generous on purpose,
 * because it is measured against the surface the drag is confined to and
 * virocore's behaviour past it is unsafe. `getPlaneIntersect` takes the true
 * ray hit while that hit is inside this distance; beyond it, it falls back to
 * the circle where a sphere of this radius meets the plane, via
 * `sqrtf(maxDistance^2 - cameraToPlane^2)`. That square root is unguarded, so
 * a camera further from the surface than this yields NaN, and a NaN world
 * transform takes the node off screen. The old 1.5 m was shorter than the
 * distance anyone stands from a wall, so a wall scene hit that fallback on
 * nearly every drag; this is a room's diagonal instead.
 */
const MAX_DRAG_DISTANCE = 12;

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
export function dragSurfaceFromAnchor(
  position: [number, number, number],
  rotationDegrees: [number, number, number]
): DragSurface {
  const toRadians = Math.PI / 180;
  const cx = Math.cos(rotationDegrees[0] * toRadians);
  const sx = Math.sin(rotationDegrees[0] * toRadians);
  const cy = Math.cos(rotationDegrees[1] * toRadians);
  const sy = Math.sin(rotationDegrees[1] * toRadians);
  const cz = Math.cos(rotationDegrees[2] * toRadians);
  const sz = Math.sin(rotationDegrees[2] * toRadians);

  const normal: [number, number, number] = [
    sx * sy * cz - cx * sz,
    sx * sy * sz + cx * cz,
    sx * cy,
  ];
  return {
    normal,
    distance:
      normal[0] * position[0] +
      normal[1] * position[1] +
      normal[2] * position[2],
  };
}

/** Equal to within a tenth of a degree and a centimetre. */
export function isSameDragSurface(a: DragSurface, b: DragSurface): boolean {
  const alignment =
    a.normal[0] * b.normal[0] +
    a.normal[1] * b.normal[1] +
    a.normal[2] * b.normal[2];
  return alignment > 0.999998 && Math.abs(a.distance - b.distance) < 0.01;
}

export class DragConfiguration {
  /**
   * FixedToPlane when the scene uses plane detection; otherwise FixedDistance,
   * which keeps the object at its grab distance and follows the finger.
   * (FixedToWorld raycast-snapped objects toward the camera on drag start, so
   * they appeared to grow and were hard to place.) undefined if not draggable.
   */
  static getDragType(asset: StudioAsset, scene: StudioSceneMeta | null): DragType {
    if (!asset.is_draggable) return undefined;

    const planeDetection = ((scene?.plane_detection as string) ?? "NONE").toUpperCase();

    if (planeDetection === "AUTOMATIC" || planeDetection === "MANUAL") {
      return "FixedToPlane";
    }
    return "FixedDistance";
  }

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
  static getDragPlane(
    planeAlignment: string,
    objectPosition: [number, number, number],
    surface?: DragSurface | null
  ): DragPlane {
    if (surface) {
      const offset = surface.distance + objectPosition[1];
      return {
        planePoint: [
          surface.normal[0] * offset,
          surface.normal[1] * offset,
          surface.normal[2] * offset,
        ],
        planeNormal: surface.normal,
        maxDistance: MAX_DRAG_DISTANCE,
      };
    }

    // No plane found yet, or an asset anchored to something else (an image
    // marker, a tap point). With no anchor transform to read this can only
    // guess an axis from what the scene asked to detect and treat the authored
    // position as a world one, which is why a wall facing any way but world Z
    // needs the branch above.
    switch (planeAlignment.toLowerCase()) {
      case "horizontal":
      case "horizontalupward":
        return {
          planePoint: objectPosition,
          planeNormal: [0, 1, 0],
          maxDistance: MAX_DRAG_DISTANCE,
        };
      case "horizontaldownward":
        return {
          planePoint: objectPosition,
          planeNormal: [0, -1, 0],
          maxDistance: MAX_DRAG_DISTANCE,
        };
      case "vertical":
        return {
          planePoint: objectPosition,
          planeNormal: [0, 0, 1],
          maxDistance: MAX_DRAG_DISTANCE,
        };
      default:
        return {
          planePoint: objectPosition,
          planeNormal: [0, 1, 0],
          maxDistance: MAX_DRAG_DISTANCE,
        };
    }
  }
}
