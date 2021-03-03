/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroParticleEmitter
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
var react_1 = __importDefault(require("react"));
var resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
var ViroProps_1 = require("./Utilities/ViroProps");
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var prop_types_1 = __importDefault(require("prop-types"));
var StyleSheet = require('react-native/Libraries/StyleSheet/StyleSheet');
var ViroPropTypes = require('./Styles/ViroPropTypes');
var StyleSheetPropType = require('react-native/Libraries/DeprecatedPropTypes/DeprecatedStyleSheetPropType');
var stylePropType = StyleSheetPropType(ViroPropTypes);
var ColorPropType = require('react-native').ColorPropType;
var processColor = require('react-native').processColor;
var ViroParticleEmitter = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { position: prop_types_1.default.arrayOf(prop_types_1.default.number), rotation: prop_types_1.default.arrayOf(prop_types_1.default.number), scale: prop_types_1.default.arrayOf(prop_types_1.default.number), scalePivot: prop_types_1.default.arrayOf(prop_types_1.default.number), rotationPivot: prop_types_1.default.arrayOf(prop_types_1.default.number), onTransformUpdate: prop_types_1.default.func, renderingOrder: prop_types_1.default.number, visible: prop_types_1.default.bool, viroTag: prop_types_1.default.string, transformBehaviors: prop_types_1.default.oneOfType([
            prop_types_1.default.arrayOf(prop_types_1.default.string),
            prop_types_1.default.string
        ]), highAccuracyEvents: prop_types_1.default.bool, duration: prop_types_1.default.number, delay: prop_types_1.default.number, loop: prop_types_1.default.bool, run: prop_types_1.default.bool, fixedToEmitter: prop_types_1.default.bool, image: prop_types_1.default.shape({
            source: prop_types_1.default.oneOfType([
                prop_types_1.default.shape({
                    uri: prop_types_1.default.string,
                }),
                prop_types_1.default.number
            ]).isRequired,
            height: prop_types_1.default.number,
            width: prop_types_1.default.number,
            bloomThreshold: prop_types_1.default.number,
            blendMode: prop_types_1.default.string,
        }).isRequired, spawnBehavior: prop_types_1.default.shape({
            emissionRatePerSecond: prop_types_1.default.arrayOf(prop_types_1.default.number),
            emissionRatePerMeter: prop_types_1.default.arrayOf(prop_types_1.default.number),
            particleLifetime: prop_types_1.default.arrayOf(prop_types_1.default.number),
            maxParticles: prop_types_1.default.number,
            emissionBurst: prop_types_1.default.arrayOf(prop_types_1.default.oneOfType([
                prop_types_1.default.shape({
                    time: prop_types_1.default.number,
                    min: prop_types_1.default.number,
                    max: prop_types_1.default.number,
                    cycles: prop_types_1.default.number,
                    cooldownPeriod: prop_types_1.default.number,
                }),
                prop_types_1.default.shape({
                    distance: prop_types_1.default.number,
                    min: prop_types_1.default.number,
                    max: prop_types_1.default.number,
                    cycles: prop_types_1.default.number,
                    cooldownDistance: prop_types_1.default.number,
                }),
            ])),
            spawnVolume: prop_types_1.default.shape({
                shape: prop_types_1.default.string,
                params: prop_types_1.default.arrayOf(prop_types_1.default.number),
                spawnOnSurface: prop_types_1.default.bool
            }),
        }), particleAppearance: prop_types_1.default.shape({
            opacity: prop_types_1.default.shape({
                initialRange: prop_types_1.default.arrayOf(prop_types_1.default.number),
                factor: prop_types_1.default.oneOf(["Time", "Distance"]),
                interpolation: prop_types_1.default.arrayOf(prop_types_1.default.shape({
                    interval: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    endValue: prop_types_1.default.number,
                })),
            }),
            scale: prop_types_1.default.shape({
                initialRange: prop_types_1.default.arrayOf(prop_types_1.default.arrayOf(prop_types_1.default.number)),
                factor: prop_types_1.default.oneOf(["Time", "Distance"]),
                interpolation: prop_types_1.default.arrayOf(prop_types_1.default.shape({
                    interval: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    endValue: prop_types_1.default.arrayOf(prop_types_1.default.number),
                })),
            }),
            // rotation is only about the Z axis
            rotation: prop_types_1.default.shape({
                initialRange: prop_types_1.default.arrayOf(prop_types_1.default.number),
                factor: prop_types_1.default.oneOf(["Time", "Distance"]),
                interpolation: prop_types_1.default.arrayOf(prop_types_1.default.shape({
                    interval: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    endValue: prop_types_1.default.number,
                })),
            }),
            color: prop_types_1.default.shape({
                initialRange: prop_types_1.default.arrayOf(ColorPropType),
                factor: prop_types_1.default.oneOf(["Time", "Distance"]),
                interpolation: prop_types_1.default.arrayOf(prop_types_1.default.shape({
                    interval: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    endValue: ColorPropType,
                })),
            }),
        }), particlePhysics: prop_types_1.default.shape({
            velocity: prop_types_1.default.shape({
                initialRange: prop_types_1.default.arrayOf(prop_types_1.default.arrayOf(prop_types_1.default.number)),
            }),
            acceleration: prop_types_1.default.shape({
                initialRange: prop_types_1.default.arrayOf(prop_types_1.default.arrayOf(prop_types_1.default.number)),
            }),
            explosiveImpulse: prop_types_1.default.shape({
                impulse: prop_types_1.default.number,
                position: prop_types_1.default.arrayOf(prop_types_1.default.number),
                decelerationPeriod: prop_types_1.default.number,
            }),
        }) }),
    getInitialState: function () {
        return {
            propsPositionState: this.props.position,
            nativePositionState: undefined
        };
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
    // Called from native on the event a positional change has occured
    // for the underlying control within the renderer.
    _onNativeTransformUpdate: function (event /*: Event*/) {
        var _this = this;
        var position = event.nativeEvent.position;
        this.setState({
            nativePositionState: position
        }, function () {
            if (_this.props.onTransformUpdate) {
                _this.props.onTransformUpdate(position);
            }
        });
    },
    // Ignore all changes in native position state as it is only required to
    // keep track of the latest position prop set on this control.
    shouldComponentUpdate: function (nextProps, nextState) {
        if (nextState.nativePositionState != this.state.nativePositionState) {
            return false;
        }
        return true;
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroParticleEmitter", this.props);
        var image = __assign({}, this.props.image);
        if (image.source != undefined) {
            image.source = resolveAssetSource_1.default(image.source);
        }
        var transformBehaviors = typeof this.props.transformBehaviors === 'string' ?
            new Array(this.props.transformBehaviors) : this.props.transformBehaviors;
        var transformDelegate = this.props.onTransformUpdate != undefined ? this._onNativeTransformUpdate : undefined;
        // Create native props object.
        var nativeProps = Object.assign({}, this.props);
        nativeProps.position = this.state.propsPositionState;
        nativeProps.onNativeTransformDelegateViro = transformDelegate;
        nativeProps.hasTransformDelegate = this.props.onTransformUpdate != undefined;
        nativeProps.image = image;
        nativeProps.transformBehaviors = transformBehaviors;
        // For color modifiers, we'll need to processColor for each color value.
        if (this.props.particleAppearance && this.props.particleAppearance.color) {
            var colorModifier = this.props.particleAppearance.color;
            if (colorModifier.initialRange.length != 2) {
                console.error('The <ViroParticleEmitter> component requires initial value of [min, max] when defining inital rotation property!');
                return;
            }
            var minColorFinal = processColor(colorModifier.initialRange[0]);
            var maxColorFinal = processColor(colorModifier.initialRange[1]);
            var modifierFinal = [];
            var interpolationLength = colorModifier.interpolation != undefined ? colorModifier.interpolation.length : 0;
            for (var i_1 = 0; i_1 < interpolationLength; i_1++) {
                var processedColor = processColor(colorModifier.interpolation[i_1].endValue);
                var mod = {
                    interval: colorModifier.interpolation[i_1].interval,
                    endValue: processedColor
                };
                modifierFinal.push(mod);
            }
            var newAppearanceColorMod = {
                initialRange: [minColorFinal, maxColorFinal],
                factor: colorModifier.factor,
                interpolation: modifierFinal
            };
            nativeProps.particleAppearance.color = newAppearanceColorMod;
        }
        // For rotation modifiers, convert degrees to radians, then apply the
        // Z rotation (due to billboarding for quad particles)
        if (this.props.particleAppearance && this.props.particleAppearance.rotation) {
            var rotMod = this.props.particleAppearance.rotation;
            if (rotMod.initialRange.length != 2) {
                console.error('The <ViroParticleEmitter> component requires initial value of [min, max] when defining inital rotation property!');
            }
            var minRotFinal = [0, 0, rotMod.initialRange[0] * Math.PI / 180];
            var maxRotFinal = [0, 0, rotMod.initialRange[1] * Math.PI / 180];
            var modifierFinal = [];
            var interpolationLength = rotMod.interpolation != undefined ? rotMod.interpolation.length : 0;
            for (var i = 0; i < interpolationLength; i++) {
                var processedRot = [0, 0, rotMod.interpolation[i].endValue * Math.PI / 180];
                var mod = {
                    interval: rotMod.interpolation[i].interval,
                    endValue: processedRot
                };
                modifierFinal.push(mod);
            }
            var newAppearanceRotMod = {
                initialRange: [minRotFinal, maxRotFinal],
                factor: rotMod.factor,
                interpolation: modifierFinal
            };
            nativeProps.particleAppearance.rotation = newAppearanceRotMod;
        }
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTParticleEmitter {...nativeProps}/>);
    },
    // Set the propsPositionState on the native control if the
    // nextProps.position state differs from the nativePositionState that
    // reflects this control's current vroNode position.
    statics: {
        getDerivedStateFromProps: function (nextProps, prevState) {
            if (nextProps.position != prevState.nativePositionState) {
                var newPosition = [nextProps.position[0], nextProps.position[1], nextProps.position[2], Math.random()];
                return {
                    propsPositionState: newPosition
                };
            }
            return {};
        }
    },
});
var VRTParticleEmitter = react_native_1.requireNativeComponent('VRTParticleEmitter', ViroParticleEmitter, {
    nativeOnly: {
        onNativeTransformDelegateViro: true,
        hasTransformDelegate: true,
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        canFuse: true,
        canCollide: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onPlatformUpdateViro: true,
        onFuseViro: true,
        timeToFuse: true,
        physicsBody: true,
        onCollisionViro: true,
        animation: true,
        materials: true,
        dragType: true,
        dragPlane: true,
        ignoreEventHandling: true,
    }
});
module.exports = ViroParticleEmitter;
