import * as React from "react";
import { NativeSyntheticEvent } from "react-native";
import { ViroAmbientLightInfo, ViroAmbientLightUpdateEvent, ViroARAnchorFoundEvent, ViroARAnchorRemovedEvent, ViroARAnchorUpdatedEvent, ViroARHitTestResult, ViroARNodeReference, ViroARPointCloud, ViroARPointCloudUpdateEvent, ViroCameraARHitTest, ViroCameraARHitTestEvent, ViroCameraTransform, ViroCameraTransformEvent, ViroPlatformInfo, ViroPlatformUpdateEvent, ViroTrackingReason, ViroTrackingState, ViroTrackingUpdatedEvent } from "../Types/ViroEvents";
import { Viro3DPoint, ViroPhysicsWorld, ViroRay, ViroScale, ViroSoundRoom, ViroSource } from "../Types/ViroUtils";
import { ViroBase } from "../ViroBase";
import { ViroCommonProps } from "./ViroCommonProps";
type Props = ViroCommonProps & {
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
     * Create an AR anchor at the location of a hit test result.
     *
     * This method creates a persistent AR anchor that will be tracked by the
     * AR system. The anchor can be used to place virtual content that stays
     * in place as the user moves around.
     *
     * The returned node reference can be passed to a ViroARNode component
     * to attach 3D content (though ViroARNode is optional and not yet implemented).
     *
     * Note: Hit test results are only valid for 30 seconds. Call this method
     * soon after performing the hit test.
     *
     * @param hitResult The hit test result to create an anchor from
     * @returns Promise resolving to an AR node reference, or null if failed
     *
     * @example
     * ```tsx
     * // Perform hit test
     * const results = await arSceneRef.current.performARHitTestWithPoint(x, y);
     *
     * if (results.length > 0) {
     *   // Create anchor from first result
     *   const nodeRef = await arSceneRef.current.createAnchoredNode(results[0]);
     *
     *   if (nodeRef) {
     *     // Store reference for later use
     *     setAnchoredNodeRef(nodeRef);
     *     console.log('Anchor created:', nodeRef.anchorId);
     *   }
     * }
     * ```
     */
    createAnchoredNode: (hitResult: ViroARHitTestResult) => Promise<ViroARNodeReference | null>;
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
    render(): React.JSX.Element;
}
export {};
