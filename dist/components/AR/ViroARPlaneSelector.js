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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARPlaneSelector = void 0;
const React = __importStar(require("react"));
const ViroMaterials_1 = require("../Material/ViroMaterials");
const ViroNode_1 = require("../ViroNode");
const ViroQuad_1 = require("../ViroQuad");
const ViroARPlane_1 = require("./ViroARPlane");
var _maxPlanes = 15;
var _planePrefix = "ViroARPlaneSelector_Plane_";
/**
 * This component wraps the logic required to enable user selection
 * of an AR plane. This currently only allows for 1 plane to be selected,
 * but could easily be modified to allow for more planes.
 */
class ViroARPlaneSelector extends React.Component {
    _component = null;
    state = {
        selectedSurface: -1,
        foundARPlanes: [],
        arPlaneSizes: [],
    };
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARPlaneSelector", this.props);
        return <ViroNode_1.ViroNode>{this._getARPlanes()}</ViroNode_1.ViroNode>;
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
                arPlanes.push(<ViroARPlane_1.ViroARPlane key={_planePrefix + i} minWidth={this.props.minWidth} minHeight={this.props.minHeight} alignment={this.props.alignment} onAnchorUpdated={this._onARPlaneUpdated(i)}>
            <ViroQuad_1.ViroQuad materials={"ViroARPlaneSelector_Translucent"} onClick={this._getOnClickSurface(i)} position={surfacePosition} width={surfaceWidth} height={surfaceHeight} rotation={[-90, 0, 0]}/>
          </ViroARPlane_1.ViroARPlane>);
            }
            return arPlanes;
        }
        else {
            return (<ViroARPlane_1.ViroARPlane key={_planePrefix + this.state.selectedSurface} {...this.props}></ViroARPlane_1.ViroARPlane>);
        }
    }
    _getOnClickSurface = (index) => {
        return () => {
            this.setState({ selectedSurface: index });
            this._onPlaneSelected(this.state.foundARPlanes[index]);
        };
    };
    _onARPlaneUpdated = (index) => {
        return (updateMap) => {
            this.state.foundARPlanes[index] = updateMap;
            this.setState({
                arPlaneSizes: this.state.arPlaneSizes,
            });
        };
    };
    _onPlaneSelected = (updateMap) => {
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
exports.ViroARPlaneSelector = ViroARPlaneSelector;
ViroMaterials_1.ViroMaterials.createMaterials({
    ViroARPlaneSelector_Translucent: {
        lightingModel: "Constant",
        diffuseColor: "#88888888",
    },
});
