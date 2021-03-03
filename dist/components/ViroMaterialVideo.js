"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
var react_native_1 = require("react-native");
var react_1 = __importDefault(require("react"));
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var prop_types_1 = __importDefault(require("prop-types"));
var ViroMaterialVideo = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { material: prop_types_1.default.string, paused: prop_types_1.default.bool, loop: prop_types_1.default.bool, muted: prop_types_1.default.bool, volume: prop_types_1.default.number, 
        /**
         * Callback invoked when the underlying video component begins buffering. Called at
         * least once at the beginning of playback/video creation.
         */
        onBufferStart: prop_types_1.default.func, 
        /**
         * Callback invoked when the underlying video component has finished buffering.
         */
        onBufferEnd: prop_types_1.default.func, 
        /**
         * Callback that is called when the video is finished playing. This
         * function isn't called at the end of a video if looping is enabled.
         */
        onFinish: prop_types_1.default.func, 
        /**
          * Callback that is called when the current playback position has changed.
          * This is called in the form:
          *     onUpdateTime(currentPlaybackTimeInSeconds, totalPlayBackDurationInSeconds);
          */
        onUpdateTime: prop_types_1.default.func, 
        /**
         * Callback triggered when the video fails to load. Invoked with
         * {nativeEvent: {error}}
         */
        onError: prop_types_1.default.func }),
    componentWillUnmount: function () {
        // pause the current video texture on Android since java gc will release when it feels like it.
        if (react_native_1.Platform.OS == 'android') {
            NativeModules.UIManager.dispatchViewManagerCommand(react_native_1.findNodeHandle(this), NativeModules.UIManager.VRTMaterialVideo.Commands.pause, [0]);
        }
    },
    _onBufferStart: function (event /*: Event*/) {
        this.props.onBufferStart && this.props.onBufferStart(event);
    },
    _onBufferEnd: function (event /*: Event*/) {
        this.props.onBufferEnd && this.props.onBufferEnd(event);
    },
    _onFinish: function () {
        this.props.onFinish && this.props.onFinish();
    },
    _onError: function (event /*: Event*/) {
        this.props.onError && this.props.onError(event);
    },
    _onUpdateTime: function (event /*: Event*/) {
        this.props.onUpdateTime && this.props.onUpdateTime(event.nativeEvent.currentTime, event.nativeEvent.totalTime);
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        //let materials = typeof this.props.materials === 'string' ? new Array(this.props.materials) : this.props.materials;
        var _this = this;
        var nativeProps = Object.assign({}, this.props);
        //nativeProps.materials = materials;
        nativeProps.onBufferStartViro = this._onBufferStart;
        nativeProps.onBufferEndViro = this._onBufferEnd;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onUpdateTimeViro = this._onUpdateTime;
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTMaterialVideo {...nativeProps}/>);
    },
    seekToTime: function (timeInSeconds) {
        switch (react_native_1.Platform.OS) {
            case 'ios':
                NativeModules.VRTMaterialVideoManager.seekToTime(react_native_1.findNodeHandle(this), timeInSeconds);
                break;
            case 'android':
                NativeModules.UIManager.dispatchViewManagerCommand(react_native_1.findNodeHandle(this), NativeModules.UIManager.VRTMaterialVideo.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    },
});
var VRTMaterialVideo = react_native_1.requireNativeComponent('VRTMaterialVideo', ViroMaterialVideo, {
    nativeOnly: {
        onBufferStartViro: true,
        onBufferEndViro: true,
        onUpdateTimeViro: true,
        onFinishViro: true,
        onErrorViro: true,
    }
});
module.exports = ViroMaterialVideo;
