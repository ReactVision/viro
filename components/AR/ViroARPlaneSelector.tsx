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
  minHeight?: number;
  minWidth?: number;
  alignment?:
    | "Horizontal"
    | "HorizontalUpward"
    | "HorizontalDownward"
    | "Vertical"
    | "Both";
  onPlaneSelected?: (plane: ViroPlaneUpdatedMap) => void;
  /** Return false to reject the plane and prevent it from being shown. */
  onPlaneDetected?: (plane: ViroPlaneUpdatedMap) => boolean;
  /** Called when a tracked plane is removed by ARKit/ARCore. */
  onPlaneRemoved?: (anchorId: string) => void;
  disableClickSelection?: boolean;
  useActualShape?: boolean;
  /** Custom material name. Defaults to built-in translucent blue material. */
  material?: string;
  children?: React.ReactNode;
};

type State = {
  selectedPlaneId: string | null;
  planes: Map<string, ViroAnchor>;
};

/**
 * Displays detected AR planes and lets the user tap to select one.
 *
 * Wire up via scene-level anchor events:
 *
 *   const selectorRef = useRef<ViroARPlaneSelector>(null);
 *
 *   <ViroARScene
 *     anchorDetectionTypes={["planesHorizontal", "planesVertical"]}
 *     onAnchorFound={(a) => selectorRef.current?.handleAnchorFound(a)}
 *     onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(a)}
 *     onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}
 *   >
 *     <ViroARPlaneSelector ref={selectorRef} alignment="Both" onPlaneSelected={...}>
 *       <MyContent />
 *     </ViroARPlaneSelector>
 *   </ViroARScene>
 */
export class ViroARPlaneSelector extends React.Component<Props, State> {
  state: State = {
    selectedPlaneId: null,
    planes: new Map<string, ViroAnchor>(),
  };

  // ---------------------------------------------------------------------------
  // Public API — call these from ViroARScene anchor event props via ref
  // ---------------------------------------------------------------------------

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

  handleAnchorUpdated = (anchor: ViroAnchor): void => {
    if (anchor.type !== "plane") return;
    this.setState((prev) => {
      if (!prev.planes.has(anchor.anchorId)) return null;
      const next = new Map(prev.planes);
      next.set(anchor.anchorId, anchor);
      return { planes: next };
    });
  };

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

  /** Reset the selection so the user can pick a different plane. */
  reset = (): void => {
    this.setState({ selectedPlaneId: null });
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
      // Show all planes until one is selected; after selection hide others.
      const surfaceOpacity = selectedPlaneId === null || isSelected ? 1 : 0;

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
            onClickState: (clickState: number) => {
              // clickState 3 = CLICKED (click down + up on same target)
              if (clickState === 3) {
                const plane = this.state.planes.get(anchorId);
                if (plane) {
                  this.setState({ selectedPlaneId: anchorId }, () => {
                    this.props.onPlaneSelected?.(plane);
                  });
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
            <ViroNode>{this.props.children}</ViroNode>
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
