/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARPlane
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
exports.ViroARPlane = void 0;
const ViroBase_1 = require("../ViroBase");
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
/**
 * Container for Viro Components anchored to a detected plane.
 */
class ViroARPlane extends ViroBase_1.ViroBase {
    _onAnchorFound = (event) => {
        if (this.props.onAnchorFound) {
            this.props.onAnchorFound(event.nativeEvent.anchorFoundMap);
        }
    };
    _onAnchorUpdated = (event) => {
        if (this.props.onAnchorUpdated) {
            this.props.onAnchorUpdated(event.nativeEvent.anchorUpdatedMap);
        }
    };
    _onAnchorRemoved = (_event) => {
        if (this.props.onAnchorRemoved) {
            this.props.onAnchorRemoved();
        }
    };
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARPlane", this.props);
        let timeToFuse = undefined;
        if (this.props.onFuse != undefined &&
            typeof this.props.onFuse === "object") {
            timeToFuse = this.props.onFuse.timeToFuse;
        }
        return (<VRTARPlane {...this.props} ref={(component) => {
                this._component = component;
            }} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined ||
                this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canDrag={this.props.onDrag != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} canFuse={this.props.onFuse != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onFuseViro={this._onFuse} timeToFuse={timeToFuse} canCollide={this.props.onCollision != undefined} onCollisionViro={this._onCollision} onAnchorFoundViro={this._onAnchorFound} onAnchorUpdatedViro={this._onAnchorUpdated} onAnchorRemovedViro={this._onAnchorRemoved}/>);
    }
}
exports.ViroARPlane = ViroARPlane;
var VRTARPlane = (0, react_native_1.requireNativeComponent)("VRTARPlane", 
// @ts-ignore
ViroARPlane, {
    nativeOnly: {
        position: [],
        scale: [],
        rotation: [],
        scalePivot: [],
        rotationPivot: [],
        animation: {},
        materials: [],
        physicsBody: {},
        transformBehaviors: [],
        hasTransformDelegate: true,
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        canFuse: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onFuseViro: true,
        timeToFuse: true,
        canCollide: true,
        onCollisionViro: true,
        onAnchorFoundViro: true,
        onAnchorUpdatedViro: true,
        onAnchorRemovedViro: true,
    },
});
