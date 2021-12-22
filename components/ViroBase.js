"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroBase = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const ViroEvents_1 = require("./Types/ViroEvents");
class ViroBase extends react_1.default.Component {
    constructor() {
        super(...arguments);
        this._component = null;
    }
    _onHover(event) {
        this.props.onHover &&
            this.props.onHover(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
    }
    _onClick(event) {
        this.props.onClick &&
            this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
    }
    _onClickState(event) {
        this.props.onClickState &&
            this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
        let CLICKED = ViroEvents_1.ViroClickStateTypes.CLICKED; // Value representation of Clicked ClickState within EventDelegateJni.
        if (event.nativeEvent.clickState == CLICKED) {
            this._onClick(event);
        }
    }
    _onTouch(event) {
        this.props.onTouch &&
            this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
    }
    _onScroll(event) {
        this.props.onScroll &&
            this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
    }
    _onSwipe(event) {
        this.props.onSwipe &&
            this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
    }
    _onPinch(event) {
        this.props.onPinch &&
            this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
    }
    _onRotate(event) {
        this.props.onRotate &&
            this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
    }
    _onDrag(event) {
        this.props.onDrag &&
            this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
    }
    _onFuse(event) {
        if (this.props.onFuse) {
            if (typeof this.props.onFuse === "function") {
                this.props.onFuse(event.nativeEvent.source);
            }
            else if (this.props.onFuse != undefined &&
                this.props.onFuse.callback != undefined) {
                this.props.onFuse.callback(event.nativeEvent.source);
            }
        }
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
    _onError(event) {
        this.props.onError && this.props.onError(event);
    }
    async getTransformAsync() {
        return await react_native_1.NativeModules.VRTNodeModule.getNodeTransform(react_native_1.findNodeHandle(this));
    }
    async getBoundingBoxAsync() {
        return await react_native_1.NativeModules.VRTNodeModule.getBoundingBox(react_native_1.findNodeHandle(this));
    }
    applyImpulse(force, position) {
        react_native_1.NativeModules.VRTNodeModule.applyImpulse(react_native_1.findNodeHandle(this), force, position);
    }
    applyTorqueImpulse(torque) {
        react_native_1.NativeModules.VRTNodeModule.applyTorqueImpulse(react_native_1.findNodeHandle(this), torque);
    }
    setVelocity(velocity) {
        react_native_1.NativeModules.VRTNodeModule.setVelocity(react_native_1.findNodeHandle(this), velocity);
    }
    _onCollision(event) {
        if (this.props.onCollision) {
            this.props.onCollision(event.nativeEvent.viroTag, event.nativeEvent.collidedPoint, event.nativeEvent.collidedNormal);
        }
    }
    // Called from native on the event a positional change has occured
    // for the underlying control within the renderer.
    _onNativeTransformUpdate(event) {
        var position = event.nativeEvent.position;
        if (this.props.onTransformUpdate) {
            this.props.onTransformUpdate(position);
        }
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
}
exports.ViroBase = ViroBase;
