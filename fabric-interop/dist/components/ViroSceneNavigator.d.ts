/**
 * ViroSceneNavigator
 *
 * A component for rendering 3D scenes.
 */
import React from "react";
export interface ViroSceneNavigatorProps {
    initialScene: {
        scene: React.ComponentType<any>;
    };
    hdrEnabled?: boolean;
    pbrEnabled?: boolean;
    bloomEnabled?: boolean;
    shadowsEnabled?: boolean;
    multisamplingEnabled?: boolean;
    onCameraTransformUpdate?: (transform: any) => void;
    style?: React.CSSProperties;
}
/**
 * ViroSceneNavigator is a component for rendering 3D scenes.
 * It provides a container for 3D scenes and handles the scene lifecycle.
 */
export declare const ViroSceneNavigator: React.FC<ViroSceneNavigatorProps>;
//# sourceMappingURL=ViroSceneNavigator.d.ts.map