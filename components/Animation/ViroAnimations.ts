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
import {
  ColorValue,
  NativeModules,
  processColor,
  ProcessedColorValue,
} from "react-native";

const AnimationManager = NativeModules.VRTAnimationManager;

export type ViroRegisterableAnimation = {
  duration: number;
  delay?: number;
  easing?: string;
  properties: {
    positionX?: number | string;
    positionY?: number | string;
    positionZ?: number | string;
    scaleX?: number | string;
    scaleY?: number | string;
    scaleZ?: number | string;
    rotateX?: number | string;
    rotateY?: number | string;
    rotateZ?: number | string;
    translateX?: number | string;
    translateY?: number | string;
    translateZ?: number | string;

    opacity?: number | string;
    color?: ColorValue | ProcessedColorValue;
    material?: string;
  };
};

export type ViroAnimationDict = {
  [key: string]: ViroRegisterableAnimation | ViroRegisterableAnimation[];
};
export type ViroAnimationChainDict = {
  [key: string]: ViroAnimation | ViroAnimation[];
};

export type ViroAnimationProp = { name: string; loop: boolean };

export type ViroAnimation = {
  name?: string;
  delay?: number;
  loop?: boolean;
  onStart?: () => void;
  onFinish?: () => void;
  run?: boolean;
  interruptible?: boolean;
};

export class ViroAnimations {
  static registerAnimations(animations: ViroAnimationDict) {
    for (var key in animations) {
      if (!Array.isArray(animations[key])) {
        const animation = animations[key] as ViroRegisterableAnimation;
        if (animation.properties && animation.properties.color) {
          var newColor = processColor(animation.properties.color);
          animation.properties.color = newColor as ProcessedColorValue;
        }
      }
    }
    AnimationManager.setJSAnimations(animations);
  }
}
