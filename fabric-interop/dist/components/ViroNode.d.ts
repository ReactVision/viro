/**
 * ViroNode
 *
 * A component that serves as a container for other Viro components.
 * It doesn't render anything itself but provides a coordinate system for its children.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroNodeProps extends ViroCommonProps {
    renderingOrder?: number;
    viroTag?: string;
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
    children?: React.ReactNode;
}
/**
 * ViroNode is a component that serves as a container for other Viro components.
 * It doesn't render anything itself but provides a coordinate system for its children.
 */
export declare const ViroNode: React.FC<ViroNodeProps>;
//# sourceMappingURL=ViroNode.d.ts.map