/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Viro360Video
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
exports.Viro360Video = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
var NativeModules = require("react-native").NativeModules;
/**
 * Used to render a 360 video on the background sphere.
 */
class Viro360Video extends React.Component {
    _component = null;
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
        (0, ViroProps_1.checkMisnamedProps)("Viro360Video", this.props);
        var vidsrc = (0, resolveAssetSource_1.default)(this.props.source);
        let nativeProps = Object.assign({}, this.props);
        nativeProps.source = vidsrc;
        nativeProps.onBufferStartViro = this._onBufferStart;
        nativeProps.onBufferEndViro = this._onBufferEnd;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onUpdateTimeViro = this._onUpdateTime;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRO360Video {...nativeProps}/>;
    }
    seekToTime = (timeInSeconds) => {
        switch (react_native_1.Platform.OS) {
            case "ios":
                NativeModules.VRT360VideoManager.seekToTime((0, react_native_1.findNodeHandle)(this), timeInSeconds);
                break;
            case "android":
                NativeModules.UIManager.dispatchViewManagerCommand((0, react_native_1.findNodeHandle)(this), NativeModules.UIManager.VRT360Video.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    };
}
exports.Viro360Video = Viro360Video;
var VRO360Video = (0, react_native_1.requireNativeComponent)("VRT360Video", 
// @ts-ignore
Viro360Video, {
    nativeOnly: {
        onBufferStartViro: true,
        onBufferEndViro: true,
        onUpdateTimeViro: true,
        onErrorViro: true,
        onFinishViro: true,
    },
});
