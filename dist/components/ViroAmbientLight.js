/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroAmbientLight
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
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var prop_types_1 = __importDefault(require("prop-types"));
var ColorPropType = require('react-native').ColorPropType;
/**
 * Used to render a ViroAmbientLight
 */
var ViroAmbientLight = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { color: ColorPropType, intensity: prop_types_1.default.number, temperature: prop_types_1.default.number, influenceBitMask: prop_types_1.default.number }),
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroAmbientLight", this.props);
        var _this = this;
        var nativeProps = Object.assign({}, this.props);
        nativeProps.style = [this.props.style];
        nativeProps.color = this.props.color;
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTAmbientLight {...nativeProps}/>);
    }
});
var VRTAmbientLight = react_native_1.requireNativeComponent('VRTAmbientLight', ViroAmbientLight);
module.exports = ViroAmbientLight;
