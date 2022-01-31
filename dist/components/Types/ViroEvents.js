"use strict";
/**
 * Copyright (c) 2021-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * To do
 * - source types
 * - clickState types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroControllerTypes = exports.ViroHeadsetTypes = exports.ViroPlatformTypes = exports.ViroRotateStateTypes = exports.ViroPinchStateTypes = exports.ViroClickStateTypes = void 0;
var ViroClickStateTypes;
(function (ViroClickStateTypes) {
    ViroClickStateTypes[ViroClickStateTypes["CLICK_DOWN"] = 1] = "CLICK_DOWN";
    ViroClickStateTypes[ViroClickStateTypes["CLICK_UP"] = 2] = "CLICK_UP";
    ViroClickStateTypes[ViroClickStateTypes["CLICKED"] = 3] = "CLICKED";
})(ViroClickStateTypes = exports.ViroClickStateTypes || (exports.ViroClickStateTypes = {}));
var ViroPinchStateTypes;
(function (ViroPinchStateTypes) {
    ViroPinchStateTypes[ViroPinchStateTypes["PINCH_START"] = 1] = "PINCH_START";
    ViroPinchStateTypes[ViroPinchStateTypes["PINCH_MOVE"] = 2] = "PINCH_MOVE";
    ViroPinchStateTypes[ViroPinchStateTypes["PINCH_END"] = 3] = "PINCH_END";
})(ViroPinchStateTypes = exports.ViroPinchStateTypes || (exports.ViroPinchStateTypes = {}));
var ViroRotateStateTypes;
(function (ViroRotateStateTypes) {
    ViroRotateStateTypes[ViroRotateStateTypes["ROTATE_START"] = 1] = "ROTATE_START";
    ViroRotateStateTypes[ViroRotateStateTypes["ROTATE_MOVE"] = 2] = "ROTATE_MOVE";
    ViroRotateStateTypes[ViroRotateStateTypes["ROTATE_END"] = 3] = "ROTATE_END";
})(ViroRotateStateTypes = exports.ViroRotateStateTypes || (exports.ViroRotateStateTypes = {}));
var ViroPlatformTypes;
(function (ViroPlatformTypes) {
    ViroPlatformTypes["GVR"] = "gvr";
    ViroPlatformTypes["GEAR_VR"] = "ovr-mobile";
})(ViroPlatformTypes = exports.ViroPlatformTypes || (exports.ViroPlatformTypes = {}));
var ViroHeadsetTypes;
(function (ViroHeadsetTypes) {
    ViroHeadsetTypes["CARDBOARD"] = "cardboard";
    ViroHeadsetTypes["DAYDREAM"] = "daydream";
    ViroHeadsetTypes["GEARVR"] = "gearvr";
})(ViroHeadsetTypes = exports.ViroHeadsetTypes || (exports.ViroHeadsetTypes = {}));
var ViroControllerTypes;
(function (ViroControllerTypes) {
    ViroControllerTypes["CARDBOARD"] = "cardboard";
    ViroControllerTypes["DAYDREAM"] = "daydream";
    ViroControllerTypes["GEARVR"] = "gearvr";
})(ViroControllerTypes = exports.ViroControllerTypes || (exports.ViroControllerTypes = {}));
