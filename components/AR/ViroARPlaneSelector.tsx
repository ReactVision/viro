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

import { ViroARPlaneSizes, ViroPlaneUpdatedMap } from "../Types/ViroEvents";
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
    if (this.state.selectedSurface == -1) {
      let arPlanes = [];
      let numPlanes = this.props.maxPlanes || _maxPlanes;
      for (var i = 0; i < numPlanes; i++) {
        let foundARPlane = this.state.foundARPlanes[i];
        let surfaceWidth = foundARPlane ? foundARPlane.width : 0;
        let surfaceHeight = foundARPlane ? foundARPlane.height : 0;
        let surfacePosition = foundARPlane ? foundARPlane.center : [0, 0, 0];
        arPlanes.push(
          <ViroARPlane
            key={_planePrefix + i}
            minWidth={this.props.minWidth}
            minHeight={this.props.minHeight}
            alignment={this.props.alignment}
            onAnchorUpdated={this._onARPlaneUpdated(i)}
          >
            <ViroQuad
              materials={"ViroARPlaneSelector_Translucent"}
              onClick={this._getOnClickSurface(i)}
              position={surfacePosition}
              width={surfaceWidth}
              height={surfaceHeight}
              rotation={[-90, 0, 0]}
            />
          </ViroARPlane>
        );
      }
      return arPlanes;
    } else {
      return (
        <ViroARPlane
          key={_planePrefix + this.state.selectedSurface}
          {...this.props}
        ></ViroARPlane>
      );
    }
  }

  _getOnClickSurface = (index: number) => {
    return () => {
      this.setState({ selectedSurface: index });
      this._onPlaneSelected(this.state.foundARPlanes[index]);
    };
  };

  _onARPlaneUpdated = (index: number) => {
    return (updateMap: ViroPlaneUpdatedMap) => {
      this.state.foundARPlanes[index] = updateMap;
      this.setState({
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
