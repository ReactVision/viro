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
export declare type ViroARTrackingTargetsMap = {
    [key: string]: ViroARTrackingTarget;
};
export declare type ViroARTrackingTarget = any;
export declare class ViroARTrackingTargets {
    static createTargets(targets: ViroARTrackingTargetsMap): void;
    static checkForRequiredProps(_key: string, target: ViroARTrackingTarget): void;
    static deleteTarget(targetName: string): void;
}
