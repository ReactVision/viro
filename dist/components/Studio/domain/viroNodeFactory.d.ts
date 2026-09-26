import * as React from "react";
import { StudioAnimation, StudioAsset, StudioSceneMeta, ViroAnimationProp } from "../types";
import { SequenceRuntimeContext } from "./sceneNavigationHandler";
import { type DragSurface } from "./dragConfiguration";
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
    /** Authored velocity, sent once on mount rather than on the body. */
    viroTag?: string;
    onClick?: () => void;
    onGaze?: (isHovering: boolean, position: [number, number, number], source: number) => void;
    animation?: ViroAnimationProp;
    /** Web only: the renderer handle for this node, as it is created and as it goes. */
    onNodeHandle?: (handle: number) => void;
    /** Told when this asset's model, image or video fails to load. */
    onAssetError?: StudioAssetErrorHandler;
};
/** An asset that failed to load, and why. */
export type StudioAssetErrorHandler = (asset: StudioAsset, error: Error) => void;
export declare function createNodeConfig(asset: StudioAsset, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], scene: StudioSceneMeta | null, onAnimationTrigger?: (targetAssetId: string, animKey: string) => void, animationStates?: Record<string, ViroAnimationProp>, isDragActive?: (assetId: string) => boolean, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext, dragSurface?: DragSurface | null): NodeConfig;
export declare function createNode(asset: StudioAsset, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], scene: StudioSceneMeta | null, onAnimationTrigger?: (targetAssetId: string, animKey: string) => void, animationStates?: Record<string, ViroAnimationProp>, onAssetLoaded?: (id: string) => void, onCollision?: (viroTag: string, collidedPoint: [number, number, number], collidedNormal: [number, number, number]) => void, isDragActive?: (assetId: string) => boolean, notifyPhysicsDrag?: (assetId: string) => void, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext, registerProximityTarget?: (assetId: string, ref: unknown) => void, onGaze?: (isHovering: boolean, position: [number, number, number], source: number) => void, dragSurface?: DragSurface | null, registerProximityNode?: (assetId: string, handle: number) => void, onAssetError?: StudioAssetErrorHandler): React.ReactElement | null;
export {};
