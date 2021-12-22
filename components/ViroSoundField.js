/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSoundField
 * @flow
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSoundField = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
class ViroSoundField extends react_1.default.Component {
    constructor() {
        super(...arguments);
        this._component = null;
    }
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
        ViroProps_1.checkMisnamedProps("ViroSoundField", this.props);
        var soundSrc = this.props.source;
        if (typeof soundSrc === "number") {
            soundSrc = resolveAssetSource_1.default(soundSrc);
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
        return <VRTSoundField {...nativeProps}/>;
    }
    seekToTime(timeInSeconds) {
        switch (react_native_1.Platform.OS) {
            case "ios":
                react_native_1.NativeModules.VRTSoundFieldManager.seekToTime(react_native_1.findNodeHandle(this), timeInSeconds);
                break;
            case "android":
                react_native_1.NativeModules.UIManager.dispatchViewManagerCommand(react_native_1.findNodeHandle(this), react_native_1.NativeModules.UIManager.VRTSoundField.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    }
}
exports.ViroSoundField = ViroSoundField;
var VRTSoundField = react_native_1.requireNativeComponent("VRTSoundField", 
// @ts-ignore
ViroSoundField, {
    nativeOnly: {
        onFinishViro: true,
        onErrorViro: true,
    },
});
