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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARTrackingTargets = void 0;
const react_native_1 = require("react-native");
// @ts-ignore
// The visionOS-safe resolver. Image.resolveAssetSource returns an empty uri there;
// see ViroAssetSource.ts for why, and what it falls back to.
const ViroAssetSource_1 = require("../Utilities/ViroAssetSource");
const ARTrackingTargetsModule = react_native_1.NativeModules.VRTARTrackingTargetsModule;
class ViroARTrackingTargets {
    static createTargets(targets) {
        for (var key in targets) {
            var target = targets[key];
            // Check for required props
            ViroARTrackingTargets.checkForRequiredProps(key, target);
            // resolve asset source if applicable and update the object
            var resultSource = (0, ViroAssetSource_1.resolveViroAssetSource)(target.source);
            target.source = resultSource;
        }
        // call the createTargets function in the native module
        if (ARTrackingTargetsModule) {
            ARTrackingTargetsModule.createTargets(targets);
        }
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
        if (ARTrackingTargetsModule) {
            ARTrackingTargetsModule.deleteTarget(targetName);
        }
    }
}
exports.ViroARTrackingTargets = ViroARTrackingTargets;
