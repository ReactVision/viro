import * as React from "react";
import { StudioAnimation, StudioAsset, StudioSceneMeta, ViroAnimationProp } from "../types";
import { SequenceRuntimeContext } from "./sceneNavigationHandler";
type SceneNavigator = any;
export type NodeConfig = {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane";
    dragPlane?: {
        planePoint: [number, number, number];
        planeNormal: [number, number, number];
        maxDistance: number;
    };
    physicsBody?: Record<string, unknown>;
    viroTag?: string;
    onClick?: () => void;
    animation?: ViroAnimationProp;
};
/** Clamps Z to -2 for non-trigger assets to guarantee visibility. */
export declare function createNodeConfig(asset: StudioAsset, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], scene: StudioSceneMeta | null, onAnimationTrigger?: (targetAssetId: string, animKey: string) => void, animationStates?: Record<string, ViroAnimationProp>, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext): NodeConfig;
export declare function createNode(asset: StudioAsset, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], scene: StudioSceneMeta | null, onAnimationTrigger?: (targetAssetId: string, animKey: string) => void, animationStates?: Record<string, ViroAnimationProp>, onAssetLoaded?: (id: string) => void, onCollision?: (viroTag: string, collidedPoint: [number, number, number], collidedNormal: [number, number, number]) => void, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext): React.ReactElement | null;
export {};
