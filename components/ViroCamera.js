"use strict";
/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroCamera
 * @flow
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroCamera = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
class ViroCamera extends react_1.default.Component {
    _component;
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
    _onAnimationStart(_event) {
        this.props.animation &&
            this.props.animation.onStart &&
            this.props.animation.onStart();
    }
    _onAnimationFinish(_event) {
        this.props.animation &&
            this.props.animation.onFinish &&
            this.props.animation.onFinish();
    }
    render() {
        // Uncomment this to check props
        //checkMisnamedProps("ViroCamera", this.props);
        return (<VRTCamera ref={(component) => {
                this._component = component;
            }} {...this.props} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish}/>);
    }
}
exports.ViroCamera = ViroCamera;
var VRTCamera = (0, react_native_1.requireNativeComponent)("VRTCamera", 
// @ts-ignore
ViroCamera, {
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
        onAnimationStartViro: true,
        onAnimationFinishViro: true,
        ignoreEventHandling: true,
        dragPlane: true,
        renderingOrder: true,
    },
});
