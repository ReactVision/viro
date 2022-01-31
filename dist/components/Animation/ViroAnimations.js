"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAnimations = void 0;
/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroAnimations
 * @flow
 */
const react_native_1 = require("react-native");
const AnimationManager = react_native_1.NativeModules.VRTAnimationManager;
class ViroAnimations {
    static registerAnimations(animations) {
        for (var key in animations) {
            if (!Array.isArray(animations[key])) {
                const animation = animations[key];
                if (animation.properties && animation.properties.color) {
                    var newColor = (0, react_native_1.processColor)(animation.properties.color);
                    animation.properties.color = newColor;
                }
            }
        }
        AnimationManager.setJSAnimations(animations);
    }
}
exports.ViroAnimations = ViroAnimations;
