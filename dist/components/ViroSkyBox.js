/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSkyBox
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
exports.ViroSkyBox = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
/**
 * Used to render a skybox as a scene background.
 */
class ViroSkyBox extends React.Component {
    _component = null;
    _onLoadStart = (event) => {
        this.props.onLoadStart && this.props.onLoadStart(event);
    };
    _onLoadEnd = (event) => {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroSkyBox", this.props);
        // Create and set the native props.
        var skyboxDict = {};
        let nativeProps = Object.assign({}, this.props);
        if (this.props.source !== undefined) {
            for (var key in this.props.source) {
                var s = (0, resolveAssetSource_1.default)(this.props.source[key]);
                skyboxDict[key] = s;
            }
            nativeProps.source = skyboxDict;
        }
        nativeProps.onViroSkyBoxLoadStart = this._onLoadStart;
        nativeProps.onViroSkyBoxLoadEnd = this._onLoadEnd;
        nativeProps.color = this.props.color;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTSkyBox {...nativeProps}/>;
    }
}
exports.ViroSkyBox = ViroSkyBox;
var VRTSkyBox = (0, react_native_1.requireNativeComponent)("VRTSkybox", 
// @ts-ignore
ViroSkyBox, {
    nativeOnly: { onViroSkyBoxLoadStart: true, onViroSkyBoxLoadEnd: true },
});
