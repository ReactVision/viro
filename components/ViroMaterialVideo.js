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
exports.ViroMaterialVideo = void 0;
/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
class ViroMaterialVideo extends React.Component {
    _component = null;
    componentWillUnmount() {
        // pause the current video texture on Android since java gc will release when it feels like it.
        if (react_native_1.Platform.OS == "android") {
            react_native_1.NativeModules.UIManager.dispatchViewManagerCommand((0, react_native_1.findNodeHandle)(this), react_native_1.NativeModules.UIManager.VRTMaterialVideo.Commands.pause, [0]);
        }
    }
    _onBufferStart = (event) => {
        this.props.onBufferStart && this.props.onBufferStart(event);
    };
    _onBufferEnd = (event) => {
        this.props.onBufferEnd && this.props.onBufferEnd(event);
    };
    _onFinish = () => {
        this.props.onFinish && this.props.onFinish();
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    _onUpdateTime = (event) => {
        this.props.onUpdateTime &&
            this.props.onUpdateTime(event.nativeEvent.currentTime, event.nativeEvent.totalTime);
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
    render() {
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        //let materials = typeof this.props.materials === 'string' ? new Array(this.props.materials) : this.props.materials;
        let nativeProps = Object.assign({}, this.props);
        //nativeProps.materials = materials;
        nativeProps.onBufferStartViro = this._onBufferStart;
        nativeProps.onBufferEndViro = this._onBufferEnd;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onUpdateTimeViro = this._onUpdateTime;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTMaterialVideo {...nativeProps}/>;
    }
    seekToTime = (timeInSeconds) => {
        switch (react_native_1.Platform.OS) {
            case "ios":
                react_native_1.NativeModules.VRTMaterialVideoManager.seekToTime((0, react_native_1.findNodeHandle)(this), timeInSeconds);
                break;
            case "android":
                react_native_1.NativeModules.UIManager.dispatchViewManagerCommand((0, react_native_1.findNodeHandle)(this), react_native_1.NativeModules.UIManager.VRTMaterialVideo.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    };
}
exports.ViroMaterialVideo = ViroMaterialVideo;
var VRTMaterialVideo = (0, react_native_1.requireNativeComponent)("VRTMaterialVideo", 
// @ts-ignore
ViroMaterialVideo, {
    nativeOnly: {
        onBufferStartViro: true,
        onBufferEndViro: true,
        onUpdateTimeViro: true,
        onFinishViro: true,
        onErrorViro: true,
    },
});
