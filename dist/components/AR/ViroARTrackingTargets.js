"use strict";
/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule VRTARTrackingTargets
 * @flow
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARTrackingTargets = void 0;
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ARTrackingTargetsModule = react_native_1.NativeModules.VRTARTrackingTargetsModule;
class ViroARTrackingTargets {
    static createTargets(targets) {
        for (var key in targets) {
            var target = targets[key];
            // Check for required props
            ViroARTrackingTargets.checkForRequiredProps(key, target);
            // resolve asset source if applicable and update the object
            var resultSource = (0, resolveAssetSource_1.default)(target.source);
            target.source = resultSource;
        }
        // call the createTargets function in the native module
        ARTrackingTargetsModule.createTargets(targets);
    }
    static checkForRequiredProps(_key, target) {
        // source is required
        if (target.source == undefined) {
            console.error("ViroTrackingTarget [" + target + "] requires a `source` property");
        }
        // physicalWidth is required for Image targets
        if (!target.type || target.type == "Image") {
            if (target.physicalWidth == undefined) {
                console.error("ViroTrackingTarget [" +
                    target +
                    "] requires a `physicalWidth` property");
            }
        }
    }
    static deleteTarget(targetName) {
        ARTrackingTargetsModule.deleteTarget(targetName);
    }
}
exports.ViroARTrackingTargets = ViroARTrackingTargets;
