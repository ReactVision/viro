/// <reference types="react" />
import { NativeSyntheticEvent } from "react-native";
import { ViroAmbientLightInfo, ViroAmbientLightUpdateEvent, ViroARAnchorFoundEvent, ViroARAnchorRemovedEvent, ViroARAnchorUpdatedEvent, ViroARPointCloud, ViroARPointCloudUpdateEvent, ViroCameraARHitTest, ViroCameraARHitTestEvent, ViroCameraTransform, ViroCameraTransformEvent, ViroPlatformInfo, ViroPlatformUpdateEvent, ViroTrackingReason, ViroTrackingState, ViroTrackingUpdatedEvent } from "../Types/ViroEvents";
import { Viro3DPoint, ViroPhysicsWorld, ViroRay, ViroScale, ViroSoundRoom, ViroSource } from "../Types/ViroUtils";
import { ViroBase } from "../ViroBase";
import { ViroCommonProps } from "./ViroCommonProps";
declare type Props = ViroCommonProps & {
    displayPointCloud?: {
        imageSource?: ViroSource;
        imageScale?: ViroScale;
        maxPoints?: number;
    };
    anchorDetectionTypes?: string[] | string;
    onCameraARHitTest?: (event: ViroCameraARHitTest) => void;
    onARPointCloudUpdate?: (pointCloud: ViroARPointCloud) => void;
    onCameraTransformUpdate?: (cameraTransform: ViroCameraTransform) => void;
    onTrackingUpdated?: (state: ViroTrackingState, reason: ViroTrackingReason) => void;
    onPlatformUpdate?: (platformInfoViro: ViroPlatformInfo) => void;
    onAmbientLightUpdate?: (update: ViroAmbientLightInfo) => void;
    /**
     * Describes the acoustic properties of the room around the user
     */
    soundRoom?: ViroSoundRoom;
    physicsWorld?: ViroPhysicsWorld;
    postProcessEffects?: string[];
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    onTrackingInitialized?: () => void;
};
export declare class ViroARScene extends ViroBase<Props> {
    onTrackingFirstInitialized: boolean;
    _onCameraARHitTest: (event: NativeSyntheticEvent<ViroCameraARHitTestEvent>) => void;
    _onARPointCloudUpdate: (event: NativeSyntheticEvent<ViroARPointCloudUpdateEvent>) => void;
    _onCameraTransformUpdate: (event: NativeSyntheticEvent<ViroCameraTransformEvent>) => void;
    _onPlatformUpdate: (event: NativeSyntheticEvent<ViroPlatformUpdateEvent>) => void;
    componentDidMount(): void;
    _onTrackingUpdated: (event: NativeSyntheticEvent<ViroTrackingUpdatedEvent>) => void;
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    _onTrackingInitialized: (_event: NativeSyntheticEvent<ViroTrackingUpdatedEvent>) => void;
    /**
     * Gives constant estimates of the ambient light as detected by the camera.
     * Returns object w/ "intensity" and "color" keys
     */
    _onAmbientLightUpdate: (event: NativeSyntheticEvent<ViroAmbientLightUpdateEvent>) => void;
    _onAnchorFound: (event: NativeSyntheticEvent<ViroARAnchorFoundEvent>) => void;
    _onAnchorUpdated: (event: NativeSyntheticEvent<ViroARAnchorUpdatedEvent>) => void;
    _onAnchorRemoved: (event: NativeSyntheticEvent<ViroARAnchorRemovedEvent>) => void;
    findCollisionsWithRayAsync: (from: Viro3DPoint, to: Viro3DPoint, closest: any, viroTag: string) => Promise<any>;
    findCollisionsWithShapeAsync: (from: Viro3DPoint, to: Viro3DPoint, shapeString: string, shapeParam: any, viroTag: string) => Promise<any>;
    performARHitTestWithRay: (ray: ViroRay) => Promise<any>;
    performARHitTestWithWorldPoints: (origin: Viro3DPoint, destination: Viro3DPoint) => Promise<any>;
    performARHitTestWithPosition: (position: Viro3DPoint) => Promise<any>;
    performARHitTestWithPoint: (x: number, y: number) => Promise<any>;
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    getCameraOrientationAsync: () => Promise<{
        position: any[];
        rotation: any[];
        forward: any[];
        up: any[];
    }>;
    getCameraPositionAsync: () => Promise<any>;
    render(): JSX.Element;
}
export {};
