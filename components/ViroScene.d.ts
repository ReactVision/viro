/// <reference types="react" />
/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import { ViroCameraTransform, ViroCameraTransformEvent, ViroPlatformEvent, ViroPlatformInfo } from "@components/Types/ViroEvents";
import { ViroPhysicsWorld, Viro3DPoint, ViroSoundRoom } from "@components/Types/ViroUtils";
import { NativeSyntheticEvent } from "react-native";
import { ViroCommonProps } from "./AR/ViroCommonProps";
import { ViroBase } from "./ViroBase";
import { ViroCamera } from "./ViroCamera";
declare type Props = ViroCommonProps & {
    onPlatformUpdate?: (platformInfo: ViroPlatformInfo) => void;
    onCameraTransformUpdate?: (cameraTransform: ViroCameraTransform) => void;
    /**
     * Describes the acoustic properties of the room around the user
     */
    soundRoom?: ViroSoundRoom;
    physicsWorld?: ViroPhysicsWorld;
    postProcessEffects?: string[];
};
export declare class ViroScene extends ViroBase<Props> {
    _onPlatformUpdate(event: NativeSyntheticEvent<ViroPlatformEvent>): void;
    _onCameraTransformUpdate(event: NativeSyntheticEvent<ViroCameraTransformEvent>): void;
    findCollisionsWithRayAsync(from: Viro3DPoint, to: Viro3DPoint, closest: any, viroTag: string): Promise<any>;
    findCollisionsWithShapeAsync(from: Viro3DPoint, to: Viro3DPoint, shapeString: string, shapeParam: any, viroTag: string): Promise<any>;
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
    getChildContext(): {
        cameraDidMount: (camera: ViroCamera) => void;
        cameraWillUnmount: (camera: ViroCamera) => void;
        cameraDidUpdate: (camera: ViroCamera, active: boolean) => void;
    };
    render(): JSX.Element;
}
export {};
