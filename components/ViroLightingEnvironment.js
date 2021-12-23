/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Viro360Image
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
exports.ViroLightingEnvironment = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
class ViroLightingEnvironment extends React.Component {
    _component = null;
    _onLoadStart = (event) => {
        this.props.onLoadStart && this.props.onLoadStart(event);
    };
    _onLoadEnd = (event) => {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroLightingEnvironment", this.props);
        var imgsrc = (0, resolveAssetSource_1.default)(this.props.source);
        // Create native props object.
        let nativeProps = Object.assign({}, this.props);
        nativeProps.source = imgsrc;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onLoadStartViro = this._onLoadStart;
        nativeProps.onLoadEndViro = this._onLoadEnd;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTLightingEnvironment {...nativeProps}/>;
    }
}
exports.ViroLightingEnvironment = ViroLightingEnvironment;
var VRTLightingEnvironment = (0, react_native_1.requireNativeComponent)("VRTLightingEnvironment", 
// @ts-ignore
ViroLightingEnvironment, {
    nativeOnly: {
        onLoadStartViro: true,
        onErrorViro: true,
        onLoadEndViro: true,
    },
});
