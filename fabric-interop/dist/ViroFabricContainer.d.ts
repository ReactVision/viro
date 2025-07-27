/**
 * ViroFabricContainer
 *
 * This is the main container component that Fabric manages directly.
 * It serves as a viewport for the Viro rendering engine and delegates
 * rendering to the existing native implementation.
 */
import React from "react";
export interface ViroFabricContainerProps {
    debug?: boolean;
    style?: React.CSSProperties;
    arEnabled?: boolean;
    autofocus?: boolean;
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    videoQuality?: "High" | "Low";
    onInitialized?: (success: boolean) => void;
    onTrackingUpdated?: (state: any) => void;
    onCameraTransformUpdate?: (transform: any) => void;
    onARSessionFailed?: (error: string) => void;
    onSceneStateChanged?: (event: {
        sceneId: string;
        state: string;
    }) => void;
    onMemoryWarning?: (event: {
        memoryStats: Record<string, any>;
    }) => void;
    children?: React.ReactNode;
}
/**
 * ViroFabricContainer is the main component that hosts the Viro rendering engine.
 * It creates a native view that the Viro renderer can draw on and manages the
 * lifecycle of the Viro system.
 */
export declare const ViroFabricContainer: React.FC<ViroFabricContainerProps>;
//# sourceMappingURL=ViroFabricContainer.d.ts.map