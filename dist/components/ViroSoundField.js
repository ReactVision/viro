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
var resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
var react_1 = __importDefault(require("react"));
var prop_types_1 = __importDefault(require("prop-types"));
var ViroProps_1 = require("./Utilities/ViroProps");
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var ViroSoundField = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        // Source can either be a String referencing a preloaded file, a web uri, or a
        // local js file (using require())
        source: prop_types_1.default.oneOfType([
            prop_types_1.default.string,
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./sound.mp3')
            prop_types_1.default.number,
        ]).isRequired, paused: prop_types_1.default.bool, loop: prop_types_1.default.bool, muted: prop_types_1.default.bool, volume: prop_types_1.default.number, rotation: prop_types_1.default.arrayOf(prop_types_1.default.number), onFinish: prop_types_1.default.func, onError: prop_types_1.default.func }),
    _onFinish: function (event /*: Event*/) {
        this.props.onFinish && this.props.onFinish(event);
    },
    _onError: function (event /*: Event*/) {
        this.props.onError && this.props.onError(event);
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroSoundField", this.props);
        var soundSrc = this.props.source;
        if (typeof soundSrc === 'number') {
            soundSrc = resolveAssetSource_1.default(soundSrc);
        }
        else if (typeof soundSrc === 'string') {
            soundSrc = { name: soundSrc };
        }
        var nativeProps = Object.assign({}, this.props);
        nativeProps.source = soundSrc;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTSoundField {...nativeProps}/>);
    },
    seekToTime: function (timeInSeconds) {
        switch (react_native_1.Platform.OS) {
            case 'ios':
                NativeModules.VRTSoundFieldManager.seekToTime(react_native_1.findNodeHandle(this), timeInSeconds);
                break;
            case 'android':
                NativeModules.UIManager.dispatchViewManagerCommand(react_native_1.findNodeHandle(this), NativeModules.UIManager.VRTSoundField.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    },
});
var VRTSound = require('./ViroSound').VRTSound;
var VRTSoundField = react_native_1.requireNativeComponent('VRTSoundField', ViroSoundField, {
    nativeOnly: {
        onFinishViro: true,
        onErrorViro: true,
    }
});
module.exports = ViroSoundField;
