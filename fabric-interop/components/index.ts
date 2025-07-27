/**
 * Viro Component Wrappers
 *
 * This module exports React components that maintain the same API as the original
 * Viro components but use the Fabric interop layer internally.
 */

// Basic components
export { ViroNode } from "./ViroNode";
export { ViroScene } from "./ViroScene";
export { ViroARScene } from "./ViroARScene";
export { ViroFlexView } from "./ViroFlexView";

// 3D primitives
export { ViroBox } from "./ViroBox";
export { ViroSphere } from "./ViroSphere";
export { Viro3DObject } from "./Viro3DObject";
export { ViroGeometry } from "./ViroGeometry";
export { ViroQuad } from "./ViroQuad";
export { ViroPolygon } from "./ViroPolygon";
export { ViroPolyline } from "./ViroPolyline";
export { ViroSurface } from "./ViroSurface";

// 2D components
export { ViroText } from "./ViroText";
export { ViroImage } from "./ViroImage";
export { ViroVideo } from "./ViroVideo";
export { ViroAnimatedImage } from "./ViroAnimatedImage";

// 360 components
export { Viro360Image } from "./Viro360Image";
export { Viro360Video } from "./Viro360Video";
export { ViroSkyBox } from "./ViroSkyBox";

// Portal components
export { ViroPortal } from "./ViroPortal";
export { ViroPortalScene } from "./ViroPortalScene";

// Lights
export { ViroAmbientLight } from "./ViroAmbientLight";
export { ViroDirectionalLight } from "./ViroDirectionalLight";
export { ViroSpotLight } from "./ViroSpotLight";
export { ViroOmniLight } from "./ViroOmniLight";
export { ViroLightingEnvironment } from "./ViroLightingEnvironment";

// Cameras
export { ViroCamera } from "./ViroCamera";
export { ViroOrbitCamera } from "./ViroOrbitCamera";

// Audio
export { ViroSound } from "./ViroSound";
export { ViroSoundField } from "./ViroSoundField";
export { ViroSpatialSound } from "./ViroSpatialSound";

// Interactive components
export { ViroButton } from "./ViroButton";
export { ViroController } from "./ViroController";
export { ViroSpinner } from "./ViroSpinner";

// Effects
export { ViroParticleEmitter } from "./ViroParticleEmitter";
export { ViroAnimatedComponent } from "./ViroAnimatedComponent";
export { ViroMaterialVideo } from "./ViroMaterialVideo";

// Scene navigators
export { ViroSceneNavigator } from "./ViroSceneNavigator";
export { ViroVRSceneNavigator } from "./ViroVRSceneNavigator";
export { ViroARSceneNavigator } from "./ViroARSceneNavigator";
export { Viro3DSceneNavigator } from "./Viro3DSceneNavigator";

// AR components
export { ViroARCamera } from "./ViroARCamera";
export { ViroARPlane } from "./AR/ViroARPlane";
export { ViroARPlaneSelector } from "./AR/ViroARPlaneSelector";
export { ViroARImageMarker } from "./ViroARImageMarker";
export { ViroARObjectMarker } from "./ViroARObjectMarker";

// Utilities
export * from "./ViroUtils";

// Animation utilities
export * from "./Animation/ViroAnimations";
import ViroAnimations from "./Animation/ViroAnimations";
export { ViroAnimations };

// Material utilities
export * from "./Material/ViroMaterials";
import ViroMaterials from "./Material/ViroMaterials";
export { ViroMaterials };

// AR utilities
export * from "./AR/ViroARTrackingTargets";
import ViroARTrackingTargets from "./AR/ViroARTrackingTargets";
export { ViroARTrackingTargets };
