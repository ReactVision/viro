/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroImage
 * @flow
 */
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroImage = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
const ViroBase_1 = require("./ViroBase");
const ViroImageModule = react_native_1.NativeModules.VRTImageModule;
/**
 * Used to render a ViroImage
 */
class ViroImage extends ViroBase_1.ViroBase {
    _onLoadStart = (event) => {
        this.props.onLoadStart && this.props.onLoadStart(event);
    };
    _onLoadEnd = (event) => {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    };
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroImage", this.props);
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
        nativeProps.placeHolderSource = placeholderSrc;
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
        return <VRTImage {...nativeProps}/>;
    }
    // Used to evict a given imageSource from the cache. This is Android-only
    // because the Fresco (RN's Image caching library) caches images by their
    // uri's. If you replace 1 image with another, then the first image will
    // be cached if they have the same imageSource.
    static evictFromCache = (imageSource) => {
        if (react_native_1.Platform.OS == "android") {
            var image = (0, resolveAssetSource_1.default)(imageSource);
            ViroImageModule.evictFromCache(image);
        }
    };
}
exports.ViroImage = ViroImage;
var VRTImage = (0, react_native_1.requireNativeComponent)("VRTImage", 
// @ts-ignore
ViroImage, {
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
