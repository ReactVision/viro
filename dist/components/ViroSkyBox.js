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
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var ViroProps_1 = require("./Utilities/ViroProps");
var prop_types_1 = __importDefault(require("prop-types"));
var CubeMapPropType = require('./Material/CubeMapPropType');
var ColorPropType = require('react-native').ColorPropType;
/**
 * Used to render a skybox as a scene background.
 */
var ViroSkybox = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        /**
         * The source cube map. Either this or a color must be specified.
         */
        source: CubeMapPropType, color: ColorPropType, format: prop_types_1.default.oneOf(['RGBA8', 'RGB565']), 
        /**
         * Callback triggered when we are processing the assets to be
         * displayed in this 360 Photo (either downloading / reading from file).
         */
        onLoadStart: prop_types_1.default.func, 
        /**
         * Callback triggered when we have finished processing assets to be
         * displayed. Wether or not assets were processed successfully and
         * thus displayed will be indicated by the parameter "success".
         * For example:
         *
         *   _onLoadEnd(event:Event){
         *      // Indication of asset loading success
         *      event.nativeEvent.success
         *   }
         *
         */
        onLoadEnd: prop_types_1.default.func }),
    _onLoadStart: function (event /*: Event*/) {
        this.props.onLoadStart && this.props.onLoadStart(event);
    },
    _onLoadEnd: function (event /*: Event*/) {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroSkyBox", this.props);
        // Create and set the native props.
        var skyboxDict = {};
        var nativeProps = Object.assign({}, this.props);
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
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTSkybox {...nativeProps}/>);
    }
});
var VRTSkybox = react_native_1.requireNativeComponent('VRTSkybox', ViroSkybox, {
    nativeOnly: { onViroSkyBoxLoadStart: true, onViroSkyBoxLoadEnd: true }
});
module.exports = ViroSkybox;
