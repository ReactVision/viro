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
exports.ViroParticleEmitter = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
class ViroParticleEmitter extends React.Component {
    state = {
        propsPositionState: this.props.position,
        nativePositionState: undefined,
    };
    _component = null;
    async getTransformAsync() {
        return await react_native_1.NativeModules.VRTNodeModule.getNodeTransform((0, react_native_1.findNodeHandle)(this));
    }
    async getBoundingBoxAsync() {
        return await react_native_1.NativeModules.VRTNodeModule.getBoundingBox((0, react_native_1.findNodeHandle)(this));
    }
    // Called from native on the event a positional change has occured
    // for the underlying control within the renderer.
    _onNativeTransformUpdate(event) {
        var position = event.nativeEvent.position;
        this.setState({
            nativePositionState: position,
        }, () => {
            if (this.props.onTransformUpdate) {
                this.props.onTransformUpdate(position);
            }
        });
    }
    // Ignore all changes in native position state as it is only required to
    // keep track of the latest position prop set on this control.
    shouldComponentUpdate(_nextProps, nextState) {
        if (nextState.nativePositionState != this.state.nativePositionState) {
            return false;
        }
        return true;
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroParticleEmitter", this.props);
        let image = { ...this.props.image };
        if (image.source != undefined) {
            image.source = (0, resolveAssetSource_1.default)(image.source);
        }
        let transformBehaviors = typeof this.props.transformBehaviors === "string"
            ? new Array(this.props.transformBehaviors)
            : this.props.transformBehaviors;
        let transformDelegate = this.props.onTransformUpdate != undefined
            ? this._onNativeTransformUpdate
            : undefined;
        // Create native props object.
        let nativeProps = Object.assign({}, this.props);
        nativeProps.position = this.state.propsPositionState;
        nativeProps.onNativeTransformDelegateViro = transformDelegate;
        nativeProps.hasTransformDelegate =
            this.props.onTransformUpdate != undefined;
        nativeProps.image = image;
        nativeProps.transformBehaviors = transformBehaviors;
        // For color modifiers, we'll need to processColor for each color value.
        if (this.props.particleAppearance && this.props.particleAppearance.color) {
            let colorModifier = this.props.particleAppearance.color;
            if (colorModifier.initialRange?.length != 2) {
                console.error("The <ViroParticleEmitter> component requires initial value of [min, max] when defining inital rotation property!");
                return;
            }
            let minColorFinal = (0, react_native_1.processColor)(colorModifier.initialRange[0]);
            let maxColorFinal = (0, react_native_1.processColor)(colorModifier.initialRange[1]);
            let modifierFinal = [];
            let interpolationLength = colorModifier.interpolation != undefined
                ? colorModifier.interpolation.length
                : 0;
            for (let i = 0; i < interpolationLength; i++) {
                let processedColor = (0, react_native_1.processColor)(colorModifier.interpolation[i].endValue);
                let mod = {
                    interval: colorModifier.interpolation[i].interval,
                    endValue: processedColor,
                };
                modifierFinal.push(mod);
            }
            let newAppearanceColorMod = {
                initialRange: [minColorFinal, maxColorFinal],
                factor: colorModifier.factor,
                interpolation: modifierFinal,
            };
            nativeProps.particleAppearance.color = newAppearanceColorMod;
        }
        // For rotation modifiers, convert degrees to radians, then apply the
        // Z rotation (due to billboarding for quad particles)
        if (this.props.particleAppearance &&
            this.props.particleAppearance.rotation) {
            let rotMod = this.props.particleAppearance.rotation;
            if (rotMod.initialRange.length !== 2) {
                console.error("The <ViroParticleEmitter> component requires initial value of [min, max] when defining inital rotation property!");
            }
            let minRotFinal = [
                0,
                0,
                (rotMod.initialRange[0] * Math.PI) / 180,
            ];
            let maxRotFinal = [
                0,
                0,
                (rotMod.initialRange[1] * Math.PI) / 180,
            ];
            let modifierFinal = [];
            let interpolationLength = rotMod.interpolation != undefined ? rotMod.interpolation.length : 0;
            for (var i = 0; i < interpolationLength; i++) {
                let processedRot = [
                    0,
                    0,
                    (rotMod.interpolation[i].endValue * Math.PI) / 180,
                ];
                let mod = {
                    interval: rotMod.interpolation[i].interval,
                    endValue: processedRot,
                };
                modifierFinal.push(mod);
            }
            let newAppearanceRotMod = {
                initialRange: [minRotFinal, maxRotFinal],
                factor: rotMod.factor,
                interpolation: modifierFinal,
            };
            nativeProps.particleAppearance.rotation = newAppearanceRotMod;
        }
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTParticleEmitter {...nativeProps}/>;
    }
    // Set the propsPositionState on the native control if the
    // nextProps.position state differs from the nativePositionState that
    // reflects this control's current vroNode position.
    static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.position &&
            nextProps.position != prevState.nativePositionState) {
            var newPosition = [
                nextProps.position[0],
                nextProps.position[1],
                nextProps.position[2],
                Math.random(),
            ];
            return {
                propsPositionState: newPosition,
            };
        }
        return {};
    }
}
exports.ViroParticleEmitter = ViroParticleEmitter;
var VRTParticleEmitter = (0, react_native_1.requireNativeComponent)("VRTParticleEmitter", 
// @ts-ignore
ViroParticleEmitter, {
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
    },
});
