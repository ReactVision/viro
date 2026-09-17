import { type ViroHandle, type ViroSceneApi } from "@reactvision/viro-web-renderer";
import { type ViroAnimationProp } from "./useViroAnimation";
import { type ViroPhysicsBodyProp } from "./viroPhysicsBody";
type ViroPosition = [number, number, number];
export interface ViroWebNodeProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    opacity?: number;
    visible?: boolean;
    materials?: string | string[];
    shaderOverrides?: string | string[];
    /** Drawn-last wins among equal-depth fragments. */
    renderingOrder?: number;
    /** "billboard" | "billboardX" | "billboardY", the three native accepts. */
    transformBehaviors?: string | string[];
    /** Masks against a light's influenceBitMask; both must intersect to light. */
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    /** Rigid body, in the shape Studio's physicsConfig emits. */
    physicsBody?: ViroPhysicsBodyProp;
    /** Name a collision reports this node by. */
    viroTag?: string;
    onClick?: (position: ViroPosition, source: number) => void;
    onClickState?: (clickState: number, position: ViroPosition, source: number) => void;
    onHover?: (isHovering: boolean, position: ViroPosition, source: number) => void;
    animation?: ViroAnimationProp;
}
export declare function useViroNode(props: ViroWebNodeProps, createGeometry?: (scene: ViroSceneApi) => ViroHandle, contentReady?: boolean, geometryKey?: string | number, createNodeFn?: (scene: ViroSceneApi) => ViroHandle): ViroHandle;
export {};
