/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSpatialSound
 * @flow
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSpatialSound = void 0;
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const react_1 = __importDefault(require("react"));
const ViroProps_1 = require("./Utilities/ViroProps");
var NativeModules = require("react-native").NativeModules;
class ViroSpatialSound extends react_1.default.Component {
    _component = null;
    _onFinish(event) {
        this.props.onFinish && this.props.onFinish(event);
    }
    _onError(event) {
        this.props.onError && this.props.onError(event);
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroSpatialSound", this.props);
        var soundSrc = this.props.source;
        if (typeof soundSrc === "number") {
            soundSrc = (0, resolveAssetSource_1.default)(soundSrc);
        }
        else if (typeof soundSrc === "string") {
            /**
             * @todo
             *
             * This throws a typescript error:
             * Type '{ name: never; }' is not assignable to type 'ImageSourcePropType'.
             * Object literal may only specify known properties, and 'name' does not
             * exist in type 'ImageURISource | ImageURISource[]'.
             *
             * I assume that this works correctly for Viro, but we would need to standardize
             * this or remove this usage. The usage should be {uri: string} or require format
             * to be consistent with images/video.
             */
            soundSrc = { name: soundSrc };
        }
        let nativeProps = Object.assign({}, this.props);
        nativeProps.source = soundSrc;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTSpatialSound {...nativeProps}/>;
    }
    async getTransformAsync() {
        return await NativeModules.VRTNodeModule.getNodeTransform((0, react_native_1.findNodeHandle)(this));
    }
    async getBoundingBoxAsync() {
        return await NativeModules.VRTNodeModule.getBoundingBox((0, react_native_1.findNodeHandle)(this));
    }
    seekToTime(timeInSeconds) {
        switch (react_native_1.Platform.OS) {
            case "ios":
                NativeModules.VRTSpatialSoundManager.seekToTime((0, react_native_1.findNodeHandle)(this), timeInSeconds);
                break;
            case "android":
                NativeModules.UIManager.dispatchViewManagerCommand((0, react_native_1.findNodeHandle)(this), NativeModules.UIManager.VRTSpatialSound.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    }
}
exports.ViroSpatialSound = ViroSpatialSound;
var VRTSpatialSound = (0, react_native_1.requireNativeComponent)("VRTSpatialSound", 
// @ts-ignore
ViroSpatialSound, {
    nativeOnly: {
        onFinishViro: true,
        onErrorViro: true,
    },
});
