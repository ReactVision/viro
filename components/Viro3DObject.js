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
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
var createReactClass = require("create-react-class");
const ViroProps_1 = require("./Utilities/ViroProps");
const { resolveAssetSource } = react_native_1.Image;
// Value representation of Clicked ClickState within EventDelegateJni.
const CLICKED = 3;
class Viro3DObject extends react_1.Component {
    constructor() {
        super(...arguments);
        this._viro3dobj = undefined;
        this.setNativeProps = (nativeProps) => {
            this._viro3dobj?.setNativeProps(nativeProps);
        };
        this._onHover = (event) => {
            this.props.onHover &&
                this.props.onHover(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
        };
        this._onClick = (event) => {
            this.props.onClick &&
                this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
        };
        this._onClickState = (event) => {
            this.props.onClickState &&
                this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
            if (event.nativeEvent.clickState == CLICKED) {
                this._onClick(event);
            }
        };
        this._onTouch = (event) => {
            this.props.onTouch &&
                this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
        };
        this._onScroll = (event) => {
            this.props.onScroll &&
                this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
        };
        this._onSwipe = (event) => {
            this.props.onSwipe &&
                this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
        };
        this._onLoadStart = (event) => {
            this.props.onLoadStart && this.props.onLoadStart(event);
        };
        this._onLoadEnd = (event) => {
            this.props.onLoadEnd && this.props.onLoadEnd(event);
        };
        this._onError = (event) => {
            this.props.onError && this.props.onError(event);
        };
        this._onPinch = (event) => {
            this.props.onPinch &&
                this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
        };
        this._onRotate = (event) => {
            this.props.onRotate &&
                this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
        };
        this._onDrag = (event) => {
            this.props.onDrag &&
                this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
        };
        this._onFuse = (event) => {
            if (this.props.onFuse) {
                if (typeof this.props.onFuse === "function") {
                    this.props.onFuse(event.nativeEvent.source);
                }
                else if (this.props.onFuse?.callback) {
                    this.props.onFuse.callback(event.nativeEvent.source);
                }
            }
        };
        this._onAnimationStart = () => {
            this.props.animation?.onStart?.();
        };
        this._onAnimationFinish = () => {
            this.props.animation?.onFinish?.();
        };
        this.applyImpulse = (force, position) => {
            react_native_1.NativeModules.VRTNodeModule.applyImpulse(react_native_1.findNodeHandle(this), force, position);
        };
        this.applyTorqueImpulse = (torque) => {
            react_native_1.NativeModules.VRTNodeModule.applyTorqueImpulse(react_native_1.findNodeHandle(this), torque);
        };
        this.setVelocity = (velocity) => {
            react_native_1.NativeModules.VRTNodeModule.setVelocity(react_native_1.findNodeHandle(this), velocity);
        };
        this._onCollision = (event) => {
            this.props.onCollision?.(event.nativeEvent.viroTag, event.nativeEvent.collidedPoint, event.nativeEvent.collidedNormal);
        };
        // Called from native on the event a positional change has occured
        // for the underlying control within the renderer.
        this._onNativeTransformUpdate = (event) => {
            this.props.onTransformUpdate?.(event.nativeEvent.position);
        };
        this.getTransformAsync = () => {
            return react_native_1.NativeModules.VRTNodeModule.getNodeTransform(react_native_1.findNodeHandle(this));
        };
        this.getBoundingBoxAsync = () => {
            return react_native_1.NativeModules.VRTNodeModule.getBoundingBox(react_native_1.findNodeHandle(this));
        };
        this.getMorphTargets = () => {
            return react_native_1.NativeModules.VRTNodeModule.getMorphTargets(react_native_1.findNodeHandle(this));
        };
    }
    render() {
        ViroProps_1.checkMisnamedProps("Viro3DObject", this.props);
        const modelsrc = resolveAssetSource(this.props.source);
        const resources = this.props.resources?.map((resource) => resolveAssetSource(resource));
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
            this._viro3dobj = component;
        }} highAccuracyEvents={highAccuracyEvents} onNativeTransformDelegateViro={transformDelegate} hasTransformDelegate={this.props.onTransformUpdate != undefined} physicsBody={newPhysicsBody} source={modelsrc} resources={resources} materials={materials} transformBehaviors={transformBehaviors} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined ||
            this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canDrag={this.props.onDrag != undefined} canFuse={this.props.onFuse != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onFuseViro={this._onFuse} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onLoadStartViro={this._onLoadStart} onLoadEndViro={this._onLoadEnd} onErrorViro={this._onError} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} timeToFuse={timeToFuse} canCollide={this.props.onCollision != undefined} onCollisionViro={this._onCollision}/>);
    }
}
exports.default = Viro3DObject;
// We can probably give a better type for this, but it's not exposed ouside this file so not urgent
const VRT3DObject = react_native_1.requireNativeComponent("VRT3DObject", 
// @ts-ignore type signnature incorrect, or extra arguments are ignored?
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
