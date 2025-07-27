/**
 * ViroGlobal
 *
 * A utility to provide type-safe access to the global NativeViro object.
 */

// Add global declaration for TypeScript
declare global {
  var NativeViro: any;
}

// Define the shape of the NativeViro object
export interface NativeViroType {
  // Node management
  createViroNode: (
    nodeId: string,
    nodeType: string,
    props: Record<string, any>
  ) => void;
  updateViroNode: (nodeId: string, props: Record<string, any>) => void;
  deleteViroNode: (nodeId: string) => void;

  // Scene hierarchy
  addViroNodeChild: (parentId: string, childId: string) => void;
  removeViroNodeChild: (parentId: string, childId: string) => void;

  // Event handling
  registerEventCallback: (
    nodeId: string,
    eventName: string,
    callbackId: string
  ) => void;
  unregisterEventCallback: (
    nodeId: string,
    eventName: string,
    callbackId: string
  ) => void;

  // Materials
  createViroMaterial: (
    materialName: string,
    properties: Record<string, any>
  ) => void;
  updateViroMaterial: (
    materialName: string,
    properties: Record<string, any>
  ) => void;

  // Animations
  createViroAnimation: (
    animationName: string,
    properties: Record<string, any>
  ) => void;
  executeViroAnimation: (
    nodeId: string,
    animationName: string,
    options: Record<string, any>
  ) => void;

  // Scene Management
  createViroScene: (
    sceneId: string,
    sceneType: string,
    props: Record<string, any>
  ) => void;
  activateViroScene: (sceneId: string) => void;
  deactivateViroScene: (sceneId: string) => void;
  destroyViroScene: (sceneId: string) => void;
  getViroSceneState: (sceneId: string) => string | null;

  // Memory Management
  getViroMemoryStats: () => Record<string, any> | null;
  performViroMemoryCleanup: () => void;

  // AR specific
  setViroARPlaneDetection: (config: {
    enabled?: boolean;
    alignment?: string;
    horizontal?: boolean;
    vertical?: boolean;
  }) => void;
  setViroARImageTargets: (targets: Record<string, any>) => void;

  // Scene navigator methods
  recenterTracking: (nodeId: string) => void;
  project: (
    nodeId: string,
    point: [number, number, number]
  ) => Promise<[number, number, number]>;
  unproject: (
    nodeId: string,
    point: [number, number, number]
  ) => Promise<[number, number, number]>;

  // Initialization
  initialize: (config?: {
    debug?: boolean;
    arEnabled?: boolean;
    worldAlignment?: string;
  }) => Promise<boolean>;
}

// Get the NativeViro object with type safety
export function getNativeViro(): NativeViroType | null {
  if (typeof global !== "undefined" && global.NativeViro) {
    return global.NativeViro as NativeViroType;
  }
  return null;
}

// Check if NativeViro is available
export function isNativeViroAvailable(): boolean {
  return getNativeViro() !== null;
}
