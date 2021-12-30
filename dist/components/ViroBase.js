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
exports.ViroBase = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroEvents_1 = require("./Types/ViroEvents");
class ViroBase extends React.Component {
    _component = null;
    _onHover = (event) => {
        this.props.onHover &&
            this.props.onHover(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
    };
    _onClick = (event) => {
        this.props.onClick &&
            this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
    };
    _onClickState = (event) => {
        this.props.onClickState &&
            this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
        let CLICKED = ViroEvents_1.ViroClickStateTypes.CLICKED; // Value representation of Clicked ClickState within EventDelegateJni.
        if (event.nativeEvent.clickState == CLICKED) {
            this._onClick(event);
        }
    };
    _onTouch = (event) => {
        this.props.onTouch &&
            this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
    };
    _onScroll = (event) => {
        this.props.onScroll &&
            this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
    };
    _onSwipe = (event) => {
        this.props.onSwipe &&
            this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
    };
    _onPinch = (event) => {
        this.props.onPinch &&
            this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
    };
    _onRotate = (event) => {
        this.props.onRotate &&
            this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
    };
    _onDrag = (event) => {
        this.props.onDrag &&
            this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
    };
    _onFuse = (event) => {
        if (this.props.onFuse) {
            if (typeof this.props.onFuse === "function") {
                this.props.onFuse(event.nativeEvent.source);
            }
            else if (this.props.onFuse != undefined &&
                this.props.onFuse.callback != undefined) {
                this.props.onFuse.callback(event.nativeEvent.source);
            }
        }
    };
    _onAnimationStart = (_event) => {
        this.props.animation &&
            this.props.animation.onStart &&
            this.props.animation.onStart();
    };
    _onAnimationFinish = (_event) => {
        this.props.animation &&
            this.props.animation.onFinish &&
            this.props.animation.onFinish();
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    getTransformAsync = async () => {
        return await react_native_1.NativeModules.VRTNodeModule.getNodeTransform((0, react_native_1.findNodeHandle)(this));
    };
    getBoundingBoxAsync = async () => {
        return await react_native_1.NativeModules.VRTNodeModule.getBoundingBox((0, react_native_1.findNodeHandle)(this));
    };
    applyImpulse = (force, position) => {
        react_native_1.NativeModules.VRTNodeModule.applyImpulse((0, react_native_1.findNodeHandle)(this), force, position);
    };
    applyTorqueImpulse = (torque) => {
        react_native_1.NativeModules.VRTNodeModule.applyTorqueImpulse((0, react_native_1.findNodeHandle)(this), torque);
    };
    setVelocity = (velocity) => {
        react_native_1.NativeModules.VRTNodeModule.setVelocity((0, react_native_1.findNodeHandle)(this), velocity);
    };
    _onCollision = (event) => {
        if (this.props.onCollision) {
            this.props.onCollision(event.nativeEvent.viroTag, event.nativeEvent.collidedPoint, event.nativeEvent.collidedNormal);
        }
    };
    // Called from native on the event a positional change has occured
    // for the underlying control within the renderer.
    _onNativeTransformUpdate = (event) => {
        var position = event.nativeEvent.position;
        if (this.props.onTransformUpdate) {
            this.props.onTransformUpdate(position);
        }
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
}
exports.ViroBase = ViroBase;
