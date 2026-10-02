"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroPolyline = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const ViroProps_1 = require("./Utilities/ViroProps");
const ViroBase_1 = require("./ViroBase");
class ViroPolyline extends ViroBase_1.ViroBase {
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroPolyline", this.props);
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        let materials = typeof this.props.materials === "string"
            ? new Array(this.props.materials)
            : this.props.materials;
        let transformBehaviors = typeof this.props.transformBehaviors === "string"
            ? new Array(this.props.transformBehaviors)
            : this.props.transformBehaviors;
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
        return ((0, jsx_runtime_1.jsx)(VRTPolyline, { ...this.props, ref: (component) => {
                this._component = component;
            }, highAccuracyEvents: highAccuracyEvents, transformBehaviors: transformBehaviors, onNativeTransformDelegateViro: transformDelegate, hasTransformDelegate: this.props.onTransformUpdate != undefined, materials: materials, canHover: (this.props.onHover != undefined || this.props.onGaze != undefined), canClick: this.props.onClick != undefined ||
                this.props.onClickState != undefined, canTouch: this.props.onTouch != undefined, canScroll: this.props.onScroll != undefined, canSwipe: this.props.onSwipe != undefined, canDrag: this.props.onDrag != undefined, canPinch: this.props.onPinch != undefined, canRotate: this.props.onRotate != undefined, canFuse: this.props.onFuse != undefined, onHoverViro: this._onHover, onClickViro: this._onClickState, onClick: undefined, onTouchViro: this._onTouch, onScrollViro: this._onScroll, onSwipeViro: this._onSwipe, onDragViro: this._onDrag, onPinchViro: this._onPinch, onRotateViro: this._onRotate, onFuseViro: this._onFuse, canCollide: this.props.onCollision != undefined, onCollisionViro: this._onCollision, onAnimationStartViro: this._onAnimationStart, onAnimationFinishViro: this._onAnimationFinish, timeToFuse: timeToFuse }));
    }
}
exports.ViroPolyline = ViroPolyline;
var VRTPolyline = (0, react_native_1.requireNativeComponent)("VRTPolyline", 
// @ts-ignore
ViroPolyline, {
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
        scalePivot: true,
        rotationPivot: true,
    },
});
