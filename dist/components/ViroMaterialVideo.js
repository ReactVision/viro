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
const ViroPlatform_1 = require("./Utilities/ViroPlatform");
const ViroUnsupported_1 = require("./Utilities/ViroUnsupported");
class ViroMaterialVideo extends React.Component {
    _component = null;
    componentWillUnmount() {
        // Pause the video texture on unmount to prevent memory leaks
        // Both Android and iOS need explicit pause since GC may not release immediately
        const nodeHandle = (0, react_native_1.findNodeHandle)(this);
        if (nodeHandle) {
            if (react_native_1.Platform.OS === "android") {
                react_native_1.NativeModules.UIManager.dispatchViewManagerCommand(nodeHandle, react_native_1.NativeModules.UIManager.VRTMaterialVideo.Commands.pause, [0]);
            }
            else if (react_native_1.Platform.OS === "ios") {
                // Also pause on iOS to ensure video resources are released
                react_native_1.NativeModules.VRTMaterialVideoManager?.pause?.(nodeHandle);
            }
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
        // ViroMaterialVideo's view manager is excluded from the visionOS renderer, so React has no view
        // config for it and mounting fails with "View config not found".
        if (ViroPlatform_1.isVisionOS) {
            (0, ViroUnsupported_1.warnUnsupported)("ViroMaterialVideo", "Apple Vision Pro", "Video textures are not part of the visionOS renderer.");
            return null;
        }
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
