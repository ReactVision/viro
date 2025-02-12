/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import * as React from "react";
import { NativeSyntheticEvent } from "react-native";
import { ViroCommonProps } from "./AR/ViroCommonProps";
import { ViroCameraTransform, ViroCameraTransformEvent, ViroPlatformEvent, ViroPlatformInfo, ViroTrackingReason, ViroTrackingState } from "./Types/ViroEvents";
import { Viro3DPoint, ViroPhysicsWorld, ViroSoundRoom } from "./Types/ViroUtils";
import { ViroBase } from "./ViroBase";
type Props = ViroCommonProps & {
    onPlatformUpdate?: (platformInfo: ViroPlatformInfo) => void;
    onCameraTransformUpdate?: (cameraTransform: ViroCameraTransform) => void;
    onTrackingUpdated?: (state: ViroTrackingState, reason: ViroTrackingReason) => void;
    /**
     * Describes the acoustic properties of the room around the user
     */
    soundRoom?: ViroSoundRoom;
    physicsWorld?: ViroPhysicsWorld;
    postProcessEffects?: string[];
};
export declare class ViroScene extends ViroBase<Props> {
    _onPlatformUpdate: (event: NativeSyntheticEvent<ViroPlatformEvent>) => void;
    _onCameraTransformUpdate: (event: NativeSyntheticEvent<ViroCameraTransformEvent>) => void;
    findCollisionsWithRayAsync: (from: Viro3DPoint, to: Viro3DPoint, closest: any, viroTag: string) => Promise<any>;
    findCollisionsWithShapeAsync: (from: Viro3DPoint, to: Viro3DPoint, shapeString: string, shapeParam: any, viroTag: string) => Promise<any>;
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    getCameraPositionAsync(): Promise<any[]>;
    getCameraOrientationAsync(): Promise<{
        position: any[];
        rotation: any[];
        forward: any[];
        up: any[];
    }>;
    render(): React.JSX.Element;
}
export {};
