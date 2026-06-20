/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 */
import { ViroAnimations } from "./components/Animation/ViroAnimations";
import { StudioSceneNavigator, StudioARScene } from "./components/Studio";
import { ViroVisionOSModule, isVisionOS, enterImmersiveSpace, exitImmersiveSpace } from "./components/VisionOS/ViroVisionOSModule";
import { Viro3DObject } from "./components/Viro3DObject";
import { Viro360Image } from "./components/Viro360Image";
import { Viro360Video } from "./components/Viro360Video";
import { ViroAnimatedImage } from "./components/ViroAnimatedImage";
import { ViroAmbientLight } from "./components/ViroAmbientLight";
import { ViroAnimatedComponent } from "./components/ViroAnimatedComponent";
import { ViroARImageMarker } from "./components/AR/ViroARImageMarker";
import { ViroARObjectMarker } from "./components/AR/ViroARObjectMarker";
import { ViroARTrackingTargets } from "./components/AR/ViroARTrackingTargets";
import { ViroARPlane } from "./components/AR/ViroARPlane";
import { ViroARPlaneSelector } from "./components/AR/ViroARPlaneSelector";
import { ViroARScene } from "./components/AR/ViroARScene";
import { ViroARSceneNavigator } from "./components/AR/ViroARSceneNavigator";
import { ViroBox } from "./components/ViroBox";
import { ViroButton } from "./components/ViroButton";
import { ViroCamera } from "./components/ViroCamera";
import {
  ViroARTrackingReasonConstants,
  ViroRecordingErrorConstants,
  ViroTrackingStateConstants,
} from "./components/ViroConstants";
import { ViroController } from "./components/ViroController";
import { ViroVirtualJoystick } from "./components/ViroVirtualJoystick";
import { ViroVirtualButton } from "./components/ViroVirtualButton";
import { ViroGameLoop } from "./components/ViroGameLoop";
import { ViroGameLoopUtils } from "./components/ViroGameLoopUtils";
import { useGameLoop, useLateUpdate, useFixedUpdate } from "./components/hooks/useGameLoop";
import { ViroDirectionalLight } from "./components/ViroDirectionalLight";
import { ViroFlexView } from "./components/ViroFlexView";
import { ViroGeometry } from "./components/ViroGeometry";
import { ViroLightingEnvironment } from "./components/ViroLightingEnvironment";
import { ViroImage } from "./components/ViroImage";
import {
  ViroMaterials,
  ViroMaterial,
  ViroShaderModifiers,
  ViroShaderUniform,
  ViroShaderModifier,
} from "./components/Material/ViroMaterials";
import { ViroMaterialVideo } from "./components/ViroMaterialVideo";
import { ViroCameraTexture } from "./components/ViroCameraTexture";
export type { ViroCameraPosition, ViroCameraReadyEvent } from "./components/ViroCameraTexture";
import { ViroObjectDetector } from "./components/ViroObjectDetector";
export type { ViroDetectorMode, ViroDetectedObject, ViroDetectionBoundingBox, ViroDetectionEvent, ViroDetectorReadyEvent, ViroDetectorErrorEvent } from "./components/ViroObjectDetector";
import { ViroNode } from "./components/ViroNode";
import { ViroOmniLight } from "./components/ViroOmniLight";
import { ViroOrbitCamera } from "./components/ViroOrbitCamera";
import { ViroParticleEmitter } from "./components/ViroParticleEmitter";
import { ViroPolygon } from "./components/ViroPolygon";
import { ViroPolyline } from "./components/ViroPolyline";
import { ViroPortal } from "./components/ViroPortal";
import { ViroPortalScene } from "./components/ViroPortalScene";
import { ViroQuad } from "./components/ViroQuad";
import { ViroScene } from "./components/ViroScene";
import { ViroSkyBox } from "./components/ViroSkyBox";
import { ViroSound } from "./components/ViroSound";
import { ViroSoundField } from "./components/ViroSoundField";
import { ViroSpatialSound } from "./components/ViroSpatialSound";
import { ViroSphere } from "./components/ViroSphere";
import { ViroSpinner } from "./components/ViroSpinner";
import { ViroSpotLight } from "./components/ViroSpotLight";
import { ViroText } from "./components/ViroText";
import { ViroVideo } from "./components/ViroVideo";
import { ViroVRSceneNavigator } from "./components/ViroVRSceneNavigator";
import { ViroXRSceneNavigator } from "./components/ViroXRSceneNavigator";
import { Viro3DSceneNavigator } from "./components/Viro3DSceneNavigator";
import { hasOpenXRSupport, isQuest } from "./components/Utilities/ViroPlatform";
import { useAnySourceHover } from "./components/Utilities/useAnySourceHover";
import { useAnySourcePressed } from "./components/Utilities/useAnySourcePressed";
import { ViroTextStyle } from "./components/Styles/ViroTextStyle";
import { ViroStyle } from "./components/Styles/ViroStyle";
import {
  polarToCartesian,
  polarToCartesianActual,
  isARSupportedOnDevice,
  requestRequiredPermissions,
  checkPermissions,
  ViroARSupportResponse,
  ViroPermissionsResult,
  ViroPermission,
  latLngToMercator,
  gpsToArWorld,
} from "./components/Utilities/ViroUtils";
import { ViroARCamera } from "./components/AR/ViroARCamera";
import {
  ViroHoverEvent,
  ViroClickEvent,
  ViroClickStateEvent,
  ViroTouchEvent,
  ViroScrollEvent,
  ViroSwipeEvent,
  ViroFuseEvent,
  ViroPinchEvent,
  ViroRotateEvent,
  ViroDragEvent,
  ViroPlatformEvent,
  ViroCollisionEvent,
  ViroPlatformInfo,
  ViroCameraTransformEvent,
  ViroPlatformUpdateEvent,
  ViroCameraTransform,
  ViroExitViroEvent,
  ViroErrorEvent,
  ViroAnimationStartEvent,
  ViroAnimationFinishEvent,
  ViroLoadStartEvent,
  ViroLoadEndEvent,
  ViroLoadErrorEvent,
  ViroVideoBufferStartEvent,
  ViroVideoBufferEndEvent,
  ViroVideoUpdateTimeEvent,
  ViroVideoErrorEvent,
  ViroVideoFinishEvent,
  ViroAnimatedComponentStartEvent,
  ViroAnimatedComponentFinishEvent,
  ViroARAnchorRemovedEvent,
  ViroARAnchorUpdatedEvent,
  ViroARAnchorFoundEvent,
  ViroAnchor,
  ViroAnchorFoundMap,
  ViroAnchorUpdatedMap,
  ViroPlaneUpdatedMap,
  ViroPlaneUpdatedEvent,
  ViroARPlaneSizes,
  ViroCameraARHitTestEvent,
  ViroCameraARHitTest,
  ViroARHitTestResult,
  ViroARPointCloudUpdateEvent,
  ViroARPointCloud,
  ViroTrackingUpdatedEvent,
  ViroTrackingState,
  ViroTrackingReason,
  ViroAmbientLightUpdateEvent,
  ViroAmbientLightInfo,
  ViroWorldOrigin,
  ViroNativeTransformUpdateEvent,
  ViroControllerStatusEvent,
  ViroControllerStatus,
  ViroPortalEnterEvent,
  ViroPortalExitEvent,
  ViroSoundFinishEvent,
  ViroPinchStateTypes,
  ViroClickStateTypes,
  ViroRotateStateTypes,
  // Provider Types
  ViroProvider,
  // Cloud Anchor Types
  ViroCloudAnchorState,
  ViroCloudAnchorProvider,
  ViroCloudAnchor,
  ViroHostCloudAnchorResult,
  ViroResolveCloudAnchorResult,
  ViroCloudAnchorStateChangeEvent,
  // Geospatial Types
  ViroGeospatialAnchorProvider,
  ViroEarthTrackingState,
  ViroVPSAvailability,
  ViroGeospatialAnchorType,
  ViroQuaternion,
  ViroGeospatialPose,
  ViroGeospatialAnchor,
  ViroGeospatialSupportResult,
  ViroEarthTrackingStateResult,
  ViroGeospatialPoseResult,
  ViroVPSAvailabilityResult,
  ViroCreateGeospatialAnchorResult,
  // Monocular Depth Estimation Types
  ViroMonocularDepthSupportResult,
  ViroMonocularDepthModelAvailableResult,
  ViroMonocularDepthPreferenceResult,
  // Quest / OpenXR Hand Tracking Types
  ViroJoint,
  ViroHandJoints,
  ViroHandPinchEvent,
  ViroHandUpdateEvent,
} from "./components/Types/ViroEvents";
import { ViroSurface } from "./components/ViroSurface";
import { ViroSceneNavigator } from "./components/ViroSceneNavigator";
import { VIRO_VERSION } from "./components/Utilities/ViroVersion";
import { ViroQuestEntryPoint } from "./components/ViroQuestEntryPoint";
import { VRQuestNavigatorBridge } from "./components/Utilities/VRQuestNavigatorBridge";
import { VRModuleOpenXR, useVRViewTag, exitVRScene } from "./components/Utilities/VRModuleOpenXR";
import type { VRModuleOpenXRType } from "./components/Utilities/VRModuleOpenXR";
import { StreamingAudioManager } from "./components/Utilities/StreamingAudioManager";
import { AppRegistry } from "react-native";

// Auto-register the Quest VR entry point. VRActivity launches this component
// as 'VRQuestScene'. Registering here means apps need no manual setup.
// Apps that need a custom VR root can re-register after importing this package.
AppRegistry.registerComponent("VRQuestScene", () => ViroQuestEntryPoint);

export {
  ViroARImageMarker,
  ViroARObjectMarker,
  ViroARTrackingTargets,
  ViroARPlane,
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroButton,
  ViroCamera,
  ViroController,
  ViroVirtualJoystick,
  ViroVirtualButton,
  ViroGameLoop,
  ViroGameLoopUtils,
  useGameLoop,
  useLateUpdate,
  useFixedUpdate,
  ViroDirectionalLight,
  ViroFlexView,
  ViroGeometry,
  ViroLightingEnvironment,
  ViroImage,
  ViroMaterials,
  ViroARCamera,
  ViroMaterialVideo,
  ViroCameraTexture,
  ViroObjectDetector,
  ViroNode,
  ViroOmniLight,
  ViroOrbitCamera,
  ViroParticleEmitter,
  ViroPolygon,
  ViroPolyline,
  ViroPortal,
  ViroPortalScene,
  ViroQuad,
  ViroScene,
  ViroSurface,
  ViroSceneNavigator,
  ViroSkyBox,
  ViroAnimations,
  Viro3DObject,
  Viro360Image,
  Viro360Video,
  ViroAnimatedImage,
  ViroAmbientLight,
  ViroAnimatedComponent,
  ViroSound,
  ViroSoundField,
  ViroSpatialSound,
  ViroSphere,
  ViroSpinner,
  ViroSpotLight,
  ViroText,
  ViroVideo,
  ViroVRSceneNavigator,
  ViroXRSceneNavigator,
  ViroQuestEntryPoint,
  // Quest bridge — for custom VR roots and VRModuleOpenXR viewTag access
  VRQuestNavigatorBridge,
  VRModuleOpenXR,
  useVRViewTag,
  exitVRScene,
  Viro3DSceneNavigator,
  // Streaming audio
  StreamingAudioManager,
  // Utilities
  hasOpenXRSupport,
  isQuest,
  useAnySourceHover,
  useAnySourcePressed,
  ViroARTrackingReasonConstants,
  ViroRecordingErrorConstants,
  ViroTrackingStateConstants,
  polarToCartesian,
  polarToCartesianActual,
  isARSupportedOnDevice,
  requestRequiredPermissions,
  checkPermissions,
  latLngToMercator,
  gpsToArWorld,
  // Types
  ViroARSupportResponse,
  ViroPermissionsResult,
  ViroPermission,
  ViroHoverEvent,
  ViroClickEvent,
  ViroClickStateEvent,
  ViroClickStateTypes,
  ViroTouchEvent,
  ViroScrollEvent,
  ViroSwipeEvent,
  ViroFuseEvent,
  ViroPinchEvent,
  ViroPinchStateTypes,
  ViroRotateEvent,
  ViroRotateStateTypes,
  ViroDragEvent,
  ViroPlatformEvent,
  ViroCollisionEvent,
  ViroPlatformInfo,
  ViroCameraTransformEvent,
  ViroPlatformUpdateEvent,
  ViroCameraTransform,
  ViroExitViroEvent,
  ViroErrorEvent,
  ViroAnimationStartEvent,
  ViroAnimationFinishEvent,
  ViroLoadStartEvent,
  ViroLoadEndEvent,
  ViroLoadErrorEvent,
  ViroVideoBufferStartEvent,
  ViroVideoBufferEndEvent,
  ViroVideoUpdateTimeEvent,
  ViroVideoErrorEvent,
  ViroVideoFinishEvent,
  ViroAnimatedComponentStartEvent,
  ViroAnimatedComponentFinishEvent,
  ViroARAnchorRemovedEvent,
  ViroARAnchorUpdatedEvent,
  ViroARAnchorFoundEvent,
  ViroAnchor,
  ViroAnchorFoundMap,
  ViroAnchorUpdatedMap,
  ViroPlaneUpdatedMap,
  ViroPlaneUpdatedEvent,
  ViroARPlaneSizes,
  ViroCameraARHitTestEvent,
  ViroCameraARHitTest,
  ViroARHitTestResult,
  ViroARPointCloudUpdateEvent,
  ViroARPointCloud,
  ViroTrackingUpdatedEvent,
  ViroTrackingState,
  ViroTrackingReason,
  ViroAmbientLightUpdateEvent,
  ViroAmbientLightInfo,
  ViroWorldOrigin,
  ViroNativeTransformUpdateEvent,
  ViroControllerStatusEvent,
  ViroControllerStatus,
  ViroPortalEnterEvent,
  ViroPortalExitEvent,
  ViroSoundFinishEvent,
  ViroTextStyle,
  ViroStyle,
  ViroMaterial,
  ViroShaderModifiers,
  ViroShaderUniform,
  ViroShaderModifier,
  VIRO_VERSION,
  // Provider Types
  ViroProvider,
  // Cloud Anchor Types
  ViroCloudAnchorState,
  ViroCloudAnchorProvider,
  ViroCloudAnchor,
  ViroHostCloudAnchorResult,
  ViroResolveCloudAnchorResult,
  ViroCloudAnchorStateChangeEvent,
  // Geospatial Types
  ViroGeospatialAnchorProvider,
  ViroEarthTrackingState,
  ViroVPSAvailability,
  ViroGeospatialAnchorType,
  ViroQuaternion,
  ViroGeospatialPose,
  ViroGeospatialAnchor,
  ViroGeospatialSupportResult,
  ViroEarthTrackingStateResult,
  ViroGeospatialPoseResult,
  ViroVPSAvailabilityResult,
  ViroCreateGeospatialAnchorResult,
  // Monocular Depth Estimation Types
  ViroMonocularDepthSupportResult,
  ViroMonocularDepthModelAvailableResult,
  ViroMonocularDepthPreferenceResult,
  // Quest / OpenXR Hand Tracking Types
  ViroJoint,
  ViroHandJoints,
  ViroHandPinchEvent,
  ViroHandUpdateEvent,
  // Studio Integration
  StudioSceneNavigator,
  StudioARScene,
  // VisionOS
  ViroVisionOSModule,
  isVisionOS,
  enterImmersiveSpace,
  exitImmersiveSpace,
};

export type { VRModuleOpenXRType };
export type { ImmersiveSpaceStyle } from "./components/VisionOS/ViroVisionOSModule";

export type {
  StudioSceneResponse,
  StudioAsset,
  StudioAnimation,
  StudioCollisionBinding,
  StudioSceneFunction,
  StudioSceneMeta,
  StudioProjectMeta,
} from "./components/Studio";
