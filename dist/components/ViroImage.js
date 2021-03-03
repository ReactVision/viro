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
'use strict';
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_native_1 = require("react-native");
var resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
var react_1 = __importDefault(require("react"));
var ViroProps_1 = require("./Utilities/ViroProps");
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var prop_types_1 = __importDefault(require("prop-types"));
var StyleSheet = require('react-native/Libraries/StyleSheet/StyleSheet');
var ViroImageModule = NativeModules.VRTImageModule;
var ViroPropTypes = require('./Styles/ViroPropTypes');
var StyleSheetPropType = require('react-native/Libraries/DeprecatedPropTypes/DeprecatedStyleSheetPropType');
var stylePropType = StyleSheetPropType(ViroPropTypes);
/**
 * Used to render a ViroImage
 */
var ViroImage = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        /**
         * The image file, which is required
         */
        source: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./image.jpg')
            prop_types_1.default.number,
        ]).isRequired, 
        /**
         * The position of the card
         */
        position: prop_types_1.default.arrayOf(prop_types_1.default.number), rotation: prop_types_1.default.arrayOf(prop_types_1.default.number), scale: prop_types_1.default.arrayOf(prop_types_1.default.number), scalePivot: prop_types_1.default.arrayOf(prop_types_1.default.number), rotationPivot: prop_types_1.default.arrayOf(prop_types_1.default.number), opacity: prop_types_1.default.number, width: prop_types_1.default.number, height: prop_types_1.default.number, resizeMode: prop_types_1.default.oneOf(['ScaleToFill', 'ScaleToFit', 'StretchToFill']), imageClipMode: prop_types_1.default.oneOf(['None', 'ClipToBounds']), stereoMode: prop_types_1.default.oneOf(['LeftRight', 'RightLeft', 'TopBottom', 'BottomTop', 'None']), materials: prop_types_1.default.oneOfType([
            prop_types_1.default.arrayOf(prop_types_1.default.string),
            prop_types_1.default.string
        ]), animation: prop_types_1.default.shape({
            name: prop_types_1.default.string,
            delay: prop_types_1.default.number,
            loop: prop_types_1.default.bool,
            onStart: prop_types_1.default.func,
            onFinish: prop_types_1.default.func,
            run: prop_types_1.default.bool,
            allowInterruptable: prop_types_1.default.bool,
        }), transformBehaviors: prop_types_1.default.oneOfType([
            prop_types_1.default.arrayOf(prop_types_1.default.string),
            prop_types_1.default.string
        ]), highAccuracyEvents: prop_types_1.default.bool, lightReceivingBitMask: prop_types_1.default.number, shadowCastingBitMask: prop_types_1.default.number, onTransformUpdate: prop_types_1.default.func, renderingOrder: prop_types_1.default.number, visible: prop_types_1.default.bool, style: stylePropType, 
        // Required to be local source static image by using require(''./image.jpg').
        // or by specifying local uri.
        // If not set, the image will be transparent until the source is downloaded
        placeholderSource: prop_types_1.default.oneOfType([
            // TODO: Tooling to support documenting these directly and having them display in the docs.
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            prop_types_1.default.number,
        ]), 
        // DEPRECATION WARNING: DO NOT USE THE FOLLOWING PROP!
        placeHolderSource: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            prop_types_1.default.number,
        ]), mipmap: prop_types_1.default.bool, format: prop_types_1.default.oneOf(['RGBA8', 'RGB565']), ignoreEventHandling: prop_types_1.default.bool, dragType: prop_types_1.default.oneOf(["FixedDistance", "FixedDistanceOrigin", "FixedToWorld", "FixedToPlane"]), dragPlane: prop_types_1.default.shape({
            planePoint: prop_types_1.default.arrayOf(prop_types_1.default.number),
            planeNormal: prop_types_1.default.arrayOf(prop_types_1.default.number),
            maxDistance: prop_types_1.default.number
        }), onHover: prop_types_1.default.func, onClick: prop_types_1.default.func, onClickState: prop_types_1.default.func, onTouch: prop_types_1.default.func, onScroll: prop_types_1.default.func, onSwipe: prop_types_1.default.func, onDrag: prop_types_1.default.func, onPinch: prop_types_1.default.func, onRotate: prop_types_1.default.func, onFuse: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                callback: prop_types_1.default.func.isRequired,
                timeToFuse: prop_types_1.default.number
            }),
            prop_types_1.default.func
        ]), 
        /**
         * Callback triggered when we are processing the assets to be
         * displayed in this ViroImage (either downloading / reading from file).
         */
        onLoadStart: prop_types_1.default.func, 
        /**
         * Callback triggered when we have finished processing assets to be
         * displayed. Wether or not assets were processed successfully and
         * thus displayed will be indicated by the parameter "success".
         * For example:
         *
         *   _onLoadEnd(event:Event){
         *      // Indication of asset loading success
         *      event.nativeEvent.success
         *   }
         *
         */
        onLoadEnd: prop_types_1.default.func, 
        /**
         * Callback triggered when the image fails to load. Invoked with
         * {nativeEvent: {error}}
         */
        onError: prop_types_1.default.func, physicsBody: prop_types_1.default.shape({
            type: prop_types_1.default.oneOf(['Dynamic', 'Kinematic', 'Static']).isRequired,
            mass: prop_types_1.default.number,
            restitution: prop_types_1.default.number,
            shape: prop_types_1.default.shape({
                type: prop_types_1.default.oneOf(["Box", "Sphere", "Compound"]).isRequired,
                params: prop_types_1.default.arrayOf(prop_types_1.default.number)
            }),
            friction: prop_types_1.default.number,
            useGravity: prop_types_1.default.bool,
            enabled: prop_types_1.default.bool,
            velocity: prop_types_1.default.arrayOf(prop_types_1.default.number),
            force: prop_types_1.default.oneOfType([
                prop_types_1.default.arrayOf(prop_types_1.default.shape({
                    value: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    position: prop_types_1.default.arrayOf(prop_types_1.default.number)
                })),
                prop_types_1.default.shape({
                    value: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    position: prop_types_1.default.arrayOf(prop_types_1.default.number)
                }),
            ]),
            torque: prop_types_1.default.arrayOf(prop_types_1.default.number)
        }), viroTag: prop_types_1.default.string, onCollision: prop_types_1.default.func }),
    _onLoadStart: function (event /*: Event*/) {
        this.props.onLoadStart && this.props.onLoadStart(event);
    },
    _onLoadEnd: function (event /*: Event*/) {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    },
    _onError: function (event /*: Event*/) {
        this.props.onError && this.props.onError(event);
    },
    _onHover: function (event /*: Event*/) {
        this.props.onHover && this.props.onHover(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
    },
    _onClick: function (event /*: Event*/) {
        this.props.onClick && this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
    },
    _onClickState: function (event /*: Event*/) {
        this.props.onClickState && this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
        var CLICKED = 3; // Value representation of Clicked ClickState within EventDelegateJni.
        if (event.nativeEvent.clickState == CLICKED) {
            this._onClick(event);
        }
    },
    _onTouch: function (event /*: Event*/) {
        this.props.onTouch && this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
    },
    _onScroll: function (event /*: Event*/) {
        this.props.onScroll && this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
    },
    _onSwipe: function (event /*: Event*/) {
        this.props.onSwipe && this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
    },
    _onDrag: function (event /*: Event*/) {
        this.props.onDrag
            && this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
    },
    _onPinch: function (event /*: Event*/) {
        this.props.onPinch && this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
    },
    _onRotate: function (event /*: Event*/) {
        this.props.onRotate && this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
    },
    _onFuse: function (event /*: Event*/) {
        if (this.props.onFuse) {
            if (typeof this.props.onFuse === 'function') {
                this.props.onFuse(event.nativeEvent.source);
            }
            else if (this.props.onFuse != undefined && this.props.onFuse.callback != undefined) {
                this.props.onFuse.callback(event.nativeEvent.source);
            }
        }
    },
    _onAnimationStart: function (event /*: Event*/) {
        this.props.animation && this.props.animation.onStart && this.props.animation.onStart();
    },
    _onAnimationFinish: function (event /*: Event*/) {
        this.props.animation && this.props.animation.onFinish && this.props.animation.onFinish();
    },
    getTransformAsync: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, NativeModules.VRTNodeModule.getNodeTransform(react_native_1.findNodeHandle(this))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    getBoundingBoxAsync: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, NativeModules.VRTNodeModule.getBoundingBox(react_native_1.findNodeHandle(this))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    applyImpulse: function (force, position) {
        NativeModules.VRTNodeModule.applyImpulse(react_native_1.findNodeHandle(this), force, position);
    },
    applyTorqueImpulse: function (torque) {
        NativeModules.VRTNodeModule.applyTorqueImpulse(react_native_1.findNodeHandle(this), torque);
    },
    setVelocity: function (velocity) {
        NativeModules.VRTNodeModule.setVelocity(react_native_1.findNodeHandle(this), velocity);
    },
    _onCollision: function (event /*: Event*/) {
        if (this.props.onCollision) {
            this.props.onCollision(event.nativeEvent.viroTag, event.nativeEvent.collidedPoint, event.nativeEvent.collidedNormal);
        }
    },
    // Called from native on the event a positional change has occured
    // for the underlying control within the renderer.
    _onNativeTransformUpdate: function (event /*: Event*/) {
        var position = event.nativeEvent.position;
        if (this.props.onTransformUpdate) {
            this.props.onTransformUpdate(position);
        }
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroImage", this.props);
        var defaultPlaceholder = require('./Resources/viro_blank.png');
        var imgsrc = resolveAssetSource_1.default(this.props.source);
        var placeholderSrc;
        if (this.props.placeholderSource) {
            placeholderSrc = resolveAssetSource_1.default(this.props.placeholderSource);
        }
        else {
            switch (react_native_1.Platform.OS) {
                case 'ios':
                    /*
                     On iOS in dev mode, it takes time to download the default placeholder,
                     so we use the renderer to set transparency instead.
                     */
                    break;
                case 'android':
                    placeholderSrc = resolveAssetSource_1.default(defaultPlaceholder);
                    break;
            }
        }
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        var materials = typeof this.props.materials === 'string' ? new Array(this.props.materials) : this.props.materials;
        var transformBehaviors = typeof this.props.transformBehaviors === 'string' ?
            new Array(this.props.transformBehaviors) : this.props.transformBehaviors;
        var timeToFuse = undefined;
        if (this.props.onFuse != undefined && typeof this.props.onFuse === 'object') {
            timeToFuse = this.props.onFuse.timeToFuse;
        }
        var transformDelegate = this.props.onTransformUpdate != undefined ? this._onNativeTransformUpdate : undefined;
        // Create native props object.
        var nativeProps = Object.assign({}, this.props);
        nativeProps.onNativeTransformDelegateViro = transformDelegate;
        nativeProps.hasTransformDelegate = this.props.onTransformUpdate != undefined;
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
        nativeProps.canClick = this.props.onClick != undefined || this.props.onClickState != undefined;
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
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTImage {...nativeProps}/>);
    }
});
var VRTImage = react_native_1.requireNativeComponent('VRTImage', ViroImage, {
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
        onAnimationFinishViro: true
    }
});
// Used to evict a given imageSource from the cache. This is Android-only
// because the Fresco (RN's Image caching library) caches images by their
// uri's. If you replace 1 image with another, then the first image will
// be cached if they have the same imageSource.
ViroImage.evictFromCache = function (imageSource) {
    if (react_native_1.Platform.OS == 'android') {
        var image = resolveAssetSource_1.default(imageSource);
        ViroImageModule.evictFromCache(image);
    }
},
    module.exports = ViroImage;
