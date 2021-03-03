/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroAnimatedComponent
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
var prop_types_1 = __importDefault(require("prop-types"));
var createReactClass = require('create-react-class');
/**
 * Used to render a ViroAnimatedComponent
 */
var ViroAnimatedComponent = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { animation: prop_types_1.default.string, delay: prop_types_1.default.number, loop: prop_types_1.default.bool, onStart: prop_types_1.default.func, onFinish: prop_types_1.default.func, run: prop_types_1.default.bool }),
    _onStart: function (event /*: Event*/) {
        this.props.onStart && this.props.onStart();
    },
    _onFinish: function (event /*: Event*/) {
        this.props.onFinish && this.props.onFinish();
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        var _this = this;
        console.warn("<ViroAnimatedComponent> is deprecated, please use each component's 'animation' property");
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroAnimatedComponent", this.props);
        var nativeProps = Object.assign({}, this.props);
        nativeProps.onAnimationFinishViro = this._onFinish;
        nativeProps.onAnimationStartViro = this._onStart;
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTAnimatedComponent {...nativeProps}/>);
    }
});
var VRTAnimatedComponent = react_native_1.requireNativeComponent('VRTAnimatedComponent', ViroAnimatedComponent, {
    nativeOnly: { onAnimationStartViro: true, onAnimationFinishViro: true }
});
module.exports = ViroAnimatedComponent;
