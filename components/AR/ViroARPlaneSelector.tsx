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

import {
  ViroARPlaneSizes,
  ViroClickStateEvent,
  ViroPlaneUpdatedMap,
} from "../Types/ViroEvents";
import { ViroARPlaneType, ViroNativeRef } from "../Types/ViroUtils";
import * as React from "react";
import { ViroMaterials } from "../Material/ViroMaterials";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import { ViroARPlane } from "./ViroARPlane";
import { ViroCommonProps, ViroObjectProps } from "./ViroCommonProps";

var _maxPlanes = 15;
var _planePrefix = "ViroARPlaneSelector_Plane_";

type Props = ViroCommonProps &
  ViroObjectProps & {
    maxPlanes?: number;
    minHeight?: number;
    minWidth?: number;
    alignment?:
      | "Horizontal"
      | "HorizontalUpward"
      | "HorizontalDownward"
      | "Vertical";

    onPlaneSelected?: (updateMap: ViroPlaneUpdatedMap) => void;
  };

type State = {
  selectedSurface: number;
  foundARPlanes: ViroARPlaneType[];
  arPlaneSizes: ViroARPlaneSizes;
};

/**
 * This component wraps the logic required to enable user selection
 * of an AR plane. This currently only allows for 1 plane to be selected,
 * but could easily be modified to allow for more planes.
 */
export class ViroARPlaneSelector extends React.Component<Props, State> {
  _component: ViroNativeRef = null;
  state = {
    selectedSurface: -1,
    foundARPlanes: [] as ViroARPlaneType[],
    arPlaneSizes: [] as number[],
  };

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroARPlaneSelector", this.props);

    return <ViroNode>{this._getARPlanes()}</ViroNode>;
  }

  _getARPlanes() {
    // Always render a fixed number of planes, controlling visibility instead of conditional rendering
    let arPlanes: React.JSX.Element[] = [];
    let numPlanes = this.props.maxPlanes || _maxPlanes;

    // Create all plane slots (both detected and placeholder)
    for (let i = 0; i < numPlanes; i++) {
      // Determine if this is the selected plane
      const isSelected = this.state.selectedSurface === i;

      // Get real plane data if available, or use defaults
      const foundARPlane = this.state.foundARPlanes[i];
      const hasPlaneData = !!foundARPlane;

      // Extract plane data or use defaults
      const surfaceWidth = hasPlaneData ? foundARPlane.width || 0.5 : 0.5;
      const surfaceHeight = hasPlaneData ? foundARPlane.height || 0.5 : 0.5;
      const surfacePosition = hasPlaneData
        ? foundARPlane.center || [0, 0, 0]
        : [0, 0, 0];
      const anchorId = hasPlaneData
        ? (foundARPlane as any).anchorId
        : undefined;

      // Determine visibility based on selection state
      // - In selection mode (selectedSurface === -1): show all planes
      // - In selected mode: only show the selected plane
      const isVisible = this.state.selectedSurface === -1 || isSelected;

      arPlanes.push(
        <ViroARPlane
          key={_planePrefix + i}
          minWidth={this.props.minWidth || 0.5}
          minHeight={this.props.minHeight || 0.5}
          alignment={this.props.alignment}
          anchorId={anchorId}
          onAnchorFound={(anchor) => {
            // If we find an anchor, update our plane data
            this._onARPlaneUpdated(i)(anchor);
          }}
          onAnchorUpdated={this._onARPlaneUpdated(i)}
        >
          {/* Always render both the quad and children, controlling only visibility */}
          <ViroQuad
            materials={"ViroARPlaneSelector_Translucent"}
            onClickState={(clickState, position, source) =>
              this._getOnClickSurface(i, { clickState, position, source })
            }
            position={surfacePosition}
            width={surfaceWidth}
            height={surfaceHeight}
            rotation={[-90, 0, 0]}
            opacity={isSelected ? 0 : isVisible ? 1 : 0}
          />

          {/* Wrap children in a ViroNode to control visibility if children exist */}
          {this.props.children && (
            <ViroNode opacity={isSelected ? 1 : 0}>
              {this.props.children}
            </ViroNode>
          )}
        </ViroARPlane>
      );
    }

    return arPlanes;
  }

  _getOnClickSurface = (index: number, event: ViroClickStateEvent) => {
    if (event.clickState < 3) {
      return;
    }

    // Get the plane data before updating state to avoid race conditions
    const selectedPlane = this.state.foundARPlanes[index];
    if (!selectedPlane) {
      console.warn(
        "ViroARPlaneSelector: Cannot select plane - plane data not found"
      );
      return;
    }

    // Update state and call callback with the captured data
    this.setState({ selectedSurface: index }, () => {
      this._onPlaneSelected(selectedPlane);
    });
  };

  _onARPlaneUpdated = (index: number) => {
    return (updateMap: ViroPlaneUpdatedMap) => {
      let newPlanes = [...this.state.foundARPlanes];
      newPlanes[index] = updateMap;
      this.setState({
        foundARPlanes: newPlanes,
        arPlaneSizes: this.state.arPlaneSizes,
      });
    };
  };

  _onPlaneSelected = (updateMap: ViroPlaneUpdatedMap) => {
    this.props.onPlaneSelected && this.props.onPlaneSelected(updateMap);
  };

  /*
  This function allows the user to reset the surface and select a new plane.
  */
  reset = () => {
    this.setState({
      selectedSurface: -1,
    });
  };
}

ViroMaterials.createMaterials({
  ViroARPlaneSelector_Translucent: {
    lightingModel: "Constant",
    diffuseColor: "#88888888",
  },
});
