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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_native_1 = require("react-native");
var react_1 = __importDefault(require("react"));
var resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
var ViroProps_1 = require("./Utilities/ViroProps");
var prop_types_1 = __importDefault(require("prop-types"));
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
/**
 * Used to render a 360 video on the background sphere.
 */
var Viro360Video = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        /**
         * The video uri to play
         */
        source: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./test_video.mp4')
            prop_types_1.default.number,
        ]).isRequired, rotation: prop_types_1.default.arrayOf(prop_types_1.default.number), paused: prop_types_1.default.bool, loop: prop_types_1.default.bool, muted: prop_types_1.default.bool, volume: prop_types_1.default.number, 
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
        onError: prop_types_1.default.func, stereoMode: prop_types_1.default.oneOf(['LeftRight', 'RightLeft', 'TopBottom', 'BottomTop', 'None']) }),
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
        var _this = this;
        ViroProps_1.checkMisnamedProps("Viro360Video", this.props);
        var vidsrc = resolveAssetSource_1.default(this.props.source);
        var nativeProps = Object.assign({}, this.props);
        nativeProps.source = vidsrc;
        nativeProps.onBufferStartViro = this._onBufferStart;
        nativeProps.onBufferEndViro = this._onBufferEnd;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onUpdateTimeViro = this._onUpdateTime;
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRO360Video {...nativeProps}/>);
    },
    seekToTime: function (timeInSeconds) {
        switch (react_native_1.Platform.OS) {
            case 'ios':
                NativeModules.VRT360VideoManager.seekToTime(react_native_1.findNodeHandle(this), timeInSeconds);
                break;
            case 'android':
                NativeModules.UIManager.dispatchViewManagerCommand(react_native_1.findNodeHandle(this), NativeModules.UIManager.VRT360Video.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    },
});
var VRO360Video = react_native_1.requireNativeComponent('VRT360Video', Viro360Video, {
    nativeOnly: {
        onBufferStartViro: true,
        onBufferEndViro: true,
        onUpdateTimeViro: true,
        onErrorViro: true,
        onFinishViro: true
    }
});
module.exports = Viro360Video;
