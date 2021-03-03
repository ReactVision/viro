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
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_native_1 = require("react-native");
var react_1 = __importDefault(require("react"));
var prop_types_1 = __importDefault(require("prop-types"));
var createReactClass = require('create-react-class');
var ViroMaterials = require('../Material/ViroMaterials');
var ViroARPlane = require('./ViroARPlane');
var ViroQuad = require('../ViroQuad');
var ViroNode = require('../ViroNode');
var _maxPlanes = 15;
var _planePrefix = "ViroARPlaneSelector_Plane_";
/**
 * This component wraps the logic required to enable user selection
 * of an AR plane. This currently only allows for 1 plane to be selected,
 * but could easily be modified to allow for more planes.
 */
var ViroARPlaneSelector = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { maxPlanes: prop_types_1.default.number, minHeight: prop_types_1.default.number, minWidth: prop_types_1.default.number, alignment: prop_types_1.default.oneOf(["Horizontal", "HorizontalUpward", "HorizontalDownward", "Vertical"]), renderingOrder: prop_types_1.default.number, visible: prop_types_1.default.bool, opacity: prop_types_1.default.number, ignoreEventHandling: prop_types_1.default.bool, dragType: prop_types_1.default.oneOf(["FixedDistance", "FixedDistanceOrigin", "FixedToWorld", "FixedToPlane"]), dragPlane: prop_types_1.default.shape({
            planePoint: prop_types_1.default.arrayOf(prop_types_1.default.number),
            planeNormal: prop_types_1.default.arrayOf(prop_types_1.default.number),
            maxDistance: prop_types_1.default.number
        }), onHover: prop_types_1.default.func, onClick: prop_types_1.default.func, onClickState: prop_types_1.default.func, onTouch: prop_types_1.default.func, onScroll: prop_types_1.default.func, onSwipe: prop_types_1.default.func, onDrag: prop_types_1.default.func, onPinch: prop_types_1.default.func, onRotate: prop_types_1.default.func, onFuse: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                callback: prop_types_1.default.func.isRequired,
                timeToFuse: prop_types_1.default.number
            }),
            prop_types_1.default.func
        ]), onCollision: prop_types_1.default.func, viroTag: prop_types_1.default.string, onAnchorFound: prop_types_1.default.func, onAnchorUpdated: prop_types_1.default.func, onAnchorRemoved: prop_types_1.default.func, onPlaneSelected: prop_types_1.default.func }),
    getInitialState: function () {
        return {
            selectedSurface: -1,
            foundARPlanes: []
        };
    },
    render: function () {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARPlaneSelector", this.props);
        return (<ViroNode>
        {this._getARPlanes()}
      </ViroNode>);
    },
    _getARPlanes: function () {
        if (this.state.selectedSurface == -1) {
            var arPlanes = [];
            var numPlanes = this.props.maxPlanes || _maxPlanes;
            for (var i = 0; i < numPlanes; i++) {
                var foundARPlane = this.state.foundARPlanes[i];
                var surfaceWidth = foundARPlane ? foundARPlane.width : 0;
                var surfaceHeight = foundARPlane ? foundARPlane.height : 0;
                var surfacePosition = foundARPlane ? foundARPlane.center : [0, 0, 0];
                arPlanes.push((<ViroARPlane key={_planePrefix + i} minWidth={this.props.minWidth} minHeight={this.props.minHeight} alignment={this.props.alignment} onAnchorUpdated={this._onARPlaneUpdated(i)}>
            <ViroQuad materials={"ViroARPlaneSelector_Translucent"} onClick={this._getOnClickSurface(i)} position={surfacePosition} width={surfaceWidth} height={surfaceHeight} rotation={[-90, 0, 0]}/>
          </ViroARPlane>));
            }
            return arPlanes;
        }
        else {
            return (<ViroARPlane key={_planePrefix + this.state.selectedSurface} {...this.props}>
        </ViroARPlane>);
        }
    },
    _getOnClickSurface: function (index) {
        var _this = this;
        return function () {
            _this.setState({ selectedSurface: index });
            _this._onPlaneSelected(_this.state.foundARPlanes[index]);
        };
    },
    _onARPlaneUpdated: function (index) {
        var _this = this;
        return function (updateMap) {
            _this.state.foundARPlanes[index] = updateMap;
            _this.setState({
                arPlaneSizes: _this.state.arPlaneSizes
            });
        };
    },
    _onPlaneSelected: function (updateMap) {
        this.props.onPlaneSelected && this.props.onPlaneSelected(updateMap);
    },
    /*
    This function allows the user to reset the surface and select a new plane.
    */
    reset: function () {
        this.setState({
            selectedSurface: -1
        });
    }
});
ViroMaterials.createMaterials({
    ViroARPlaneSelector_Translucent: {
        lightingModel: "Constant",
        diffuseColor: "#88888888"
    },
});
module.exports = ViroARPlaneSelector;
