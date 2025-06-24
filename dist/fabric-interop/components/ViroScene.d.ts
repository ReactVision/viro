/**
 * ViroScene
 *
 * A scene component that manages a 3D scene with scene lifecycle management.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSceneProps extends ViroCommonProps {
    postProcessEffects?: string[];
    soundRoom?: {
        size: [number, number, number];
        wallMaterial?: string;
        ceilingMaterial?: string;
        floorMaterial?: string;
    };
    physicsWorld?: {
        gravity: [number, number, number];
        drawBounds?: boolean;
    };
    onSceneLoad?: () => void;
    onSceneLoadStart?: () => void;
    onSceneLoadEnd?: () => void;
    onSceneError?: (error: string) => void;
    children?: React.ReactNode;
}
/**
 * ViroScene is a 3D scene component that manages scene lifecycle and contains other Viro components.
 */
export declare const ViroScene: React.FC<ViroSceneProps>;
