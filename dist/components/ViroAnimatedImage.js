/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAnimatedImage = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
const ViroBase_1 = require("./ViroBase");
class ViroAnimatedImage extends ViroBase_1.ViroBase {
    _component = null;
    _onLoadStart = (event) => {
        this.props.onLoadStart && this.props.onLoadStart(event);
    };
    _onLoadEnd = (event) => {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    };
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroAnimatedImage", this.props);
        var defaultPlaceholder = require("./Resources/viro_blank.png");
        var imgsrc = (0, resolveAssetSource_1.default)(this.props.source);
        var placeholderSrc;
        if (this.props.placeholderSource) {
            placeholderSrc = (0, resolveAssetSource_1.default)(this.props.placeholderSource);
        }
        else {
            switch (react_native_1.Platform.OS) {
                case "ios":
                    /*
                    On iOS in dev mode, it takes time to download the default placeholder,
                    so we use the renderer to set transparency instead.
                    */
                    break;
                case "android":
                    placeholderSrc = (0, resolveAssetSource_1.default)(defaultPlaceholder);
                    break;
            }
        }
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
        // Create native props object.
        let nativeProps = Object.assign({}, this.props);
        nativeProps.onNativeTransformDelegateViro = transformDelegate;
        nativeProps.hasTransformDelegate =
            this.props.onTransformUpdate != undefined;
        nativeProps.materials = materials;
        nativeProps.source = imgsrc;
        nativeProps.placeholderSource = placeholderSrc;
        nativeProps.transformBehaviors = transformBehaviors;
        nativeProps.onLoadStartViro = this._onLoadStart;
        nativeProps.onLoadEndViro = this._onLoadEnd;
        nativeProps.onErrorViro = this._onError;
        nativeProps.style = [this.props.style];
        nativeProps.onHoverViro = this._onHover;
        nativeProps.onClickViro = this._onClickState;
        nativeProps.onTouchViro = this._onTouch;
        nativeProps.onScrollViro = this._onScroll;
        nativeProps.onSwipeViro = this._onSwipe;
        nativeProps.onDragViro = this._onDrag;
        nativeProps.onPinchViro = this._onPinch;
        nativeProps.onRotateViro = this._onRotate;
        nativeProps.canHover = this.props.onHover != undefined;
        nativeProps.canClick =
            this.props.onClick != undefined || this.props.onClickState != undefined;
        nativeProps.canTouch = this.props.onTouch != undefined;
        nativeProps.canScroll = this.props.onScroll != undefined;
        nativeProps.canSwipe = this.props.onSwipe != undefined;
        nativeProps.canDrag = this.props.onDrag != undefined;
        nativeProps.canFuse = this.props.onFuse != undefined;
        nativeProps.canPinch = this.props.onPinch != undefined;
        nativeProps.canRotate = this.props.onRotate != undefined;
        nativeProps.onFuseViro = this._onFuse;
        nativeProps.onAnimationStartViro = this._onAnimationStart;
        nativeProps.onAnimationFinishViro = this._onAnimationFinish;
        nativeProps.timeToFuse = timeToFuse;
        nativeProps.canCollide = this.props.onCollision != undefined;
        nativeProps.onCollisionViro = this._onCollision;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTAnimatedImage {...nativeProps}/>;
    }
}
exports.ViroAnimatedImage = ViroAnimatedImage;
var VRTAnimatedImage = (0, react_native_1.requireNativeComponent)("VRTAnimatedImage", 
// @ts-ignore
ViroAnimatedImage, {
    nativeOnly: {
        onLoadStartViro: true,
        onLoadEndViro: true,
        onErrorViro: true,
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        canFuse: true,
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
