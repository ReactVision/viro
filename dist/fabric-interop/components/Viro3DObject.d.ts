/**
 * Viro3DObject
 *
 * A component for loading and displaying 3D models in various formats.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface Viro3DObjectProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    resources?: ({
        uri: string;
    } | number)[];
    type: "OBJ" | "VRX" | "GLTF" | "GLB" | "FBX";
    position?: [number, number, number];
    scale?: [number, number, number] | number;
    rotation?: [number, number, number];
    materials?: string | string[];
    morphTargets?: {
        [key: string]: number;
    };
    animation?: {
        name?: string;
        delay?: number;
        loop?: boolean;
        onStart?: () => void;
        onFinish?: () => void;
        run?: boolean;
        interruptible?: boolean;
    };
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    highAccuracyEvents?: boolean;
    physicsBody?: {
        type: "Dynamic" | "Kinematic" | "Static";
        mass?: number;
        restitution?: number;
        shape?: {
            type: "Box" | "Sphere" | "Compound";
            params?: number[];
        };
        friction?: number;
        useGravity?: boolean;
        enabled?: boolean;
        velocity?: [number, number, number];
        force?: {
            value: [number, number, number];
            position: [number, number, number];
        };
        torque?: [number, number, number];
    };
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: string) => void;
}
/**
 * Viro3DObject is a component for loading and displaying 3D models in various formats.
 */
export declare const Viro3DObject: React.FC<Viro3DObjectProps>;
