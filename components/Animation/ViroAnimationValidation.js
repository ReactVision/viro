/**
 * Copyright (c) 2016-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @todo: few instances of any are not typed.
 *
 * @providesModule ViroAnimationValidation
 * @flow
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prop_types_1 = __importDefault(require("prop-types"));
var AnimationPropTypes = require("./ViroAnimationPropTypes");
class ViroAnimationValidation {
    static validateAnimationProp(prop, animationName, animation, caller) {
        if (!__DEV__) {
            return;
        }
        if (allAnimationTypes[prop] === undefined) {
            var message1 = '"' + prop + '" is not a valid animation property.';
            var message2 = "\nValid animation props: " +
                JSON.stringify(Object.keys(allAnimationTypes).sort(), null, "  ");
            animationError(message1, animation, caller, message2);
        }
        var errorCallback = () => {
            animationError('"' + prop + '" of animation "' + animationName + '" is not valid.', animation, caller);
        };
        let validationDict = {};
        validationDict[prop] = AnimationPropTypes[prop];
        let valueDict = {};
        valueDict[prop] = animation[prop];
        prop_types_1.default.checkPropTypes(validationDict, valueDict, "prop", caller, errorCallback);
    }
    static validateAnimation(name, animations) {
        if (!__DEV__) {
            return;
        }
        for (var prop in animations[name]) {
            ViroAnimationValidation.validateAnimationProp(prop, name, animations[name], "AnimationValidation " + name);
        }
        // If we don't want to "loop", then we can use the below commented out code to simply
        // check all the props at once! If so, then remove the loop above.
        // var errorCallback = ()=>{
        //   animationError("Error validating Animation: [" + name + "]", animations[name], 'AnimationValidation ' + name);
        // };
        // PropTypes.checkPropTypes(AnimationPropTypes, name, animations[name], 'prop', 'AnimationValidation ' + name, errorCallback);
    }
    static addValidAnimationPropTypes(animationPropTypes) {
        for (var key in animationPropTypes) {
            allAnimationTypes[key] = animationPropTypes[key];
        }
    }
}
var animationError = function (message1, animation, caller, message2) {
    const format = `${message1}\n` +
        `${caller || "<<unknown>>"}: ` +
        JSON.stringify(animation, null, "  ") +
        (message2 || "");
    const error = new Error(format);
    error.name = "Invariant Violation";
    // @ts-ignore
    error.framesToPop = 1; // Skip invariant error's own stack frame.
    throw error;
};
var allAnimationTypes = {};
ViroAnimationValidation.addValidAnimationPropTypes(AnimationPropTypes);
module.exports = ViroAnimationValidation;
