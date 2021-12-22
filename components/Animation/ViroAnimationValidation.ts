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

import PropTypes from "prop-types";
import {
  ViroAnimation,
  ViroAnimationChainDict,
  ViroAnimationDict,
} from "./ViroAnimations";

var AnimationPropTypes = require("./ViroAnimationPropTypes");

export class ViroAnimationValidation {
  static validateAnimationProp(
    prop: string,
    animationName: string,
    animation: ViroAnimation,
    caller: any
  ) {
    if (!__DEV__) {
      return;
    }
    if (allAnimationTypes[prop] === undefined) {
      var message1 = '"' + prop + '" is not a valid animation property.';
      var message2 =
        "\nValid animation props: " +
        JSON.stringify(Object.keys(allAnimationTypes).sort(), null, "  ");
      animationError(message1, animation, caller, message2);
    }

    var errorCallback = () => {
      animationError(
        '"' + prop + '" of animation "' + animationName + '" is not valid.',
        animation,
        caller
      );
    };
    let validationDict: any = {};
    validationDict[prop] = AnimationPropTypes[prop];
    let valueDict: any = {};
    valueDict[prop] = animation[prop as keyof typeof animation];
    PropTypes.checkPropTypes(
      validationDict,
      valueDict,
      "prop",
      caller,
      errorCallback
    );
  }

  /**
   * Iterate through array to determine if there are empty chains (invalid)
   * or if there are any empty elements within a given chain (invalid)
   */
  static validateAnimationChain(
    name: string,
    animations: ViroAnimationChainDict
  ) {
    if (!__DEV__) {
      return;
    }

    var arrayChains = animations[name];
    if (!(arrayChains.constructor === Array) || arrayChains.length <= 0) {
      animationError(
        "Invalid chains: Array of Animation chains must be a non empty array!",
        animations[name] as ViroAnimation,
        "AnimationValidation " + name
      );
      return;
    }

    for (var chainIndex = 0; chainIndex < arrayChains.length; chainIndex++) {
      if (
        !(arrayChains[chainIndex].constructor === Array) ||
        // @ts-ignore for now... :)
        arrayChains[chainIndex].length <= 0
      ) {
        animationError(
          "Invalid chain: individual Animation chain must be a non empty array!",
          animations[name] as ViroAnimation,
          "AnimationValidation " + name
        );
        return;
      }
    }
  }

  static validateAnimation(name: string, animations: ViroAnimationDict) {
    if (!__DEV__) {
      return;
    }
    for (var prop in animations[name]) {
      ViroAnimationValidation.validateAnimationProp(
        prop,
        name,
        animations[name],
        "AnimationValidation " + name
      );
    }

    // If we don't want to "loop", then we can use the below commented out code to simply
    // check all the props at once! If so, then remove the loop above.
    // var errorCallback = ()=>{
    //   animationError("Error validating Animation: [" + name + "]", animations[name], 'AnimationValidation ' + name);
    // };
    // PropTypes.checkPropTypes(AnimationPropTypes, name, animations[name], 'prop', 'AnimationValidation ' + name, errorCallback);
  }

  static addValidAnimationPropTypes(animationPropTypes: any) {
    for (var key in animationPropTypes) {
      allAnimationTypes[key] = animationPropTypes[key];
    }
  }
}

var animationError = function (
  message1: string,
  animation: ViroAnimation,
  caller?: any,
  message2?: any
) {
  const format =
    `${message1}\n` +
    `${caller || "<<unknown>>"}: ` +
    JSON.stringify(animation, null, "  ") +
    (message2 || "");
  const error = new Error(format);
  error.name = "Invariant Violation";
  // @ts-ignore
  error.framesToPop = 1; // Skip invariant error's own stack frame.
  throw error;
};

var allAnimationTypes: any = {};

ViroAnimationValidation.addValidAnimationPropTypes(AnimationPropTypes);
