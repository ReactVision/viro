/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroOrbitCamera
 * @flow
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroOrbitCamera = void 0;
const prop_types_1 = __importDefault(require("prop-types"));
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
class ViroOrbitCamera extends react_1.default.Component {
    _component = null;
    componentDidMount() {
        this.context.cameraDidMount(this);
    }
    componentWillUnmount() {
        this.context.cameraWillUnmount(this);
    }
    componentDidUpdate(prevProps, _prevState) {
        if (prevProps.active != this.props.active) {
            this.context.cameraDidUpdate(this, this.props.active);
        }
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroOrbitCamera", this.props);
        return (<VRTOrbitCamera ref={(component) => {
                this._component = component;
            }} {...this.props}/>);
    }
    static contextTypes = {
        cameraDidMount: prop_types_1.default.func,
        cameraWillUnmount: prop_types_1.default.func,
        cameraDidUpdate: prop_types_1.default.func,
    };
}
exports.ViroOrbitCamera = ViroOrbitCamera;
var VRTOrbitCamera = (0, react_native_1.requireNativeComponent)("VRTOrbitCamera", 
// @ts-ignore
ViroOrbitCamera, {
    nativeOnly: {
        scale: [1, 1, 1],
        materials: [],
        visible: true,
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        onPinchViro: true,
        onRotateViro: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        transformBehaviors: true,
        canFuse: true,
        onFuseViro: true,
        timeToFuse: true,
        viroTag: true,
        scalePivot: true,
        rotationPivot: true,
        canCollide: true,
        onCollisionViro: true,
        onNativeTransformDelegateViro: true,
        hasTransformDelegate: true,
        physicsBody: true,
        dragType: true,
        dragPlane: true,
        animation: true,
        ignoreEventHandling: true,
        renderingOrder: true,
    },
});
