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
    /**
     * This node's renderer handle as it is created, and 0 as it goes.
     *
     * How a host asks the renderer where a node actually is, since an authored
     * position is a world position only while nothing above the node moves — which
     * stops being true inside a plane wrapper or after a drag. A prop rather than
     * a ref because these components' props carry an `[key: string]: any` index
     * signature, and React's `PropsWithoutRef` resolves that to `Omit<P, "ref">`,
     * which drops every declared prop and would silently untype every caller.
     */
    onNodeHandle?: (handle: ViroHandle) => void;
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
