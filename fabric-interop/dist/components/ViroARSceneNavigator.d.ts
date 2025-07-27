/**
 * ViroARSceneNavigator
 *
 * A component for rendering AR scenes.
 */
import React from "react";
export interface ViroARSceneNavigatorProps {
    initialScene: {
        scene: React.ComponentType<any>;
    };
    autofocus?: boolean;
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    videoQuality?: "High" | "Low";
    planeDetection?: {
        horizontal?: boolean;
        vertical?: boolean;
    };
    onTrackingUpdated?: (event: {
        state: string;
        reason?: string;
    }) => void;
    onARSessionFailed?: (error: string) => void;
    style?: React.CSSProperties;
}
/**
 * ViroARSceneNavigator is a component for rendering AR scenes.
 * It provides a container for AR scenes and handles the AR session lifecycle.
 */
export declare const ViroARSceneNavigator: React.FC<ViroARSceneNavigatorProps>;
//# sourceMappingURL=ViroARSceneNavigator.d.ts.map