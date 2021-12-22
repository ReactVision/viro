/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroDirectionalLight
 * @flow
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroDirectionalLight = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
/**
 * Used to render a ViroDirectionalLight
 */
class ViroDirectionalLight extends react_1.default.Component {
    _component = null;
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroDirectionalLight", this.props);
        let nativeProps = Object.assign({}, this.props);
        nativeProps.style = [this.props.style];
        nativeProps.color = this.props.color;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTDirectionalLight {...nativeProps}/>;
    }
}
exports.ViroDirectionalLight = ViroDirectionalLight;
var VRTDirectionalLight = (0, react_native_1.requireNativeComponent)("VRTDirectionalLight", 
// @ts-ignore
ViroDirectionalLight);
