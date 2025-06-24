/**
 * NativeViro - JSI Bridge Functions
 *
 * This module provides direct JSI functions to communicate with the native Viro implementation.
 * These functions bypass the React Native bridge and codegen, providing direct access to
 * the existing native implementation.
 */
export type ViroNodeProps = Record<string, any>;
export type ViroNodeType = "box" | "sphere" | "text" | "image" | "animatedImage" | "animatedComponent" | "object" | "scene" | "arScene" | "camera" | "arCamera" | "orbitCamera" | "light" | "ambientLight" | "directionalLight" | "spotLight" | "omniLight" | "sound" | "soundField" | "spatialSound" | "video" | "materialVideo" | "portal" | "portalScene" | "plane" | "arPlane" | "arImageMarker" | "arObjectMarker" | "quad" | "polygon" | "polyline" | "geometry" | "particle" | "flexView" | "surface" | "360Image" | "360Video" | "skyBox" | "lightingEnvironment" | "button" | "controller" | "node";
export type ViroEventCallback = (event: any) => void;
export declare const generateNodeId: () => string;
export declare const generateCallbackId: () => string;
export declare function handleViroEvent(callbackId: string, event: any): void;
export declare function registerEventListener(nodeId: string, eventName: string, callback: ViroEventCallback): string;
export declare function unregisterEventListener(nodeId: string, eventName: string, callbackId: string): void;
export declare function initializeViro(): Promise<boolean>;
export declare function createScene(sceneId: string, sceneType: string, props?: ViroNodeProps): void;
export declare function activateScene(sceneId: string): void;
export declare function deactivateScene(sceneId: string): void;
export declare function destroyScene(sceneId: string): void;
export declare function getSceneState(sceneId: string): string | null;
export declare function getMemoryStats(): Record<string, any> | null;
export declare function performMemoryCleanup(): void;
export declare function createNode(nodeId: string, nodeType: ViroNodeType, props?: ViroNodeProps): void;
export declare function updateNode(nodeId: string, props: ViroNodeProps): void;
export declare function deleteNode(nodeId: string): void;
export declare function addChild(parentId: string, childId: string): void;
export declare function removeChild(parentId: string, childId: string): void;
export declare function createMaterial(materialName: string, properties: Record<string, any>): void;
export declare function updateMaterial(materialName: string, properties: Record<string, any>): void;
export declare function createAnimation(animationName: string, properties: Record<string, any>): void;
export declare function executeAnimation(nodeId: string, animationName: string, options?: Record<string, any>): void;
export declare function setARPlaneDetection(config: {
    enabled?: boolean;
    alignment?: string;
}): void;
export declare function setARImageTargets(targets: Record<string, any>): void;
export declare function isViroJSIAvailable(): boolean;
//# sourceMappingURL=NativeViro.d.ts.map