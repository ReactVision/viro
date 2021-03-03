"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var react_1 = __importStar(require("react"));
var react_native_1 = require("react-native");
var createReactClass = require("create-react-class");
var ViroProps_1 = require("./Utilities/ViroProps");
var resolveAssetSource = react_native_1.Image.resolveAssetSource;
// Value representation of Clicked ClickState within EventDelegateJni.
var CLICKED = 3;
var Viro3DObject = /** @class */ (function (_super) {
    __extends(Viro3DObject, _super);
    function Viro3DObject() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._viro3dobj = undefined;
        _this.setNativeProps = function (nativeProps) {
            var _a;
            (_a = _this._viro3dobj) === null || _a === void 0 ? void 0 : _a.setNativeProps(nativeProps);
        };
        _this._onHover = function (event) {
            _this.props.onHover &&
                _this.props.onHover(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
        };
        _this._onClick = function (event) {
            _this.props.onClick &&
                _this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
        };
        _this._onClickState = function (event) {
            _this.props.onClickState &&
                _this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
            if (event.nativeEvent.clickState == CLICKED) {
                _this._onClick(event);
            }
        };
        _this._onTouch = function (event) {
            _this.props.onTouch &&
                _this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
        };
        _this._onScroll = function (event) {
            _this.props.onScroll &&
                _this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
        };
        _this._onSwipe = function (event) {
            _this.props.onSwipe &&
                _this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
        };
        _this._onLoadStart = function (event) {
            _this.props.onLoadStart && _this.props.onLoadStart(event);
        };
        _this._onLoadEnd = function (event) {
            _this.props.onLoadEnd && _this.props.onLoadEnd(event);
        };
        _this._onError = function (event) {
            _this.props.onError && _this.props.onError(event);
        };
        _this._onPinch = function (event) {
            _this.props.onPinch &&
                _this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
        };
        _this._onRotate = function (event) {
            _this.props.onRotate &&
                _this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
        };
        _this._onDrag = function (event) {
            _this.props.onDrag &&
                _this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
        };
        _this._onFuse = function (event) {
            var _a;
            if (_this.props.onFuse) {
                if (typeof _this.props.onFuse === "function") {
                    _this.props.onFuse(event.nativeEvent.source);
                }
                else if ((_a = _this.props.onFuse) === null || _a === void 0 ? void 0 : _a.callback) {
                    _this.props.onFuse.callback(event.nativeEvent.source);
                }
            }
        };
        _this._onAnimationStart = function () {
            var _a, _b;
            (_b = (_a = _this.props.animation) === null || _a === void 0 ? void 0 : _a.onStart) === null || _b === void 0 ? void 0 : _b.call(_a);
        };
        _this._onAnimationFinish = function () {
            var _a, _b;
            (_b = (_a = _this.props.animation) === null || _a === void 0 ? void 0 : _a.onFinish) === null || _b === void 0 ? void 0 : _b.call(_a);
        };
        _this.applyImpulse = function (force, position) {
            react_native_1.NativeModules.VRTNodeModule.applyImpulse(react_native_1.findNodeHandle(_this), force, position);
        };
        _this.applyTorqueImpulse = function (torque) {
            react_native_1.NativeModules.VRTNodeModule.applyTorqueImpulse(react_native_1.findNodeHandle(_this), torque);
        };
        _this.setVelocity = function (velocity) {
            react_native_1.NativeModules.VRTNodeModule.setVelocity(react_native_1.findNodeHandle(_this), velocity);
        };
        _this._onCollision = function (event) {
            var _a, _b;
            (_b = (_a = _this.props).onCollision) === null || _b === void 0 ? void 0 : _b.call(_a, event.nativeEvent.viroTag, event.nativeEvent.collidedPoint, event.nativeEvent.collidedNormal);
        };
        // Called from native on the event a positional change has occured
        // for the underlying control within the renderer.
        _this._onNativeTransformUpdate = function (event) {
            var _a, _b;
            (_b = (_a = _this.props).onTransformUpdate) === null || _b === void 0 ? void 0 : _b.call(_a, event.nativeEvent.position);
        };
        _this.getTransformAsync = function () {
            return react_native_1.NativeModules.VRTNodeModule.getNodeTransform(react_native_1.findNodeHandle(_this));
        };
        _this.getBoundingBoxAsync = function () {
            return react_native_1.NativeModules.VRTNodeModule.getBoundingBox(react_native_1.findNodeHandle(_this));
        };
        _this.getMorphTargets = function () {
            return react_native_1.NativeModules.VRTNodeModule.getMorphTargets(react_native_1.findNodeHandle(_this));
        };
        return _this;
    }
    Viro3DObject.prototype.render = function () {
        var _this = this;
        var _a, _b;
        ViroProps_1.checkMisnamedProps("Viro3DObject", this.props);
        var modelsrc = resolveAssetSource(this.props.source);
        var resources = (_a = this.props.resources) === null || _a === void 0 ? void 0 : _a.map(function (resource) {
            return resolveAssetSource(resource);
        });
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        var materials = typeof this.props.materials === "string"
            ? [this.props.materials]
            : this.props.materials;
        var transformBehaviors = typeof this.props.transformBehaviors === "string"
            ? [this.props.transformBehaviors]
            : this.props.transformBehaviors;
        // @ts-ignore since onFuse could be a function, but this should be fine either way.
        var timeToFuse = (_b = this.props.onFuse) === null || _b === void 0 ? void 0 : _b.timeToFuse;
        // Always autogenerate a compound shape for 3DObjects if no shape is defined.
        var newPhysicsBody = this.props.physicsBody && __assign(__assign({}, this.props.physicsBody), { shape: this.props.physicsBody.shape || { type: "compound" } });
        var highAccuracyEvents = this.props.highAccuracyEvents;
        if (this.props.highAccuracyEvents == undefined &&
            this.props.highAccuracyGaze != undefined) {
            console.warn("**DEPRECATION WARNING** highAccuracyGaze has been deprecated/renamed to highAccuracyEvents");
            highAccuracyEvents = this.props.highAccuracyGaze;
        }
        // Called from native on the event a positional change has occured
        // for the underlying control within the renderer.
        var transformDelegate = this.props.onTransformUpdate != undefined
            ? this._onNativeTransformUpdate
            : undefined;
        return (<VRT3DObject {...this.props} ref={function (component) {
            _this._viro3dobj = component;
        }} highAccuracyEvents={highAccuracyEvents} onNativeTransformDelegateViro={transformDelegate} hasTransformDelegate={this.props.onTransformUpdate != undefined} physicsBody={newPhysicsBody} source={modelsrc} resources={resources} materials={materials} transformBehaviors={transformBehaviors} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined ||
            this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canDrag={this.props.onDrag != undefined} canFuse={this.props.onFuse != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onFuseViro={this._onFuse} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onLoadStartViro={this._onLoadStart} onLoadEndViro={this._onLoadEnd} onErrorViro={this._onError} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} timeToFuse={timeToFuse} canCollide={this.props.onCollision != undefined} onCollisionViro={this._onCollision}/>);
    };
    return Viro3DObject;
}(react_1.Component));
exports.default = Viro3DObject;
var VRT3DObject = react_native_1.requireNativeComponent("VRT3DObject", 
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
