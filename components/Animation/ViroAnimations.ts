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
import { NativeModules, processColor } from "react-native";
const AnimationManager = NativeModules.VRTAnimationManager;
import { ViroAnimationValidation } from "./ViroAnimationValidation";

export type ViroAnimationDict = {
  [key: string]: ViroAnimation;
};
export type ViroAnimationChainDict = {
  [key: string]: ViroAnimation | ViroAnimation[];
};

export type ViroAnimation = {
  name?: string;
  delay?: number;
  loop?: boolean;
  onStart?: () => void;
  onFinish?: () => void;
  run?: boolean;
  interruptible?: boolean;

  // TODO: https://docs.viromedia.com/docs/viroanimations says that properties and duration are required.
  // However, the ViroSpinner doesn't use them.
  properties?: any;
  // TODO: Type for properties
  duration?: number;

  // Linear: the animation will occur evenly over its duration
  // EaseIn: the animation will begin slowly and then speed up as it progresses
  // EaseOut: the animation will begin quickly and then slow as it progresses
  // EaseInEaseOut: the animation will begin slowly, accelerate through the middle of its duration, and then slow again before completing
  // Bounce: the animation will begin quickly and overshoot* its final position before settling into its final resting place
  easing?: "Bounce" | "Linear" | "EaseIn" | "EaseOut" | "EaseInEaseOut";
};

export class ViroAnimations {
  static registerAnimations(animations: ViroAnimationDict) {
    for (var key in animations) {
      if (animations[key].constructor === Array) {
        // Validate a given animation chain.
        ViroAnimationValidation.validateAnimationChain(key, animations);
      } else {
        // Validate single animation.
        ViroAnimationValidation.validateAnimation(key, animations);
        if (animations[key].properties && animations[key].properties.color) {
          var newColor = processColor(animations[key].properties.color);
          animations[key].properties.color = newColor;
        }
      }
    }
    AnimationManager.setJSAnimations(animations);
  }
}
