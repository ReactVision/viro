/**
 * ViroVRSceneNavigator
 *
 * A component for rendering VR scenes.
 */
import React from "react";
export interface ViroVRSceneNavigatorProps {
    initialScene: {
        scene: React.ComponentType<any>;
    };
    vrModeEnabled?: boolean;
    hdrEnabled?: boolean;
    pbrEnabled?: boolean;
    bloomEnabled?: boolean;
    shadowsEnabled?: boolean;
    multisamplingEnabled?: boolean;
    onCameraTransformUpdate?: (transform: any) => void;
    onExitViro?: () => void;
    style?: React.CSSProperties;
}
/**
 * ViroVRSceneNavigator is a component for rendering VR scenes.
 * It provides a container for VR scenes and handles the VR session lifecycle.
 */
export declare const ViroVRSceneNavigator: React.FC<ViroVRSceneNavigatorProps>;
