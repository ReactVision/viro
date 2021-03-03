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
var resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
var ARTrackingTargetsModule = require('react-native').NativeModules.VRTARTrackingTargetsModule;
var prop_types_1 = __importDefault(require("prop-types"));
// Currently only used for reference purposes (we manually validate)
var ARTrackingTargetsPropTypes = {
    source: prop_types_1.default.oneOfType([
        prop_types_1.default.shape({
            uri: prop_types_1.default.string,
        }),
        // Opaque type returned by require('./image.jpg')
        prop_types_1.default.number,
    ]).isRequired,
    orientation: prop_types_1.default.oneOf(['Up', 'Down', 'Left', 'Right']),
    physicalWidth: prop_types_1.default.number,
    type: prop_types_1.default.oneOf(['Image', 'Object']),
};
var ViroARTrackingTargets = /** @class */ (function () {
    function ViroARTrackingTargets() {
    }
    ViroARTrackingTargets.createTargets = function (targets /*:{[key: string]: any}*/) {
        for (var key in targets) {
            var target = targets[key];
            // Check for required props
            ViroARTrackingTargets.checkForRequiredProps(key, target);
            // resolve asset source if applicable and update the object
            var resultSource = resolveAssetSource_1.default(target.source);
            target.source = resultSource;
        }
        // call the createTargets function in the native module
        ARTrackingTargetsModule.createTargets(targets);
    };
    ViroARTrackingTargets.checkForRequiredProps = function (key, target) {
        // source is required
        if (target.source == undefined) {
            console.error("ViroTrackingTarget [" + target + "] requires a `source` property");
        }
        // physicalWidth is required for Image targets
        if (!target.type || target.type == 'Image') {
            if (target.physicalWidth == undefined) {
                console.error("ViroTrackingTarget [" + target + "] requires a `physicalWidth` property");
            }
        }
    };
    ViroARTrackingTargets.deleteTarget = function (targetName) {
        ARTrackingTargetsModule.deleteTarget(targetName);
    };
    return ViroARTrackingTargets;
}());
module.exports = ViroARTrackingTargets;
