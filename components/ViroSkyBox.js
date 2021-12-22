/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSkybox
 * @flow
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSkybox = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroProps_1 = require("./Utilities/ViroProps");
/**
 * Used to render a skybox as a scene background.
 */
class ViroSkybox extends react_1.default.Component {
    constructor() {
        super(...arguments);
        this._component = null;
    }
    _onLoadStart(event) {
        this.props.onLoadStart && this.props.onLoadStart(event);
    }
    _onLoadEnd(event) {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        ViroProps_1.checkMisnamedProps("ViroSkyBox", this.props);
        // Create and set the native props.
        var skyboxDict = {};
        let nativeProps = Object.assign({}, this.props);
        if (this.props.source !== undefined) {
            for (var key in this.props.source) {
                var s = resolveAssetSource_1.default(this.props.source[key]);
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
        return <VRTSkybox {...nativeProps}/>;
    }
}
exports.ViroSkybox = ViroSkybox;
var VRTSkybox = react_native_1.requireNativeComponent("VRTSkybox", 
// @ts-ignore
ViroSkybox, {
    nativeOnly: { onViroSkyBoxLoadStart: true, onViroSkyBoxLoadEnd: true },
});
