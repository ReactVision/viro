"use strict";
/**
 * Viro Fabric Interop Layer
 *
 * This module provides compatibility between React Native's New Architecture (Fabric)
 * and the existing Viro implementation without requiring codegen.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNodeId = exports.ViroARTrackingTargets = exports.ViroMaterials = exports.ViroAnimations = exports.ViroARObjectMarker = exports.ViroARImageMarker = exports.ViroARPlaneSelector = exports.ViroARPlane = exports.ViroARCamera = exports.Viro3DSceneNavigator = exports.ViroARSceneNavigator = exports.ViroVRSceneNavigator = exports.ViroSceneNavigator = exports.ViroMaterialVideo = exports.ViroAnimatedComponent = exports.ViroParticleEmitter = exports.ViroSpinner = exports.ViroController = exports.ViroButton = exports.ViroSpatialSound = exports.ViroSoundField = exports.ViroSound = exports.ViroOrbitCamera = exports.ViroCamera = exports.ViroLightingEnvironment = exports.ViroOmniLight = exports.ViroSpotLight = exports.ViroDirectionalLight = exports.ViroAmbientLight = exports.ViroPortalScene = exports.ViroPortal = exports.ViroSkyBox = exports.Viro360Video = exports.Viro360Image = exports.ViroAnimatedImage = exports.ViroVideo = exports.ViroImage = exports.ViroText = exports.ViroSurface = exports.ViroPolyline = exports.ViroPolygon = exports.ViroQuad = exports.ViroGeometry = exports.Viro3DObject = exports.ViroSphere = exports.ViroBox = exports.ViroFlexView = exports.ViroARScene = exports.ViroScene = exports.ViroNode = void 0;
exports.ViroEventsManager = exports.updateMaterial = exports.executeAnimation = exports.updateNativeMaterial = exports.executeNativeAnimation = exports.isViroJSIAvailable = exports.setARImageTargets = exports.setARPlaneDetection = exports.createAnimation = exports.createMaterial = exports.removeChild = exports.addChild = exports.deleteNode = exports.updateNode = exports.createNode = exports.performMemoryCleanup = exports.getMemoryStats = exports.getSceneState = exports.destroyScene = exports.deactivateScene = exports.activateScene = exports.createScene = exports.initializeViro = exports.unregisterEventListener = exports.registerEventListener = exports.handleViroEvent = exports.generateCallbackId = void 0;
__exportStar(require("./ViroFabricContainer"), exports);
// Export components explicitly to ensure they're found by validation
var components_1 = require("./components");
Object.defineProperty(exports, "ViroNode", { enumerable: true, get: function () { return components_1.ViroNode; } });
Object.defineProperty(exports, "ViroScene", { enumerable: true, get: function () { return components_1.ViroScene; } });
Object.defineProperty(exports, "ViroARScene", { enumerable: true, get: function () { return components_1.ViroARScene; } });
Object.defineProperty(exports, "ViroFlexView", { enumerable: true, get: function () { return components_1.ViroFlexView; } });
Object.defineProperty(exports, "ViroBox", { enumerable: true, get: function () { return components_1.ViroBox; } });
Object.defineProperty(exports, "ViroSphere", { enumerable: true, get: function () { return components_1.ViroSphere; } });
Object.defineProperty(exports, "Viro3DObject", { enumerable: true, get: function () { return components_1.Viro3DObject; } });
Object.defineProperty(exports, "ViroGeometry", { enumerable: true, get: function () { return components_1.ViroGeometry; } });
Object.defineProperty(exports, "ViroQuad", { enumerable: true, get: function () { return components_1.ViroQuad; } });
Object.defineProperty(exports, "ViroPolygon", { enumerable: true, get: function () { return components_1.ViroPolygon; } });
Object.defineProperty(exports, "ViroPolyline", { enumerable: true, get: function () { return components_1.ViroPolyline; } });
Object.defineProperty(exports, "ViroSurface", { enumerable: true, get: function () { return components_1.ViroSurface; } });
Object.defineProperty(exports, "ViroText", { enumerable: true, get: function () { return components_1.ViroText; } });
Object.defineProperty(exports, "ViroImage", { enumerable: true, get: function () { return components_1.ViroImage; } });
Object.defineProperty(exports, "ViroVideo", { enumerable: true, get: function () { return components_1.ViroVideo; } });
Object.defineProperty(exports, "ViroAnimatedImage", { enumerable: true, get: function () { return components_1.ViroAnimatedImage; } });
Object.defineProperty(exports, "Viro360Image", { enumerable: true, get: function () { return components_1.Viro360Image; } });
Object.defineProperty(exports, "Viro360Video", { enumerable: true, get: function () { return components_1.Viro360Video; } });
Object.defineProperty(exports, "ViroSkyBox", { enumerable: true, get: function () { return components_1.ViroSkyBox; } });
Object.defineProperty(exports, "ViroPortal", { enumerable: true, get: function () { return components_1.ViroPortal; } });
Object.defineProperty(exports, "ViroPortalScene", { enumerable: true, get: function () { return components_1.ViroPortalScene; } });
Object.defineProperty(exports, "ViroAmbientLight", { enumerable: true, get: function () { return components_1.ViroAmbientLight; } });
Object.defineProperty(exports, "ViroDirectionalLight", { enumerable: true, get: function () { return components_1.ViroDirectionalLight; } });
Object.defineProperty(exports, "ViroSpotLight", { enumerable: true, get: function () { return components_1.ViroSpotLight; } });
Object.defineProperty(exports, "ViroOmniLight", { enumerable: true, get: function () { return components_1.ViroOmniLight; } });
Object.defineProperty(exports, "ViroLightingEnvironment", { enumerable: true, get: function () { return components_1.ViroLightingEnvironment; } });
Object.defineProperty(exports, "ViroCamera", { enumerable: true, get: function () { return components_1.ViroCamera; } });
Object.defineProperty(exports, "ViroOrbitCamera", { enumerable: true, get: function () { return components_1.ViroOrbitCamera; } });
Object.defineProperty(exports, "ViroSound", { enumerable: true, get: function () { return components_1.ViroSound; } });
Object.defineProperty(exports, "ViroSoundField", { enumerable: true, get: function () { return components_1.ViroSoundField; } });
Object.defineProperty(exports, "ViroSpatialSound", { enumerable: true, get: function () { return components_1.ViroSpatialSound; } });
Object.defineProperty(exports, "ViroButton", { enumerable: true, get: function () { return components_1.ViroButton; } });
Object.defineProperty(exports, "ViroController", { enumerable: true, get: function () { return components_1.ViroController; } });
Object.defineProperty(exports, "ViroSpinner", { enumerable: true, get: function () { return components_1.ViroSpinner; } });
Object.defineProperty(exports, "ViroParticleEmitter", { enumerable: true, get: function () { return components_1.ViroParticleEmitter; } });
Object.defineProperty(exports, "ViroAnimatedComponent", { enumerable: true, get: function () { return components_1.ViroAnimatedComponent; } });
Object.defineProperty(exports, "ViroMaterialVideo", { enumerable: true, get: function () { return components_1.ViroMaterialVideo; } });
Object.defineProperty(exports, "ViroSceneNavigator", { enumerable: true, get: function () { return components_1.ViroSceneNavigator; } });
Object.defineProperty(exports, "ViroVRSceneNavigator", { enumerable: true, get: function () { return components_1.ViroVRSceneNavigator; } });
Object.defineProperty(exports, "ViroARSceneNavigator", { enumerable: true, get: function () { return components_1.ViroARSceneNavigator; } });
Object.defineProperty(exports, "Viro3DSceneNavigator", { enumerable: true, get: function () { return components_1.Viro3DSceneNavigator; } });
Object.defineProperty(exports, "ViroARCamera", { enumerable: true, get: function () { return components_1.ViroARCamera; } });
Object.defineProperty(exports, "ViroARPlane", { enumerable: true, get: function () { return components_1.ViroARPlane; } });
Object.defineProperty(exports, "ViroARPlaneSelector", { enumerable: true, get: function () { return components_1.ViroARPlaneSelector; } });
Object.defineProperty(exports, "ViroARImageMarker", { enumerable: true, get: function () { return components_1.ViroARImageMarker; } });
Object.defineProperty(exports, "ViroARObjectMarker", { enumerable: true, get: function () { return components_1.ViroARObjectMarker; } });
Object.defineProperty(exports, "ViroAnimations", { enumerable: true, get: function () { return components_1.ViroAnimations; } });
Object.defineProperty(exports, "ViroMaterials", { enumerable: true, get: function () { return components_1.ViroMaterials; } });
Object.defineProperty(exports, "ViroARTrackingTargets", { enumerable: true, get: function () { return components_1.ViroARTrackingTargets; } });
// Export utilities
__exportStar(require("./components/ViroUtils"), exports);
// Export specific functions from NativeViro to avoid conflicts
var NativeViro_1 = require("./NativeViro");
Object.defineProperty(exports, "generateNodeId", { enumerable: true, get: function () { return NativeViro_1.generateNodeId; } });
Object.defineProperty(exports, "generateCallbackId", { enumerable: true, get: function () { return NativeViro_1.generateCallbackId; } });
Object.defineProperty(exports, "handleViroEvent", { enumerable: true, get: function () { return NativeViro_1.handleViroEvent; } });
Object.defineProperty(exports, "registerEventListener", { enumerable: true, get: function () { return NativeViro_1.registerEventListener; } });
Object.defineProperty(exports, "unregisterEventListener", { enumerable: true, get: function () { return NativeViro_1.unregisterEventListener; } });
Object.defineProperty(exports, "initializeViro", { enumerable: true, get: function () { return NativeViro_1.initializeViro; } });
Object.defineProperty(exports, "createScene", { enumerable: true, get: function () { return NativeViro_1.createScene; } });
Object.defineProperty(exports, "activateScene", { enumerable: true, get: function () { return NativeViro_1.activateScene; } });
Object.defineProperty(exports, "deactivateScene", { enumerable: true, get: function () { return NativeViro_1.deactivateScene; } });
Object.defineProperty(exports, "destroyScene", { enumerable: true, get: function () { return NativeViro_1.destroyScene; } });
Object.defineProperty(exports, "getSceneState", { enumerable: true, get: function () { return NativeViro_1.getSceneState; } });
Object.defineProperty(exports, "getMemoryStats", { enumerable: true, get: function () { return NativeViro_1.getMemoryStats; } });
Object.defineProperty(exports, "performMemoryCleanup", { enumerable: true, get: function () { return NativeViro_1.performMemoryCleanup; } });
Object.defineProperty(exports, "createNode", { enumerable: true, get: function () { return NativeViro_1.createNode; } });
Object.defineProperty(exports, "updateNode", { enumerable: true, get: function () { return NativeViro_1.updateNode; } });
Object.defineProperty(exports, "deleteNode", { enumerable: true, get: function () { return NativeViro_1.deleteNode; } });
Object.defineProperty(exports, "addChild", { enumerable: true, get: function () { return NativeViro_1.addChild; } });
Object.defineProperty(exports, "removeChild", { enumerable: true, get: function () { return NativeViro_1.removeChild; } });
Object.defineProperty(exports, "createMaterial", { enumerable: true, get: function () { return NativeViro_1.createMaterial; } });
Object.defineProperty(exports, "createAnimation", { enumerable: true, get: function () { return NativeViro_1.createAnimation; } });
Object.defineProperty(exports, "setARPlaneDetection", { enumerable: true, get: function () { return NativeViro_1.setARPlaneDetection; } });
Object.defineProperty(exports, "setARImageTargets", { enumerable: true, get: function () { return NativeViro_1.setARImageTargets; } });
Object.defineProperty(exports, "isViroJSIAvailable", { enumerable: true, get: function () { return NativeViro_1.isViroJSIAvailable; } });
// Re-export executeAnimation and updateMaterial with different names to avoid conflicts
var NativeViro_2 = require("./NativeViro");
Object.defineProperty(exports, "executeNativeAnimation", { enumerable: true, get: function () { return NativeViro_2.executeAnimation; } });
Object.defineProperty(exports, "updateNativeMaterial", { enumerable: true, get: function () { return NativeViro_2.updateMaterial; } });
// Also export the original names for backward compatibility
var NativeViro_3 = require("./NativeViro");
Object.defineProperty(exports, "executeAnimation", { enumerable: true, get: function () { return NativeViro_3.executeAnimation; } });
Object.defineProperty(exports, "updateMaterial", { enumerable: true, get: function () { return NativeViro_3.updateMaterial; } });
// Export event management utilities
var ViroEventsManager_1 = require("./ViroEventsManager");
Object.defineProperty(exports, "ViroEventsManager", { enumerable: true, get: function () { return __importDefault(ViroEventsManager_1).default; } });
//# sourceMappingURL=index.js.map