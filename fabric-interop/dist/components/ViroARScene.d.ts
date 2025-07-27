/**
 * ViroARScene
 *
 * A specialized scene for AR content that uses the device's camera as a background.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroARSceneProps extends ViroCommonProps {
    anchorDetectionTypes?: ("PlanesHorizontal" | "PlanesVertical" | "Faces")[];
    planeDetectionEnabled?: boolean;
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    physicsWorld?: {
        gravity?: [number, number, number];
    };
    postProcessEffects?: string[];
    onTrackingUpdated?: (event: any) => void;
    onAmbientLightUpdate?: (event: any) => void;
    onPlatformUpdate?: (event: any) => void;
    onCameraTransformUpdate?: (event: any) => void;
    onAnchorFound?: (event: any) => void;
    onAnchorUpdated?: (event: any) => void;
    onAnchorRemoved?: (event: any) => void;
    children?: React.ReactNode;
}
/**
 * ViroARScene is a specialized scene for AR content that uses the device's camera as a background.
 */
export declare const ViroARScene: React.FC<ViroARSceneProps>;
//# sourceMappingURL=ViroARScene.d.ts.map