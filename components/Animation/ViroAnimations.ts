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

/**
 * What an entry of `registerAnimations` may hold: an animation, the name of
 * another registered animation, or an array of these. The top-level array runs
 * its members in parallel; an array inside it runs its members in sequence.
 * `{ float: [["floatUp", "floatDown"]] }` plays floatUp, then floatDown.
 */
export type ViroAnimationChain =
  | string
  | ViroRegisterableAnimation
  | ViroAnimationChain[];

export type ViroAnimationDict = {
  [key: string]: ViroAnimationChain;
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

// Colors go to the native side processed, in a chain as well as at the top level.
function processAnimationColors(chain: ViroAnimationChain) {
  if (Array.isArray(chain)) {
    chain.forEach(processAnimationColors);
    return;
  }
  if (typeof chain === "string") {
    return;
  }
  if (chain.properties && chain.properties.color) {
    chain.properties.color = processColor(
      chain.properties.color
    ) as ProcessedColorValue;
  }
}

export class ViroAnimations {
  static registerAnimations(animations: ViroAnimationDict) {
    for (const key in animations) {
      processAnimationColors(animations[key]);
    }
    if (AnimationManager) {
      AnimationManager.setJSAnimations(animations);
    }
  }
}
