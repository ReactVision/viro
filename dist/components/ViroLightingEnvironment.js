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
var prop_types_1 = __importDefault(require("prop-types"));
var createReactClass = require('create-react-class');
var ViroProps_1 = require("./Utilities/ViroProps");
var ViroLightingEnvironment = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        /**
         * The hdr image file, which is required
         */
        source: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./image.jpg')
            prop_types_1.default.number,
        ]).isRequired, 
        /**
         * Callback triggered when we are processing the assets to be
         * used in computing this lighting environment (either downloading / reading from file).
         */
        onLoadStart: prop_types_1.default.func, 
        /**
         * Callback triggered when we have finished processing assets to be
         * used in computing this lighting environment. Wether or not assets were
         * processed successfully will be indicated by the parameter "success".
         * For example:
         *
         *   _onLoadEnd(event:Event){
         *      // Indication of asset loading success
         *      event.nativeEvent.success
         *   }
         *
         */
        onLoadEnd: prop_types_1.default.func, 
        /**
         * Callback triggered when the hdr image fails to load. Invoked with
         * {nativeEvent: {error}}
         */
        onError: prop_types_1.default.func }),
    _onLoadStart: function (event /*: Event*/) {
        this.props.onLoadStart && this.props.onLoadStart(event);
    },
    _onLoadEnd: function (event /*: Event*/) {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    },
    _onError: function (event /*: Event*/) {
        this.props.onError && this.props.onError(event);
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroLightingEnvironment", this.props);
        var imgsrc = resolveAssetSource_1.default(this.props.source);
        // Create native props object.
        var nativeProps = Object.assign({}, this.props);
        nativeProps.source = imgsrc;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onLoadStartViro = this._onLoadStart;
        nativeProps.onLoadEndViro = this._onLoadEnd;
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTLightingEnvironment {...nativeProps}/>);
    }
});
var VRTLightingEnvironment = react_native_1.requireNativeComponent('VRTLightingEnvironment', ViroLightingEnvironment, {
    nativeOnly: {
        onLoadStartViro: true,
        onErrorViro: true,
        onLoadEndViro: true
    }
});
module.exports = ViroLightingEnvironment;
