"use strict";
/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
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
exports.ViroBox = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroProps_1 = require("./Utilities/ViroProps");
const ViroBase_1 = require("./ViroBase");
class ViroBox extends ViroBase_1.ViroBase {
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroBox", this.props);
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        let materials = typeof this.props.materials === "string"
            ? new Array(this.props.materials)
            : this.props.materials;
        let transformBehaviors = typeof this.props.transformBehaviors === "string"
            ? new Array(this.props.transformBehaviors)
            : this.props.transformBehaviors;
        if (materials) {
            if (materials.length != 1 && materials.length != 6) {
                console.error("<ViroBox> can only take 1 material for all sides or 6, one for each side.");
            }
        }
        let timeToFuse = undefined;
        if (this.props.onFuse != undefined &&
            typeof this.props.onFuse === "object") {
            timeToFuse = this.props.onFuse.timeToFuse;
        }
        let transformDelegate = this.props.onTransformUpdate != undefined
            ? this._onNativeTransformUpdate
            : undefined;
        let highAccuracyEvents = this.props.highAccuracyEvents;
        if (this.props.highAccuracyEvents == undefined &&
            this.props.highAccuracyGaze != undefined) {
            console.warn("**DEPRECATION WARNING** highAccuracyGaze has been deprecated/renamed to highAccuracyEvents");
            highAccuracyEvents = this.props.highAccuracyGaze;
        }
        return (<VRTBox {...this.props} ref={(component) => {
                this._component = component;
            }} highAccuracyEvents={highAccuracyEvents} transformBehaviors={transformBehaviors} onNativeTransformDelegateViro={transformDelegate} hasTransformDelegate={this.props.onTransformUpdate != undefined} materials={materials} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined ||
                this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canDrag={this.props.onDrag != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} canFuse={this.props.onFuse != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onFuseViro={this._onFuse} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} canCollide={this.props.onCollision != undefined} onCollisionViro={this._onCollision} timeToFuse={timeToFuse}/>);
    }
}
exports.ViroBox = ViroBox;
var VRTBox = (0, react_native_1.requireNativeComponent)("VRTBox", 
// @ts-ignore
ViroBox, {
    nativeOnly: {
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
        onNativeTransformDelegateViro: true,
        hasTransformDelegate: true,
        onAnimationStartViro: true,
        onAnimationFinishViro: true,
    },
});
