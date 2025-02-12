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
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAnimatedComponent = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
/**
 * Used to render a ViroAnimatedComponent
 */
class ViroAnimatedComponent extends React.Component {
    _component = null;
    _onStart(_event) {
        this.props.onStart && this.props.onStart();
    }
    _onFinish(_event) {
        this.props.onFinish && this.props.onFinish();
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        console.warn("<ViroAnimatedComponent> is deprecated, please use each component's 'animation' property");
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroAnimatedComponent", this.props);
        let nativeProps = Object.assign({}, this.props);
        nativeProps.onAnimationFinishViro = this._onFinish;
        nativeProps.onAnimationStartViro = this._onStart;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTAnimatedComponent {...nativeProps}/>;
    }
}
exports.ViroAnimatedComponent = ViroAnimatedComponent;
var VRTAnimatedComponent = (0, react_native_1.requireNativeComponent)("VRTAnimatedComponent", 
// @ts-ignore
ViroAnimatedComponent, {
    nativeOnly: { onAnimationStartViro: true, onAnimationFinishViro: true },
});
