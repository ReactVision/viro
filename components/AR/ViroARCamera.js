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
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARCamera = void 0;
const react_1 = __importDefault(require("react"));
const ViroCamera_1 = require("../ViroCamera");
class ViroARCamera extends react_1.default.Component {
    constructor() {
        super(...arguments);
        this._component = null;
    }
    render() {
        // Uncomment this to check props
        return (<ViroCamera_1.ViroCamera ref={(component) => {
                this._component = component;
            }} {...this.props} active={true}/>);
    }
}
exports.ViroARCamera = ViroARCamera;
