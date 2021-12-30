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
exports.Viro3DObject = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroProps_1 = require("./Utilities/ViroProps");
const ViroBase_1 = require("./ViroBase");
const { resolveAssetSource } = react_native_1.Image;
/**
 * Viro3DObject is a component that is used to render 3D models in the scene.
 */
class Viro3DObject extends ViroBase_1.ViroBase {
    render() {
        (0, ViroProps_1.checkMisnamedProps)("Viro3DObject", this.props);
        const modelsrc = resolveAssetSource(this.props.source);
        const resources = this.props.resources?.map((resource) => resolveAssetSource(resource));
        console.log("RESOURCES", resources);
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        const materials = typeof this.props.materials === "string"
            ? [this.props.materials]
            : this.props.materials;
        const transformBehaviors = typeof this.props.transformBehaviors === "string"
            ? [this.props.transformBehaviors]
            : this.props.transformBehaviors;
        // @ts-ignore since onFuse could be a function, but this should be fine either way.
        const timeToFuse = this.props.onFuse?.timeToFuse;
        // Always autogenerate a compound shape for 3DObjects if no shape is defined.
        const newPhysicsBody = this.props.physicsBody && {
            ...this.props.physicsBody,
            shape: this.props.physicsBody.shape || { type: "compound" },
        };
        let highAccuracyEvents = this.props.highAccuracyEvents;
        if (this.props.highAccuracyEvents == undefined &&
            this.props.highAccuracyGaze != undefined) {
            console.warn("**DEPRECATION WARNING** highAccuracyGaze has been deprecated/renamed to highAccuracyEvents");
            highAccuracyEvents = this.props.highAccuracyGaze;
        }
        // Called from native on the event a positional change has occured
        // for the underlying control within the renderer.
        const transformDelegate = this.props.onTransformUpdate != undefined
            ? this._onNativeTransformUpdate
            : undefined;
        return (<VRT3DObject {...this.props} ref={(component) => {
                this._component = component;
            }} highAccuracyEvents={highAccuracyEvents} onNativeTransformDelegateViro={transformDelegate} hasTransformDelegate={this.props.onTransformUpdate != undefined} physicsBody={newPhysicsBody} source={modelsrc} resources={resources} materials={materials} transformBehaviors={transformBehaviors} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined ||
                this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canDrag={this.props.onDrag != undefined} canFuse={this.props.onFuse != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onFuseViro={this._onFuse} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onLoadStartViro={this._onLoadStart} onLoadEndViro={this._onLoadEnd} onErrorViro={this._onError} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} timeToFuse={timeToFuse} canCollide={this.props.onCollision != undefined} onCollisionViro={this._onCollision}/>);
    }
    _onLoadStart = (event) => {
        this.props.onLoadStart && this.props.onLoadStart(event);
    };
    _onLoadEnd = (event) => {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    };
    getBoundingBoxAsync = () => {
        return react_native_1.NativeModules.VRTNodeModule.getBoundingBox((0, react_native_1.findNodeHandle)(this));
    };
    getMorphTargets = () => {
        return react_native_1.NativeModules.VRTNodeModule.getMorphTargets((0, react_native_1.findNodeHandle)(this));
    };
}
exports.Viro3DObject = Viro3DObject;
// We can probably give a better type for this, but it's not exposed ouside this file so not urgent
const VRT3DObject = (0, react_native_1.requireNativeComponent)("VRT3DObject", 
// @ts-ignore type signature incorrect, or extra arguments are ignored?
Viro3DObject, {
    nativeOnly: {
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canFuse: true,
        canPinch: true,
        canRotate: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onLoadStartViro: true,
        onLoadEndViro: true,
        onErrorViro: true,
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
