/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARPlaneSelector
 */

"use strict";

import { ViroAnchor, ViroPlaneUpdatedMap } from "../Types/ViroEvents";
import * as React from "react";
import { ViroMaterials } from "../Material/ViroMaterials";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import { ViroPolygon } from "../ViroPolygon";
import { ViroARPlane } from "./ViroARPlane";

type Props = {
  /**
   * Minimum height (meters) a detected plane must have before it is shown.
   * Planes smaller than this are silently ignored. Default: 0 (no minimum).
   */
  minHeight?: number;

  /**
   * Minimum width (meters) a detected plane must have before it is shown.
   * Planes smaller than this are silently ignored. Default: 0 (no minimum).
   */
  minWidth?: number;

  /**
   * Which plane orientations to accept.
   *
   * | Value              | Accepted planes                        |
   * |--------------------|----------------------------------------|
   * | `"Horizontal"`     | Both HorizontalUpward + HorizontalDownward |
   * | `"HorizontalUpward"` | Upward-facing floors/tables only      |
   * | `"HorizontalDownward"` | Downward-facing ceilings only       |
   * | `"Vertical"`       | Walls and vertical surfaces only       |
   * | `"Both"` (default) | All orientations                       |
   *
   * Default: `"Both"` (accept every plane ARKit/ARCore detects).
   */
  alignment?:
    | "Horizontal"
    | "HorizontalUpward"
    | "HorizontalDownward"
    | "Vertical"
    | "Both";

  /**
   * Called once when the user taps a plane and it becomes selected.
   *
   * @param plane       The ViroAnchor of the selected plane.  Includes
   *                    `center` (local offset), `width`, `height`,
   *                    `alignment`, `vertices`, and `classification`.
   * @param tapPosition World-space position of the tap ray–surface
   *                    intersection.  Use this when you need to know
   *                    the exact 3-D point the user touched (e.g. to
   *                    spawn a particle at the contact point).
   *
   * Note: children are automatically placed at the tap point inside the
   * plane's local coordinate space — you do NOT need to read tapPosition
   * just to get the object at the right location.
   */
  onPlaneSelected?: (
    plane: ViroPlaneUpdatedMap,
    tapPosition?: [number, number, number]
  ) => void;

  /**
   * Called for every plane that passes the alignment and size filters,
   * before it is added to the visible set.
   *
   * Return `false` to reject the plane (e.g. skip planes that are too
   * far away, or have the wrong classification).  Any other return value
   * (including `undefined`) accepts the plane.
   */
  onPlaneDetected?: (plane: ViroPlaneUpdatedMap) => boolean;

  /**
   * Called when ARKit/ARCore removes a previously detected plane.
   *
   * If the removed plane was the selected one, the selection is
   * automatically cleared and `reset()` does not need to be called.
   *
   * @param anchorId The ARKit/ARCore anchor ID of the removed plane.
   */
  onPlaneRemoved?: (anchorId: string) => void;

  /**
   * When `true` (default), the plane overlay for the selected plane is
   * hidden after the user makes a selection.  Only `children` remain
   * visible, giving a clean look without the blue indicator underneath
   * the placed content.
   *
   * Set to `false` to keep the overlay visible on the selected plane
   * (e.g. to let the user see the plane boundary while repositioning
   * content).
   *
   * Unselected planes are always hidden once a selection is made,
   * regardless of this prop.
   *
   * Default: `true`.
   */
  hideOverlayOnSelection?: boolean;

  /**
   * When `true`, tapping a plane overlay does not trigger selection.
   * Use this when you want to select planes programmatically (e.g. via
   * a hit-test in `ViroARScene.performARHitTestWithPoint`) rather than
   * through direct tap.
   *
   * Default: `false` (tap-to-select is enabled).
   */
  disableClickSelection?: boolean;

  /**
   * When `true` (default), the plane overlay uses ARKit/ARCore's actual
   * polygon boundary vertices (`ViroPolygon`) for a precise fit.
   *
   * When `false`, or before ARKit has provided polygon vertices, the
   * overlay falls back to an axis-aligned bounding rectangle
   * (`ViroQuad` sized to `anchor.width × anchor.height`).
   *
   * Default: `true`.
   */
  useActualShape?: boolean;

  /**
   * Name of a `ViroMaterials`-registered material to use for the plane
   * overlay surface.  The material is applied to both the `ViroPolygon`
   * (actual-shape) and the `ViroQuad` (bounding-rect) fallback.
   *
   * Default: `"ViroARPlaneSelector_Translucent"` — a semi-transparent
   * blue material registered at the bottom of this file.
   */
  material?: string;

  /**
   * Content to place on the selected plane at the tap point.
   *
   * Children are rendered as children of `ViroARPlane` (plane-local
   * coordinate space) and are wrapped in a `ViroNode` positioned at the
   * tap location on the plane surface (Y = 0 in local space = on the
   * surface).
   *
   * Children should position themselves relative to this origin:
   *   - `position={[0, 0.5, 0]}` — 50 cm above the tap point (typical
   *     for a 3-D object resting on a floor or wall).
   *   - `position={[0, 0, 0]}`   — at the exact tap contact point.
   *
   * Children are NOT rendered until a plane is selected.
   */
  children?: React.ReactNode;
};

type State = {
  /** anchorId of the currently selected plane, or null if none selected. */
  selectedPlaneId: string | null;
  /**
   * Tap point in the selected plane's local coordinate space (Y=0 on surface).
   * Used to position children at the location the user tapped rather than at
   * the plane's geometric center.  Cleared by reset().
   */
  tapLocalPosition: [number, number, number] | null;
  /** Live map of all accepted planes keyed by their ARKit/ARCore anchor ID. */
  planes: Map<string, ViroAnchor>;
};

/**
 * ViroARPlaneSelector
 *
 * Detects AR planes reported by ARKit (iOS) or ARCore (Android), renders a
 * tappable overlay on each one, and places your content on the plane the user
 * selects — at the exact point they tapped.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUIRED WIRING  (breaking change from the original component)
 * ─────────────────────────────────────────────────────────────────────────────
 * The component no longer self-discovers planes.  You must forward the
 * parent ViroARScene's anchor events to it via a ref:
 *
 *   ```tsx
 *   const selectorRef = useRef<ViroARPlaneSelector>(null);
 *
 *   <ViroARScene
 *     anchorDetectionTypes={["PlanesHorizontal", "PlanesVertical"]}
 *     onAnchorFound={(a)   => selectorRef.current?.handleAnchorFound(a)}
 *     onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(a)}
 *     onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}
 *   >
 *     <ViroARPlaneSelector
 *       ref={selectorRef}
 *       alignment="Both"
 *       onPlaneSelected={(plane, tapPos) => console.log("selected", plane, tapPos)}
 *     >
 *       <Viro3DObject source={...} position={[0, 0.5, 0]} type="GLB" />
 *     </ViroARPlaneSelector>
 *   </ViroARScene>
 *   ```
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BEHAVIOUR
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Plane discovery
 *    `handleAnchorFound` is called for every new ARKit/ARCore plane anchor.
 *    Planes are filtered by `alignment`, `minWidth`, `minHeight`, and the
 *    optional `onPlaneDetected` callback.  Accepted planes are stored in an
 *    internal Map keyed by their ARKit/ARCore anchor ID — no pre-allocated
 *    slots, no index-mapping artefacts.
 *
 * 2. Plane visualisation
 *    Each accepted plane gets one overlay rendered as a child of
 *    `ViroARPlane anchorId={id}` so it is always locked to the correct
 *    real-world surface.  The overlay is:
 *      - A `ViroPolygon` matching ARKit's actual boundary vertices when
 *        `useActualShape` is true (default) and vertices are available.
 *      - A `ViroQuad` (bounding rectangle) otherwise.
 *    All overlays are visible until one is selected; then the others hide.
 *
 * 3. Selection & tap-position placement
 *    When the user taps an overlay the world-space intersection point is
 *    converted to the plane's local coordinate space using the full
 *    inverse rotation (R = Rx·Ry·Rz, X-Y-Z Euler order from VROMatrix4f).
 *    Children are wrapped in a `ViroNode` positioned at that local point
 *    (Y=0 = on the surface), so objects appear exactly where you touched —
 *    not at the plane's geometric centre.
 *
 * 4. Plane removal
 *    `handleAnchorRemoved` removes the plane from the Map.  If the removed
 *    plane was the selected one the selection is automatically cleared.
 *
 * 5. Resetting
 *    Call `selectorRef.current.reset()` to deselect the current plane and
 *    re-show all overlays so the user can pick again.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COORDINATE SYSTEM NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 * Children are in the selected ViroARPlane's local space:
 *   - Y axis = plane normal (perpendicular to surface, pointing "up" for
 *              floors and "outward" for walls).
 *   - XZ plane = the detected surface.
 *   - Origin   = ARKit/ARCore anchor transform origin (near the plane
 *                geometric centre but not necessarily identical to it).
 *
 * Typical child positioning:
 *   `position={[0, 0.5, 0]}`  — 50 cm above / in front of the tap point.
 *   `position={[0, 0, 0]}`    — exactly at the tap contact point.
 */
export class ViroARPlaneSelector extends React.Component<Props, State> {
  state: State = {
    selectedPlaneId: null,
    tapLocalPosition: null,
    planes: new Map<string, ViroAnchor>(),
  };

  // ---------------------------------------------------------------------------
  // Public API — forward ViroARScene anchor events to these via ref
  // ---------------------------------------------------------------------------

  /**
   * Forward `ViroARScene.onAnchorFound` here.
   *
   * Filters by type ("plane"), alignment, size, and `onPlaneDetected`.
   * Accepted planes are added to the visible overlay set.
   *
   * Usage:
   *   `onAnchorFound={(a) => selectorRef.current?.handleAnchorFound(a)}`
   */
  handleAnchorFound = (anchor: ViroAnchor): void => {
    if (anchor.type !== "plane") return;
    if (!this._passesAlignmentFilter(anchor)) return;

    if (this.props.onPlaneDetected) {
      const accepted = this.props.onPlaneDetected(anchor);
      if (accepted === false) return;
    }

    this.setState((prev) => {
      const next = new Map(prev.planes);
      next.set(anchor.anchorId, anchor);
      return { planes: next };
    });
  };

  /**
   * Forward `ViroARScene.onAnchorUpdated` here.
   *
   * Updates the stored anchor data (refined center, extent, and polygon
   * vertices) for any plane already in the visible set.  Unknown anchors
   * are silently ignored.
   *
   * Usage:
   *   `onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(a)}`
   */
  handleAnchorUpdated = (anchor: ViroAnchor): void => {
    if (anchor.type !== "plane") return;
    this.setState((prev) => {
      if (!prev.planes.has(anchor.anchorId)) return null;
      const next = new Map(prev.planes);
      next.set(anchor.anchorId, anchor);
      return { planes: next };
    });
  };

  /**
   * Forward `ViroARScene.onAnchorRemoved` here.
   *
   * Removes the plane from the visible set.  If the removed plane was
   * currently selected, the selection is cleared automatically (equivalent
   * to calling `reset()`), and `onPlaneRemoved` is fired.
   *
   * Note: the `onAnchorRemoved` callback on ViroARScene may fire with
   * `undefined` — guard against that at the call site:
   *   `onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}`
   */
  handleAnchorRemoved = (anchor: ViroAnchor): void => {
    if (!anchor?.anchorId) return;
    const { anchorId } = anchor;
    this.setState((prev) => {
      if (!prev.planes.has(anchorId)) return null;
      const next = new Map(prev.planes);
      next.delete(anchorId);
      return {
        planes: next,
        selectedPlaneId:
          prev.selectedPlaneId === anchorId ? null : prev.selectedPlaneId,
      };
    });
    this.props.onPlaneRemoved?.(anchorId);
  };

  /**
   * Clear the current selection and restore all plane overlays so the user
   * can tap a different plane.
   *
   * Also clears the stored tap position so children return to the plane
   * origin if a new plane is selected before a tap is registered.
   *
   * Typical usage:
   *   ```tsx
   *   // Let the user re-select after moving to a new room:
   *   selectorRef.current?.reset();
   *   ```
   */
  reset = (): void => {
    this.setState({ selectedPlaneId: null, tapLocalPosition: null });
  };

  // ---------------------------------------------------------------------------
  // World → plane-local coordinate conversion
  // ---------------------------------------------------------------------------

  /**
   * Convert a world-space position to ViroARPlane's local coordinate space.
   *
   * ViroARPlane local origin  = anchor.position  (world-space translation
   *   extracted from the ARKit/ARCore anchor transform via
   *   VROMatrix4f::extractTranslation — see VRTARUtils.m).
   *
   * ViroARPlane orientation   = anchor.rotation  (Euler angles in degrees,
   *   extracted via VROMatrix4f::extractRotation().toEuler(), X-Y-Z order
   *   confirmed from VROMatrix4f::rotate which calls rotateX→rotateY→rotateZ).
   *
   * Combined rotation: R = Rx · Ry · Rz
   * World→local:       local = Rᵀ · (world − anchorPosition)
   *                    (Rᵀ = R⁻¹ since R is orthogonal)
   *
   * The returned Y component represents distance from the plane surface.
   * Callers should clamp it to 0 to keep children on the surface.
   */
  _worldToLocal = (
    world: [number, number, number],
    anchorPosition: [number, number, number],
    rotationDeg: [number, number, number]
  ): [number, number, number] => {
    const toRad = Math.PI / 180;
    const c1 = Math.cos(rotationDeg[0] * toRad), s1 = Math.sin(rotationDeg[0] * toRad); // rx
    const c2 = Math.cos(rotationDeg[1] * toRad), s2 = Math.sin(rotationDeg[1] * toRad); // ry
    const c3 = Math.cos(rotationDeg[2] * toRad), s3 = Math.sin(rotationDeg[2] * toRad); // rz

    const dx = world[0] - anchorPosition[0];
    const dy = world[1] - anchorPosition[1];
    const dz = world[2] - anchorPosition[2];

    // Rᵀ of (Rx·Ry·Rz) applied to [dx, dy, dz]:
    return [
       c2*c3*dx + (s1*s2*c3 + c1*s3)*dy + (-c1*s2*c3 + s1*s3)*dz,
      -c2*s3*dx + (-s1*s2*s3 + c1*c3)*dy + ( c1*s2*s3 + s1*c3)*dz,
       s2*dx    + (-s1*c2)*dy             +   c1*c2*dz,
    ];
  };

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _passesAlignmentFilter = (anchor: ViroAnchor): boolean => {
    const { alignment } = this.props;
    if (!alignment || alignment === "Both") return true;
    if (!anchor.alignment) return false;
    if (alignment === "Horizontal")
      return anchor.alignment.includes("Horizontal");
    if (alignment === "Vertical") return anchor.alignment.includes("Vertical");
    return anchor.alignment === alignment;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render() {
    return <ViroNode>{this._renderPlanes()}</ViroNode>;
  }

  _renderPlanes() {
    const { selectedPlaneId, planes } = this.state;
    const materialName =
      this.props.material ?? "ViroARPlaneSelector_Translucent";
    const elements: React.JSX.Element[] = [];

    planes.forEach((anchor, anchorId) => {
      const isSelected = selectedPlaneId === anchorId;
      // hideOverlayOnSelection defaults to true: hide the overlay once a plane
      // is selected (only children remain visible). Set to false to keep the
      // selected plane's overlay visible after selection.
      const hideOnSelection = this.props.hideOverlayOnSelection !== false;
      const surfaceOpacity =
        selectedPlaneId === null ? 1 :          // no selection → all visible
        isSelected && !hideOnSelection ? 1 :    // selected, overlay kept
        0;                                      // selected+hide or unselected → hide

      const vertices3D = anchor.vertices;
      const vertices2D =
        vertices3D && vertices3D.length >= 3
          ? vertices3D.map(
              ([x, _y, z]: [number, number, number]): [number, number] => [
                x,
                z,
              ]
            )
          : undefined;

      // ViroPolygon renders in XY; vertices are in XZ — rotate to align.
      const polygonRotation: [number, number, number] = [-90, 0, 0];

      const useActualShape =
        this.props.useActualShape !== false &&
        vertices2D !== undefined &&
        vertices2D.length >= 3;

      // Click handler — only attached when click selection is enabled.
      const clickHandlerProps = this.props.disableClickSelection
        ? {}
        : {
            onClickState: (
              clickState: number,
              tapWorld: [number, number, number]
            ) => {
              // clickState 3 = CLICKED (click down + up on same target)
              if (clickState === 3) {
                const plane = this.state.planes.get(anchorId);
                if (plane) {
                  // Convert world-space tap → plane-local, clamped to surface (Y=0).
                  const local = this._worldToLocal(
                    tapWorld,
                    plane.position as [number, number, number],
                    plane.rotation as [number, number, number]
                  );
                  const tapLocal: [number, number, number] = [local[0], 0, local[2]];

                  this.setState(
                    { selectedPlaneId: anchorId, tapLocalPosition: tapLocal },
                    () => this.props.onPlaneSelected?.(plane, tapWorld)
                  );
                }
              }
            },
          };

      const visual = useActualShape ? (
        <ViroPolygon
          key={`poly-${anchorId}`}
          vertices={vertices2D!}
          holes={[]}
          materials={[materialName]}
          {...clickHandlerProps}
          position={[0, 0, 0]}
          rotation={polygonRotation}
          opacity={surfaceOpacity}
        />
      ) : (
        <ViroQuad
          key={`quad-${anchorId}`}
          materials={[materialName]}
          {...clickHandlerProps}
          position={[0, 0, 0]}
          width={anchor.width ?? 0.5}
          height={anchor.height ?? 0.5}
          rotation={polygonRotation}
          opacity={surfaceOpacity}
        />
      );

      elements.push(
        <ViroARPlane
          key={anchorId}
          anchorId={anchorId}
          minWidth={this.props.minWidth ?? 0}
          minHeight={this.props.minHeight ?? 0}
          onAnchorUpdated={(a) => this.handleAnchorUpdated(a as ViroAnchor)}
        >
          {visual}
          {isSelected && this.props.children != null && (
            <ViroNode position={this.state.tapLocalPosition ?? [0, 0, 0]}>
              {this.props.children}
            </ViroNode>
          )}
        </ViroARPlane>
      );
    });

    return elements;
  }
}

ViroMaterials.createMaterials({
  ViroARPlaneSelector_Translucent: {
    lightingModel: "Constant",
    diffuseColor: "rgba(0, 122, 255, 0.5)",
    blendMode: "Alpha",
    cullMode: "None",
    writesToDepthBuffer: false,
  },
});
