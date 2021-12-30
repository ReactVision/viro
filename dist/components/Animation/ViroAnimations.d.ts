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
import { ColorValue, ProcessedColorValue } from "react-native";
export declare type ViroRegisterableAnimation = {
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
export declare type ViroAnimationDict = {
    [key: string]: ViroRegisterableAnimation | ViroRegisterableAnimation[];
};
export declare type ViroAnimationChainDict = {
    [key: string]: ViroAnimation | ViroAnimation[];
};
export declare type ViroAnimationProp = {
    name: string;
    loop: boolean;
};
export declare type ViroAnimation = {
    name?: string;
    delay?: number;
    loop?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
    run?: boolean;
    interruptible?: boolean;
};
export declare class ViroAnimations {
    static registerAnimations(animations: ViroAnimationDict): void;
}
