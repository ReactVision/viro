/**
 * Viro Fabric Interop Layer
 *
 * This module provides compatibility between React Native's New Architecture (Fabric)
 * and the existing Viro implementation without requiring codegen.
 */
export * from "./ViroFabricContainer";
export { ViroNode, ViroScene, ViroARScene, ViroFlexView, ViroBox, ViroSphere, Viro3DObject, ViroGeometry, ViroQuad, ViroPolygon, ViroPolyline, ViroSurface, ViroText, ViroImage, ViroVideo, ViroAnimatedImage, Viro360Image, Viro360Video, ViroSkyBox, ViroPortal, ViroPortalScene, ViroAmbientLight, ViroDirectionalLight, ViroSpotLight, ViroOmniLight, ViroLightingEnvironment, ViroCamera, ViroOrbitCamera, ViroSound, ViroSoundField, ViroSpatialSound, ViroButton, ViroController, ViroSpinner, ViroParticleEmitter, ViroAnimatedComponent, ViroMaterialVideo, ViroSceneNavigator, ViroVRSceneNavigator, ViroARSceneNavigator, Viro3DSceneNavigator, ViroARCamera, ViroARPlane, ViroARPlaneSelector, ViroARImageMarker, ViroARObjectMarker, ViroAnimations, ViroMaterials, ViroARTrackingTargets, } from "./components";
export * from "./components/ViroUtils";
export { generateNodeId, generateCallbackId, handleViroEvent, registerEventListener, unregisterEventListener, initializeViro, createScene, activateScene, deactivateScene, destroyScene, getSceneState, getMemoryStats, performMemoryCleanup, createNode, updateNode, deleteNode, addChild, removeChild, createMaterial, createAnimation, setARPlaneDetection, setARImageTargets, isViroJSIAvailable, type ViroNodeProps, type ViroNodeType, type ViroEventCallback, } from "./NativeViro";
export { executeAnimation as executeNativeAnimation, updateMaterial as updateNativeMaterial, } from "./NativeViro";
export { executeAnimation, updateMaterial } from "./NativeViro";
