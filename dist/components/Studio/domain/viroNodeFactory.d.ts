import * as React from "react";
import { StudioAnimation, StudioAsset, ViroAnimationProp } from "../types";
type SceneNavigator = any;
export type NodeConfig = {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane";
    onClick?: () => void;
    animation?: ViroAnimationProp;
};
/**
 * Derives the transform config for an asset.
 * Clamps Z to -2 for non-trigger assets to guarantee visibility.
 */
export declare function createNodeConfig(asset: StudioAsset, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animKey: string) => void, animationStates?: Record<string, ViroAnimationProp>): NodeConfig;
/**
 * Creates the appropriate Viro component for a StudioAsset.
 */
export declare function createNode(asset: StudioAsset, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animKey: string) => void, animationStates?: Record<string, ViroAnimationProp>, onAssetLoaded?: (id: string) => void): React.ReactElement | null;
export {};
