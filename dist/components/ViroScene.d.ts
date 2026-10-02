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
import { ViroActiveCameraTracker } from "./Utilities/ViroActiveCameraTracker";
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
    /**
     * Turns this scene's tone mapping pass on or off. It is on by default, applying
     * a Hable luminance-only curve that renders pure white at about 0.77 and makes
     * bright materials glow. Off passes colour through untouched.
     *
     * Prefer this over `hdrEnabled={false}` on the navigator when the goal is only
     * an untouched tone curve: PBR requires HDR, so switching HDR off drops every
     * PBR material back to Blinn and silently discards roughness, metalness and the
     * ambient occlusion map.
     */
    toneMappingEnabled?: boolean;
};
type State = {
    /**
     * The React tag of the camera the scene draws from, or null for its default camera. It
     * reaches the native scene as a prop rather than through `VRTCameraModule` so that a camera
     * mounted between its siblings attaches: see `ViroActiveCameraTracker`.
     */
    activeCameraTag: number | null;
};
export declare class ViroScene extends ViroBase<Props, State> {
    state: State;
    _unmounting: boolean;
    _cameras: ViroActiveCameraTracker;
    componentWillUnmount(): void;
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
