/**
 * Copyright (c) 2018-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARCamera
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
var createReactClass = require('create-react-class');
var ViroCamera = require('../ViroCamera');
var ViroARCamera = createReactClass({
    propTypes: __assign({}, react_native_1.View.propTypes),
    render: function () {
        var _this = this;
        // Uncomment this to check props
        return (<ViroCamera ref={function (component) { _this._component = component; }} {...this.props} active={true}/>);
    },
});
module.exports = ViroARCamera;
