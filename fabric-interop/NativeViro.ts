/**
 * NativeViro - JSI Bridge Functions
 *
 * This module provides direct JSI functions to communicate with the native Viro implementation.
 * These functions bypass the React Native bridge and codegen, providing direct access to
 * the existing native implementation.
 */

// Type definitions for props and events
export type ViroNodeProps = Record<string, any>;
export type ViroNodeType =
  | "box"
  | "sphere"
  | "text"
  | "image"
  | "animatedImage"
  | "animatedComponent"
  | "object"
  | "scene"
  | "arScene"
  | "camera"
  | "arCamera"
  | "orbitCamera"
  | "light"
  | "ambientLight"
  | "directionalLight"
  | "spotLight"
  | "omniLight"
  | "sound"
  | "soundField"
  | "spatialSound"
  | "video"
  | "materialVideo"
  | "portal"
  | "portalScene"
  | "plane"
  | "arPlane"
  | "arImageMarker"
  | "arObjectMarker"
  | "quad"
  | "polygon"
  | "polyline"
  | "geometry"
  | "particle"
  | "flexView"
  | "surface"
  | "360Image"
  | "360Video"
  | "skyBox"
  | "lightingEnvironment"
  | "button"
  | "controller"
  | "node";

export type ViroEventCallback = (event: any) => void;

// The global NativeViro object is injected by the native code
// Note: The type declaration is in the generated .d.ts file
// We don't redeclare it here to avoid conflicts

// Additional methods that may not be in the type declaration
// These are accessed using type assertions in the components
// - recenterTracking(nodeId: string): void
// - project(nodeId: string, point: [number, number, number]): Promise<[number, number, number]>
// - unproject(nodeId: string, point: [number, number, number]): Promise<[number, number, number]>

// Event callback registry
const eventCallbacks: Record<string, ViroEventCallback> = {};

// Generate a unique ID for nodes
let nextNodeId = 1;
export const generateNodeId = (): string => `viro_node_${nextNodeId++}`;

// Generate a unique ID for callbacks
let nextCallbackId = 1;
export const generateCallbackId = (): string =>
  `viro_callback_${nextCallbackId++}`;

// Event handler that receives events from native code
export function handleViroEvent(callbackId: string, event: any): void {
  const callback = eventCallbacks[callbackId];
  if (callback) {
    callback(event);
  } else {
    console.warn(`No callback found for ID: ${callbackId}`);
  }
}

// Set up the global event handler
if (typeof global !== "undefined") {
  // @ts-ignore - This property will be added by the native code
  global.handleViroEvent = handleViroEvent;
}

import { getNativeViro, isNativeViroAvailable } from "./components/ViroGlobal";

// Register a JS callback for native events
export function registerEventListener(
  nodeId: string,
  eventName: string,
  callback: ViroEventCallback
): string {
  const callbackId = generateCallbackId();
  eventCallbacks[callbackId] = callback;

  // Register with native code
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.registerEventCallback(nodeId, eventName, callbackId);
  }

  return callbackId;
}

// Unregister a callback
export function unregisterEventListener(
  nodeId: string,
  eventName: string,
  callbackId: string
): void {
  delete eventCallbacks[callbackId];

  // Unregister with native code
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.unregisterEventCallback(nodeId, eventName, callbackId);
  }
}

// Initialize the Viro platform
export function initializeViro(config?: {
  debug?: boolean;
  arEnabled?: boolean;
  worldAlignment?: string;
}): Promise<boolean> {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    return nativeViro.initialize(config);
  }
  return Promise.reject(new Error("NativeViro not available"));
}

// Scene Management Functions
export function createScene(
  sceneId: string,
  sceneType: string,
  props: ViroNodeProps = {}
): void {
  const nativeViro = getNativeViro();
  if (nativeViro && nativeViro.createViroScene) {
    nativeViro.createViroScene(sceneId, sceneType, props);
  } else {
    console.warn("Scene management not available - createScene");
  }
}

export function activateScene(sceneId: string): void {
  const nativeViro = getNativeViro();
  if (nativeViro && nativeViro.activateViroScene) {
    nativeViro.activateViroScene(sceneId);
  } else {
    console.warn("Scene management not available - activateScene");
  }
}

export function deactivateScene(sceneId: string): void {
  const nativeViro = getNativeViro();
  if (nativeViro && nativeViro.deactivateViroScene) {
    nativeViro.deactivateViroScene(sceneId);
  } else {
    console.warn("Scene management not available - deactivateScene");
  }
}

export function destroyScene(sceneId: string): void {
  const nativeViro = getNativeViro();
  if (nativeViro && nativeViro.destroyViroScene) {
    nativeViro.destroyViroScene(sceneId);
  } else {
    console.warn("Scene management not available - destroyScene");
  }
}

export function getSceneState(sceneId: string): string | null {
  const nativeViro = getNativeViro();
  if (nativeViro && nativeViro.getViroSceneState) {
    return nativeViro.getViroSceneState(sceneId);
  }
  return null;
}

export function getMemoryStats(): Record<string, any> | null {
  const nativeViro = getNativeViro();
  if (nativeViro && nativeViro.getViroMemoryStats) {
    return nativeViro.getViroMemoryStats();
  }
  return null;
}

export function performMemoryCleanup(): void {
  const nativeViro = getNativeViro();
  if (nativeViro && nativeViro.performViroMemoryCleanup) {
    nativeViro.performViroMemoryCleanup();
  } else {
    console.warn("Memory management not available - performMemoryCleanup");
  }
}

// Node Management Functions (enhanced)
export function createNode(
  nodeId: string,
  nodeType: ViroNodeType,
  props: ViroNodeProps = {}
): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.createViroNode(nodeId, nodeType, props);
  } else {
    console.warn("NativeViro not available - createNode");
  }
}

export function updateNode(nodeId: string, props: ViroNodeProps): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.updateViroNode(nodeId, props);
  } else {
    console.warn("NativeViro not available - updateNode");
  }
}

export function deleteNode(nodeId: string): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.deleteViroNode(nodeId);
  } else {
    console.warn("NativeViro not available - deleteNode");
  }
}

export function addChild(parentId: string, childId: string): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.addViroNodeChild(parentId, childId);
  } else {
    console.warn("NativeViro not available - addChild");
  }
}

export function removeChild(parentId: string, childId: string): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.removeViroNodeChild(parentId, childId);
  } else {
    console.warn("NativeViro not available - removeChild");
  }
}

// Material Management Functions (enhanced)
export function createMaterial(
  materialName: string,
  properties: Record<string, any>
): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.createViroMaterial(materialName, properties);
  } else {
    console.warn("NativeViro not available - createMaterial");
  }
}

export function updateMaterial(
  materialName: string,
  properties: Record<string, any>
): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.updateViroMaterial(materialName, properties);
  } else {
    console.warn("NativeViro not available - updateMaterial");
  }
}

// Animation Management Functions (enhanced)
export function createAnimation(
  animationName: string,
  properties: Record<string, any>
): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.createViroAnimation(animationName, properties);
  } else {
    console.warn("NativeViro not available - createAnimation");
  }
}

export function executeAnimation(
  nodeId: string,
  animationName: string,
  options: Record<string, any> = {}
): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.executeViroAnimation(nodeId, animationName, options);
  } else {
    console.warn("NativeViro not available - executeAnimation");
  }
}

// AR Configuration Functions (enhanced)
export function setARPlaneDetection(config: {
  enabled?: boolean;
  alignment?: string;
}): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.setViroARPlaneDetection(config);
  } else {
    console.warn("NativeViro not available - setARPlaneDetection");
  }
}

export function setARImageTargets(targets: Record<string, any>): void {
  const nativeViro = getNativeViro();
  if (nativeViro) {
    nativeViro.setViroARImageTargets(targets);
  } else {
    console.warn("NativeViro not available - setARImageTargets");
  }
}

// Check if the JSI interface is available
export function isViroJSIAvailable(): boolean {
  return isNativeViroAvailable();
}
