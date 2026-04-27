/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARSceneNavigator
 * @flow
 */

"use strict";

import * as React from "react";
import {
  findNodeHandle,
  NativeModules,
  requireNativeComponent,
  StyleSheet,
  Text,
  View,
  ViewProps,
} from "react-native";
import { isQuest } from "../Utilities/ViroPlatform";
import {
  ViroWorldOrigin,
  ViroProvider,
  ViroCloudAnchorStateChangeEvent,
  ViroHostCloudAnchorResult,
  ViroResolveCloudAnchorResult,
  ViroGeospatialSupportResult,
  ViroEarthTrackingStateResult,
  ViroGeospatialPoseResult,
  ViroVPSAvailabilityResult,
  ViroCreateGeospatialAnchorResult,
  ViroQuaternion,
  ViroSemanticSupportResult,
  ViroSemanticLabelFractionsResult,
  ViroSemanticLabelFractionResult,
  ViroSemanticLabel,
  ViroMonocularDepthSupportResult,
  ViroMonocularDepthModelAvailableResult,
  ViroMonocularDepthPreferenceResult,
  ViroDepthOcclusionSupportResult,
  ViroGeospatialSetupStatusResult,
} from "../Types/ViroEvents";
import {
  Viro3DPoint,
  ViroNativeRef,
  ViroScene,
  ViroSceneDictionary,
} from "../Types/ViroUtils";
import {
  ViroWorldMeshConfig,
  ViroWorldMeshStats,
} from "../Types/ViroWorldMesh";

const ViroARSceneNavigatorModule = NativeModules.VRTARSceneNavigatorModule;

let mathRandomOffset = 0;

/**
 * Occlusion mode determines how virtual content is occluded by real-world objects.
 */
export type ViroOcclusionMode = "disabled" | "depthBased" | "peopleOnly";

type Props = ViewProps & {
  /**
   * ViroARSceneNavigator uses "scene" objects like the following to
   * describe a scene.
   */
  initialScene: {
    /**
     * The React Class to render for this scene.
     */
    scene: () => React.JSX.Element;
  };
  initialSceneKey?: string;

  /**
   * Optional fallback rendered when this navigator is mounted on a Meta Quest
   * device (where AR is not supported). When omitted, a default message view
   * is rendered. Pass `null` to render nothing.
   */
  questFallback?: React.ReactNode;

  autofocus?: boolean;
  /**
   * iOS only props! Note: these props may change as the underlying platforms coalesce in features.
   */
  worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";

  videoQuality?: "High" | "Low";
  numberOfTrackedImages?: number;
  viroAppProps?: any; // TODO: what is the type of this?
  /**
   * Renderer settings that can be used to enable or disable various
   * renderer capabilities and algorithms.
   */
  hdrEnabled?: boolean;
  pbrEnabled?: boolean;
  bloomEnabled?: boolean;
  shadowsEnabled?: boolean;
  multisamplingEnabled?: boolean;

  /**
   * Enable AR occlusion so real-world objects properly hide virtual content.
   * Requires a device with depth sensing capability.
   *
   * @default "disabled"
   */
  occlusionMode?: ViroOcclusionMode;

  /**
   * Enables depth sensing without activating occlusion rendering.
   * Virtual objects will NOT be occluded by real-world surfaces, but depth data
   * will be available for hit tests (DepthPoint type) and distance measurement.
   *
   * If occlusionMode="depthBased" is also set, occlusionMode takes precedence.
   *
   * Android: requires ARCore Depth API support (ARCore 1.18+).
   * iOS: uses LiDAR on supported devices, monocular depth estimator as fallback.
   *
   * @default false
   */
  depthEnabled?: boolean;

  /**
   * [Debug] Enable depth debug visualization to see how the depth texture is being sampled.
   * When enabled, the camera background will show a color overlay representing depth values:
   * - Magenta = No depth data
   * - Red = Very close (0-1m)
   * - Yellow = Medium (1-3m)
   * - Green = Medium-far (3-5m)
   * - Cyan = Far (5-10m)
   * - Blue = Very far (10m+)
   *
   * @default false
   */
  depthDebugEnabled?: boolean;

  /**
   * Enable semantic segmentation debug visualization. When enabled, the camera
   * background shows a color overlay for each real-world category (sky, building, tree,
   * road, sidewalk, terrain, structure, object, vehicle, person, water).
   * Requires `setSemanticModeEnabled(true)` to be called on the scene navigator first.
   *
   * @default false
   */
  semanticDebugEnabled?: boolean;

  /**
   * Confidence threshold (0.0–1.0) below which semantic labels are discarded (treated
   * as unlabeled = 0) before the texture is uploaded to the GPU. Higher values reduce
   * noise and boundary blinking at the cost of smaller labeled regions.
   *
   * Only used on Android (ARCore provides per-pixel confidence). On iOS, ARKit's
   * segmentation is already temporally smoothed by the OS.
   *
   * @default 0.0
   */
  semanticConfidenceThreshold?: number;

  /**
   * [iOS Only] Prefer monocular depth estimation over LiDAR.
   * When true, monocular depth will be used even on devices with LiDAR.
   *
   * Monocular depth is automatically used on non-LiDAR devices when depth-based
   * occlusion is enabled. This prop allows forcing monocular depth on LiDAR devices.
   *
   * Useful for:
   * - Consistency across all device types (same depth method)
   * - Testing/comparison purposes
   * - Extended range beyond LiDAR's ~5m limit
   *
   * Requires:
   * - iOS 14.0+
   * - Neural Engine (A12 Bionic or newer)
   * - DepthPro.mlmodelc bundled in ViroKit
   *
   * @default false
   * @platform ios
   */
  preferMonocularDepth?: boolean;

  /**
   * Cloud and geospatial anchor provider.
   * Set to `"reactvision"` (default) for the ReactVision backend,
   * `"arcore"` for Google Cloud Anchors, or `"none"` to disable.
   *
   * Replaces the old `cloudAnchorProvider` / `geospatialAnchorProvider` props,
   * which are now deprecated. Both providers are set to the same value.
   *
   * @default "reactvision"
   * @platform ios,android
   */
  provider?: ViroProvider;

  /**
   * Callback fired when a cloud anchor state changes.
   * This includes progress updates during hosting/resolving operations.
   */
  onCloudAnchorStateChange?: (event: ViroCloudAnchorStateChangeEvent) => void;

  /**
   * Enable world mesh for physics collision with real-world surfaces.
   * When enabled, virtual physics objects will collide with detected
   * real-world geometry (floors, walls, tables, etc.).
   *
   * Requires depth sensing capability:
   * - iOS: LiDAR scanner (iPhone 12 Pro+, iPad Pro 2020+)
   * - Android: ToF sensor or ARCore Depth API support
   *
   * @default false
   * @platform ios,android
   */
  worldMeshEnabled?: boolean;

  /**
   * Configuration for world mesh generation and physics properties.
   * Only used when worldMeshEnabled is true.
   */
  worldMeshConfig?: ViroWorldMeshConfig;

  /**
   * Callback fired when the world mesh is updated.
   * Provides statistics about the current mesh state.
   */
  onWorldMeshUpdated?: (stats: ViroWorldMeshStats) => void;
};

type State = {
  sceneDictionary: ViroSceneDictionary;
  sceneHistory: string[];
  currentSceneIndex: number;
  // Internal key for forcing remount on Android tab switches
  internalRemountKey: number;
};

/**
 * ViroARSceneNavigator is used to transition between multiple AR Scenes.
 */
export class ViroARSceneNavigator extends React.Component<Props, State> {
  static _questWarningLogged = false;
  _component: ViroNativeRef = null;

  constructor(props: Props) {
    super(props);
    let initialSceneTag = this.props.initialSceneKey;
    if (initialSceneTag == null) {
      initialSceneTag = this.getRandomTag();
    }
    const scene = {
      sceneClass: this.props.initialScene,
      tag: initialSceneTag,
      referenceCount: 1,
    };
    const sceneDict: ViroSceneDictionary = {};
    sceneDict[scene.tag] = scene;
    this.state = {
      sceneDictionary: sceneDict,
      sceneHistory: [scene.tag],
      currentSceneIndex: 0,
      internalRemountKey: 0,
    };
  }

  componentDidMount() {
    // Apply initial prefer monocular depth setting if provided
    if (this.props.preferMonocularDepth !== undefined) {
      this._setPreferMonocularDepth(this.props.preferMonocularDepth);
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Handle monocular depth preference prop changes
    if (
      this.props.preferMonocularDepth !== undefined &&
      prevProps.preferMonocularDepth !== this.props.preferMonocularDepth
    ) {
      this._setPreferMonocularDepth(this.props.preferMonocularDepth);
    }
  }

  /**
   * [Android Only - Internal]
   * Handle tab switch detection from native side.
   * This is called automatically when the native view detects it was reattached
   * to the window after being detached (tab switching scenario).
   */
  _onTabSwitch = () => {
    if (require('react-native').Platform.OS === 'android') {
      // Increment internal key to force a remount with fresh GL context
      this.setState((prevState) => ({
        internalRemountKey: prevState.internalRemountKey + 1,
      }));
    }
  };

  componentWillUnmount() {
    // Explicitly trigger native cleanup to prevent memory leaks
    // This ensures ARSession is properly paused and GL resources are released
    const nodeHandle = findNodeHandle(this);
    if (nodeHandle) {
      ViroARSceneNavigatorModule.cleanup(nodeHandle);
    }
  }

  /**
   * Starts recording video of the Viro renderer and external audio
   *
   * @param fileName - name of the file (without extension)
   * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
   * @param onError - callback function that accepts an errorCode.
   */
  _startVideoRecording = (
    fileName: string,
    saveToCameraRoll: boolean,
    // TODO: What are the errorCodes? make a type for this
    onError: (errorCode: number) => void
  ) => {
    ViroARSceneNavigatorModule.startVideoRecording(
      findNodeHandle(this),
      fileName,
      saveToCameraRoll,
      onError
    );
  };

  /**
   * Stops recording the video of the Viro Renderer.
   *
   * returns Object w/ success, url and errorCode keys.
   * @returns Promise that resolves when the video has stopped recording.
   */
  _stopVideoRecording = async () => {
    return await ViroARSceneNavigatorModule.stopVideoRecording(
      findNodeHandle(this)
    );
  };

  /**
   * Takes a screenshot of the Viro renderer
   *
   * @param fileName - name of the file (without extension)
   * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
   * returns Object w/ success, url and errorCode keys.
   */
  _takeScreenshot = async (fileName: string, saveToCameraRoll: boolean) => {
    return await ViroARSceneNavigatorModule.takeScreenshot(
      findNodeHandle(this),
      fileName,
      saveToCameraRoll
    );
  };

  /**
   * @todo document _project
   *
   * @param point
   * @returns
   */
  _project = async (point: Viro3DPoint) => {
    return await ViroARSceneNavigatorModule.project(
      findNodeHandle(this),
      point
    );
  };

  /**
   * TODO: Document _unproject
   *
   * @param point
   * @returns
   */
  _unproject = async (point: Viro3DPoint) => {
    return await ViroARSceneNavigatorModule.unproject(
      findNodeHandle(this),
      point
    );
  };

  /**
   * Gets a random tag string.
   *
   * @returns a random tag.
   */
  getRandomTag = () => {
    const randomTag = Math.random() + mathRandomOffset;
    mathRandomOffset++;
    return randomTag.toString();
  };

  /**
   * Pushes a scene and reference it with the given key if provided.
   * If the scene has been previously pushed, we simply show the scene again.
   * Note that the back history order of which scenes were pushed is preserved.
   * Also note that scenes are reference counted and only a unique set of
   * scenes are stored and mapped to within sceneDictionary.
   *
   * Can take in either 1 or two parameters in the form:
   * push ("sceneKey");
   * push ("sceneKey", scene);
   * push (scene);
   *
   * @todo use Typescript function overloading rather than this inaccurate solution
   * @todo document parameters
   */
  push = (param1?: ViroScene | string, param2?: ViroScene) => {
    let sceneKey = undefined;
    let scene = undefined;
    if (typeof param1 == "string") {
      sceneKey = param1;
      scene = param2;
    } else {
      scene = param1;
    }

    if (scene == undefined && sceneKey == undefined) {
      console.log(
        "ERROR: pushing requires either the scene tag, or both the tag and scene."
      );
      return;
    } else if (
      scene == undefined &&
      sceneKey != undefined &&
      !(sceneKey in this.state.sceneDictionary)
    ) {
      console.log(
        "ERROR: Cannot push with a new sceneKey with no associated scene."
      );
      return;
    }

    if (
      sceneKey == undefined ||
      (typeof sceneKey == "string" && sceneKey.trim().length <= 0)
    ) {
      sceneKey = this.getRandomTag();
    }

    this.incrementSceneReference(scene as ViroScene, sceneKey, false);
    this.addToHistory(sceneKey);
  };

  /**
   * Replace the top scene in the stack with the given scene. The remainder of the back
   * history is kept in the same order as before.
   *
   * Can take in either 1 or two parameters in the form:
   * replace ("sceneKey");
   * replace ("sceneKey", scene);
   * replace (scene);
   *
   * @todo use Typescript function overloading rather than this inaccurate solution
   * @todo document parameters
   */
  replace = (param1?: ViroScene | string, param2?: ViroScene) => {
    let sceneKey = undefined;
    let scene = undefined;
    if (typeof param1 == "string") {
      sceneKey = param1;
      scene = param2;
    } else {
      scene = param1;
    }

    if (scene == undefined && sceneKey == undefined) {
      console.log(
        "ERROR: replacing requires either the scene tag, or both the tag and scene."
      );
      return;
    } else if (
      scene == undefined &&
      sceneKey != undefined &&
      !(sceneKey in this.state.sceneDictionary)
    ) {
      console.log(
        "ERROR: Cannot replace with a new sceneKey with no associated scene."
      );
      return;
    }

    if (
      sceneKey == undefined ||
      (typeof sceneKey == "string" && sceneKey.trim().length <= 0)
    ) {
      sceneKey = this.getRandomTag();
    }

    // Pop 1 off the scene history (do not use popN because in this case we allow
    // popping the root), then push this scene
    this.decrementReferenceForLastNScenes(1);
    this.popHistoryByN(1);
    this.incrementSceneReference(scene as ViroScene, sceneKey, false);
    this.addToHistory(sceneKey);
  };

  /**
   * Jumps to a given scene that had been previously pushed. If the scene was not pushed, we
   * then push and jump to it. The back history is re-ordered such that jumped to scenes are
   * re-ordered to the front. As such, only the back order of sequential jumps are preserved.
   *
   * Can take in either 1 or two parameters in the form:
   * jump ("sceneKey");
   * jump ("sceneKey", scene);
   * jump (scene);
   *
   * @todo use Typescript function overloading rather than this inaccurate solution
   * @todo document parameters
   */
  jump = (param1?: ViroScene | string, param2?: ViroScene) => {
    let sceneKey = undefined;
    let scene = undefined;
    if (typeof param1 == "string") {
      sceneKey = param1;
      scene = param2;
    } else {
      scene = param1;
    }

    if (scene == undefined && sceneKey == undefined) {
      console.log(
        "ERROR: jumping requires either the scene tag, or both the tag and scene."
      );
      return;
    } else if (
      scene == undefined &&
      sceneKey != undefined &&
      !(sceneKey in this.state.sceneDictionary)
    ) {
      console.log(
        "ERROR: Cannot jump with a new sceneKey with no associated scene."
      );
      return;
    }

    if (
      sceneKey == undefined ||
      (typeof sceneKey == "string" && sceneKey.trim().length <= 0)
    ) {
      sceneKey = this.getRandomTag();
    }

    this.incrementSceneReference(scene as ViroScene, sceneKey, true);
    this.reorderHistory(sceneKey);
  };

  /**
   * Pop 1 screen from the stack.
   */
  pop = () => {
    this.popN(1);
  };

  /**
   * Pop n screens from the stack.
   *
   * @param n number of scenes to pop
   * @returns void
   */
  popN = (n: number) => {
    if (n === 0) {
      return;
    }

    if (this.state.sceneHistory.length - n <= 0) {
      console.log(
        "WARN: Attempted to pop the root scene in ViroARSceneNavigator!"
      );
      return;
    }

    this.decrementReferenceForLastNScenes(n);
    this.popHistoryByN(n);
  };

  /**
   * Increments the reference count for a scene within sceneDictionary that is
   * mapped to the given sceneKey. If no scenes are found / mapped, we create
   * one, initialize it with a reference count of 1, and store it within the
   * sceneDictionary for future reference.
   *
   * @todo TODO: Document parameters.
   */
  incrementSceneReference = (
    scene: ViroScene,
    sceneKey: string,
    limitOne: boolean
  ) => {
    const currentSceneDictionary = this.state.sceneDictionary;
    if (!(sceneKey in currentSceneDictionary)) {
      const newScene = {
        sceneClass: scene,
        tag: sceneKey,
        referenceCount: 0,
      };
      currentSceneDictionary[sceneKey] = newScene;
    }

    // Error out if there are no scenes matching the given sceneKey
    const currentScene = currentSceneDictionary[sceneKey];
    if (currentScene == null || currentScene == undefined) {
      console.log("ERROR: No scene found for: " + sceneKey);
      return;
    }

    // Update the scene's reference count and then the sceneDictionary
    if ((limitOne && currentScene.referenceCount < 1) || !limitOne) {
      currentScene.referenceCount++;
    }

    currentSceneDictionary[sceneKey] = currentScene;

    // Finally update all states
    this.setState({
      sceneDictionary: currentSceneDictionary,
    });
  };

  /**
   * Decrements the reference count for the last N scenes within
   * the sceneHistory by 1. If nothing else references that given scene
   * (counts equals 0), we then remove that scene from sceneDictionary.
   *
   * @param n number to decrement by.
   */
  decrementReferenceForLastNScenes = (n: number) => {
    const { sceneHistory, sceneDictionary } = this.state;

    // Now update and release any reference counts
    for (let i = 1; i <= n; i++) {
      const sceneTag = sceneHistory[sceneHistory.length - i];
      const scene = sceneDictionary[sceneTag];
      scene.referenceCount--;

      if (scene.referenceCount <= 0) {
        delete sceneDictionary[sceneTag];
      } else {
        sceneDictionary[sceneTag] = scene;
      }
    }

    // Finally update all states
    this.setState({
      sceneDictionary: sceneDictionary,
    });
  };

  /**
   * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
   * to the scene on the top of the history stack (the most recent scene).
   *
   * @param sceneKey scene to insert into the stack.
   */
  addToHistory = (sceneKey: string) => {
    const updatedHistory = this.state.sceneHistory.concat([sceneKey]);
    const currentIndex = this.getSceneIndex(sceneKey);
    this.setState({
      currentSceneIndex: currentIndex,
      sceneHistory: updatedHistory,
    });
  };

  /**
   * Instead of preserving history, we find the last pushed sceneKey within the history stack
   * matching the given sceneKey and re-order it to the front. We then update the
   * currentSceneIndex to point to the scene on the top of the history stack
   * (the most recent scene).
   *
   * @param sceneKey scene to put at the top of the stack.
   */
  reorderHistory = (sceneKey: string) => {
    // Find the last sceneKey within sceneHistory and remove it.
    const { sceneHistory } = this.state;
    for (let i = sceneHistory.length - 1; i >= 0; i--) {
      if (sceneKey == sceneHistory[i]) {
        sceneHistory.splice(i, 1);
        break;
      }
    }

    // Add back the sceneKey to the front of the History stack.
    const updatedHistory = sceneHistory.concat([sceneKey]);
    const currentIndex = this.getSceneIndex(sceneKey);
    this.setState({
      currentSceneIndex: currentIndex,
      sceneHistory: updatedHistory,
    });
  };

  /**
   * Pops the history entries by n screens.
   *
   * @param n number of history entries to pop.
   */
  popHistoryByN(n: number) {
    const { sceneHistory } = this.state;
    sceneHistory.splice(sceneHistory.length - n, n);
    const currentIndex = this.getSceneIndex(
      sceneHistory[sceneHistory.length - 1]
    );

    // Finally update all states
    this.setState({
      currentSceneIndex: currentIndex,
      sceneHistory: sceneHistory,
    });
  }

  /**
   * Gets the index of a scene by the scene tag.
   *
   * @param sceneTag tag of the scene
   * @returns the index of the scene
   */
  getSceneIndex = (sceneTag: string) => {
    const { sceneDictionary } = this.state;
    let i = 0;
    for (const sceneKey in sceneDictionary) {
      if (sceneTag == sceneDictionary[sceneKey].tag) {
        return i;
      }
      i++;
    }
    // Unable to find the given sceneTag, return -1
    return -1;
  };

  /**
   * [iOS Only]
   *
   * Resets the tracking of the AR session.
   *
   * @param resetTracking - determines if the tracking should be reset.
   * @param removeAnchors - determines if the existing anchors should be removed too.
   */
  _resetARSession = (resetTracking: any, removeAnchors: any) => {
    ViroARSceneNavigatorModule.resetARSession(
      findNodeHandle(this),
      resetTracking,
      removeAnchors
    );
  };

  /**
   * [iOS/ARKit 1.5+ Only]
   *
   * Allows the developer to offset the current world orgin
   * by the given transformation matrix. ie. if this is called twice with the
   * position [0, 0, 1], then current world origin will be at [0, 0, 2] from its
   * initial position (it's additive, not meant to replace the existing origin)
   *
   * @param worldOrigin - a dictionary that can contain a `position` and `rotation` key with an
   *  array containing 3 floats (note: rotation is in degrees).
   */
  _setWorldOrigin = (worldOrigin: ViroWorldOrigin) => {
    ViroARSceneNavigatorModule.setWorldOrigin(
      findNodeHandle(this),
      worldOrigin
    );
  };

  /**
   * Host a local anchor to the cloud for cross-platform sharing.
   *
   * The anchor must already exist in the AR session (e.g., created from a hit test
   * or plane detection). Once hosted, the returned cloudAnchorId can be shared
   * with other devices to resolve the same anchor.
   *
   * @param anchorId - The local anchor ID to host (from ViroAnchor.anchorId)
   * @param ttlDays - Time-to-live in days (1-365). Default: 1 day.
   *                  Note: TTL > 1 requires keyless authorization on Google Cloud.
   * @returns Promise resolving to the hosting result with cloudAnchorId
   */
  _hostCloudAnchor = async (
    anchorId: string,
    ttlDays: number = 1
  ): Promise<ViroHostCloudAnchorResult> => {
    return await ViroARSceneNavigatorModule.hostCloudAnchor(
      findNodeHandle(this),
      anchorId,
      Math.max(1, Math.min(365, ttlDays)) // Clamp to valid range
    );
  };

  /**
   * Resolve a cloud anchor by its ID.
   *
   * Once resolved, the anchor will be added to the AR session and can be used
   * to place virtual content at the same real-world location as the original
   * hosted anchor (even on a different device).
   *
   * @param cloudAnchorId - The cloud anchor ID to resolve (from hostCloudAnchor result)
   * @returns Promise resolving to the anchor data
   */
  _resolveCloudAnchor = async (
    cloudAnchorId: string
  ): Promise<ViroResolveCloudAnchorResult> => {
    return await ViroARSceneNavigatorModule.resolveCloudAnchor(
      findNodeHandle(this),
      cloudAnchorId
    );
  };

  /**
   * Cancel all pending cloud anchor operations.
   * Use this when exiting a scene or when cloud operations are no longer needed.
   */
  _cancelCloudAnchorOperations = () => {
    ViroARSceneNavigatorModule.cancelCloudAnchorOperations(
      findNodeHandle(this)
    );
  };

  // ===========================================================================
  // Geospatial API Methods
  // ===========================================================================

  /**
   * Check if geospatial mode is supported on this device.
   *
   * @returns Promise resolving to support status
   */
  _isGeospatialModeSupported =
    async (): Promise<ViroGeospatialSupportResult> => {
      return await ViroARSceneNavigatorModule.isGeospatialModeSupported(
        findNodeHandle(this)
      );
    };

  /**
   * Enable or disable geospatial mode.
   * When enabled, the session will track the device's position relative to the Earth.
   *
   * @param enabled - Whether to enable geospatial mode
   */
  _setGeospatialModeEnabled = (enabled: boolean) => {
    ViroARSceneNavigatorModule.setGeospatialModeEnabled(
      findNodeHandle(this),
      enabled
    );
  };

  /**
   * Get the current Earth tracking state.
   *
   * @returns Promise resolving to the current tracking state
   */
  _getEarthTrackingState = async (): Promise<ViroEarthTrackingStateResult> => {
    return await ViroARSceneNavigatorModule.getEarthTrackingState(
      findNodeHandle(this)
    );
  };

  /**
   * Get the camera's current geospatial pose (latitude, longitude, altitude, etc.)
   *
   * @returns Promise resolving to the camera's geospatial pose
   */
  _getCameraGeospatialPose = async (): Promise<ViroGeospatialPoseResult> => {
    return await ViroARSceneNavigatorModule.getCameraGeospatialPose(
      findNodeHandle(this)
    );
  };

  /**
   * Check VPS (Visual Positioning System) availability at a specific location.
   * VPS provides enhanced accuracy in supported locations.
   *
   * @param latitude - Latitude in degrees
   * @param longitude - Longitude in degrees
   * @returns Promise resolving to VPS availability status
   */
  _checkVPSAvailability = async (
    latitude: number,
    longitude: number
  ): Promise<ViroVPSAvailabilityResult> => {
    return await ViroARSceneNavigatorModule.checkVPSAvailability(
      findNodeHandle(this),
      latitude,
      longitude
    );
  };

  /**
   * Create a WGS84 geospatial anchor at the specified location.
   * The anchor is positioned using absolute coordinates on the WGS84 ellipsoid.
   *
   * @param latitude - Latitude in degrees
   * @param longitude - Longitude in degrees
   * @param altitude - Altitude in meters above the WGS84 ellipsoid
   * @param quaternion - Orientation quaternion [x, y, z, w] in EUS frame (optional, defaults to facing north)
   * @returns Promise resolving to the created anchor
   */
  _createGeospatialAnchor = async (
    latitude: number,
    longitude: number,
    altitude: number,
    quaternion?: ViroQuaternion
  ): Promise<ViroCreateGeospatialAnchorResult> => {
    return await ViroARSceneNavigatorModule.createGeospatialAnchor(
      findNodeHandle(this),
      latitude,
      longitude,
      altitude,
      quaternion || [0, 0, 0, 1]
    );
  };

  /**
   * Create a terrain anchor at the specified location.
   * The anchor is positioned relative to the terrain surface.
   *
   * @param latitude - Latitude in degrees
   * @param longitude - Longitude in degrees
   * @param altitudeAboveTerrain - Altitude in meters above terrain
   * @param quaternion - Orientation quaternion [x, y, z, w] in EUS frame (optional)
   * @returns Promise resolving to the created anchor
   */
  _createTerrainAnchor = async (
    latitude: number,
    longitude: number,
    altitudeAboveTerrain: number,
    quaternion?: ViroQuaternion
  ): Promise<ViroCreateGeospatialAnchorResult> => {
    return await ViroARSceneNavigatorModule.createTerrainAnchor(
      findNodeHandle(this),
      latitude,
      longitude,
      altitudeAboveTerrain,
      quaternion || [0, 0, 0, 1]
    );
  };

  /**
   * Create a rooftop anchor at the specified location.
   * The anchor is positioned relative to a building rooftop.
   *
   * @param latitude - Latitude in degrees
   * @param longitude - Longitude in degrees
   * @param altitudeAboveRooftop - Altitude in meters above rooftop
   * @param quaternion - Orientation quaternion [x, y, z, w] in EUS frame (optional)
   * @returns Promise resolving to the created anchor
   */
  _createRooftopAnchor = async (
    latitude: number,
    longitude: number,
    altitudeAboveRooftop: number,
    quaternion?: ViroQuaternion
  ): Promise<ViroCreateGeospatialAnchorResult> => {
    return await ViroARSceneNavigatorModule.createRooftopAnchor(
      findNodeHandle(this),
      latitude,
      longitude,
      altitudeAboveRooftop,
      quaternion || [0, 0, 0, 1]
    );
  };

  /**
   * Remove a geospatial anchor from the session.
   *
   * @param anchorId - The ID of the anchor to remove
   */
  _removeGeospatialAnchor = (anchorId: string) => {
    ViroARSceneNavigatorModule.removeGeospatialAnchor(
      findNodeHandle(this),
      anchorId
    );
  };

  /**
   * ReactVision — save GPS coordinates to the backend and return a cross-device shareable UUID.
   * Does NOT create a local AR anchor — call createGeospatialAnchor separately for AR placement.
   *
   * @param latitude     WGS84 latitude
   * @param longitude    WGS84 longitude
   * @param altitude     Altitude in metres
   * @param altitudeMode "street_level" (default) or "rooftop_level"
   * @returns Promise resolving to { success, anchorId } where anchorId is the platform UUID
   */
  _hostGeospatialAnchor = async (
    latitude: number,
    longitude: number,
    altitude: number,
    altitudeMode?: string
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.hostGeospatialAnchor(
      findNodeHandle(this),
      latitude,
      longitude,
      altitude,
      altitudeMode || "street_level"
    );
  };

  /**
   * ReactVision — fetch GPS coordinates from the backend by platform UUID and create a local AR anchor.
   * Combines rvGetGeospatialAnchor + createGeospatialAnchor into a single call.
   *
   * @param platformUuid UUID returned by hostGeospatialAnchor
   * @param quaternion   Orientation [x, y, z, w] (default identity)
   * @returns Promise resolving to { success, anchor: { anchorId, latitude, longitude, altitude } }
   */
  _resolveGeospatialAnchor = async (
    platformUuid: string,
    quaternion?: ViroQuaternion
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.resolveGeospatialAnchor(
      findNodeHandle(this),
      platformUuid,
      quaternion || [0, 0, 0, 1]
    );
  };

  /**
   * ReactVision — fetch a geospatial anchor record by UUID.
   * Returns the anchor with linked scene asset data (position, rotation, scale, fileUrl).
   */
  _rvGetGeospatialAnchor = async (anchorId: string): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvGetGeospatialAnchor(
      findNodeHandle(this),
      anchorId
    );
  };

  /**
   * ReactVision — find geospatial anchors near a GPS location.
   * @param latitude  Centre latitude
   * @param longitude Centre longitude
   * @param radius    Search radius in metres (default 500)
   * @param limit     Max results (default 50)
   */
  _rvFindNearbyGeospatialAnchors = async (
    latitude: number,
    longitude: number,
    radius: number = 500,
    limit: number = 50
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvFindNearbyGeospatialAnchors(
      findNodeHandle(this),
      latitude,
      longitude,
      radius,
      limit
    );
  };

  /**
   * ReactVision — update a geospatial anchor (link scene asset, scene, or rename).
   * Pass null/empty string to leave a field unchanged.
   */
  _rvUpdateGeospatialAnchor = async (
    anchorId: string,
    sceneAssetId?: string,
    sceneId?: string,
    name?: string,
    userAssetId?: string
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvUpdateGeospatialAnchor(
      findNodeHandle(this),
      anchorId,
      sceneAssetId ?? "",
      sceneId ?? "",
      name ?? "",
      userAssetId ?? ""
    );
  };

  _rvUploadAsset = async (
    filePath: string,
    assetType: string,
    fileName: string,
    appUserId?: string
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvUploadAsset(
      findNodeHandle(this),
      filePath,
      assetType,
      fileName,
      appUserId ?? ""
    );
  };

  /**
   * ReactVision — permanently delete a geospatial anchor from the backend.
   */
  _rvDeleteGeospatialAnchor = async (anchorId: string): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvDeleteGeospatialAnchor(
      findNodeHandle(this),
      anchorId
    );
  };

  _rvListGeospatialAnchors = async (limit: number, offset: number): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvListGeospatialAnchors(
      findNodeHandle(this), limit, offset
    );
  };

  // ===========================================================================
  // Cloud Anchor Management API Methods
  // ===========================================================================

  _rvGetCloudAnchor = async (anchorId: string): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvGetCloudAnchor(findNodeHandle(this), anchorId);
  };

  _rvListCloudAnchors = async (limit: number, offset: number): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvListCloudAnchors(findNodeHandle(this), limit, offset);
  };

  _rvUpdateCloudAnchor = async (
    anchorId: string,
    name: string,
    description: string,
    isPublic: boolean
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvUpdateCloudAnchor(
      findNodeHandle(this), anchorId, name, description, isPublic
    );
  };

  _rvDeleteCloudAnchor = async (anchorId: string): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvDeleteCloudAnchor(findNodeHandle(this), anchorId);
  };

  _rvFindNearbyCloudAnchors = async (
    latitude: number,
    longitude: number,
    radius: number,
    limit: number
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvFindNearbyCloudAnchors(
      findNodeHandle(this), latitude, longitude, radius, limit
    );
  };

  _rvGetScene = async (sceneId: string): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvGetScene(
      findNodeHandle(this), sceneId
    );
  };

  _rvGetSceneAssets = async (sceneId: string): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvGetSceneAssets(
      findNodeHandle(this), sceneId
    );
  };

  _rvAttachAssetToCloudAnchor = async (
    anchorId: string,
    fileUrl: string,
    fileSize: number,
    name: string,
    assetType: string,
    externalUserId: string
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvAttachAssetToCloudAnchor(
      findNodeHandle(this), anchorId, fileUrl, fileSize, name, assetType, externalUserId
    );
  };

  _rvRemoveAssetFromCloudAnchor = async (anchorId: string, assetId: string): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvRemoveAssetFromCloudAnchor(
      findNodeHandle(this), anchorId, assetId
    );
  };

  _rvTrackCloudAnchorResolution = async (
    anchorId: string,
    success: boolean,
    confidence: number,
    matchCount: number,
    inlierCount: number,
    processingTimeMs: number,
    platform: string,
    externalUserId: string
  ): Promise<any> => {
    return await ViroARSceneNavigatorModule.rvTrackCloudAnchorResolution(
      findNodeHandle(this), anchorId, success, confidence, matchCount,
      inlierCount, processingTimeMs, platform, externalUserId
    );
  };

  // ===========================================================================
  // Scene Semantics API Methods
  // ===========================================================================

  /**
   * Check if Scene Semantics mode is supported on this device.
   * Scene Semantics uses ML to classify each pixel in the camera feed
   * into categories like sky, building, tree, road, etc.
   *
   * @returns Promise resolving to support status
   */
  _isSemanticModeSupported = async (): Promise<ViroSemanticSupportResult> => {
    return await ViroARSceneNavigatorModule.isSemanticModeSupported(
      findNodeHandle(this)
    );
  };

  /**
   * Enable or disable Scene Semantics mode.
   * When enabled, the session will process each frame to generate
   * semantic labels for each pixel.
   *
   * @param enabled - Whether to enable semantic mode
   */
  _setSemanticModeEnabled = (enabled: boolean) => {
    ViroARSceneNavigatorModule.setSemanticModeEnabled(
      findNodeHandle(this),
      enabled
    );
  };

  /**
   * Get the fraction of pixels for each semantic label in the current frame.
   * Returns a dictionary with label names as keys and fractions (0.0-1.0) as values.
   *
   * Available labels: unlabeled, sky, building, tree, road, sidewalk,
   * terrain, structure, object, vehicle, person, water
   *
   * @returns Promise resolving to semantic label fractions
   */
  _getSemanticLabelFractions =
    async (): Promise<ViroSemanticLabelFractionsResult> => {
      return await ViroARSceneNavigatorModule.getSemanticLabelFractions(
        findNodeHandle(this)
      );
    };

  /**
   * Get the fraction of pixels for a specific semantic label.
   *
   * @param label - The semantic label name (e.g., "sky", "building", "road")
   * @returns Promise resolving to the fraction of pixels with that label
   */
  _getSemanticLabelFraction = async (
    label: ViroSemanticLabel
  ): Promise<ViroSemanticLabelFractionResult> => {
    return await ViroARSceneNavigatorModule.getSemanticLabelFraction(
      findNodeHandle(this),
      label
    );
  };

  // ===========================================================================
  // Monocular Depth Estimation API Methods
  // ===========================================================================

  /**
   * Set whether to prefer monocular depth estimation over LiDAR.
   * When enabled, monocular depth will be used even on devices with LiDAR.
   * Useful for:
   * - Consistency across device types
   * - Testing/comparison purposes
   * - Getting depth estimates beyond LiDAR's ~5m range
   *
   * @param prefer - Whether to prefer monocular depth over LiDAR
   */
  _setPreferMonocularDepth = (prefer: boolean) => {
    const nodeHandle = findNodeHandle(this);
    if (!nodeHandle) {
      console.warn(
        "Cannot set monocular depth preference: Component not mounted - ensure ViroARSceneNavigator is rendered and visible"
      );
      return;
    }
    ViroARSceneNavigatorModule.setPreferMonocularDepth(nodeHandle, prefer);
  };

  /**
   * Check if monocular depth is preferred over LiDAR.
   *
   * @returns Promise resolving to preference status
   */
  _isPreferMonocularDepth =
    async (): Promise<ViroMonocularDepthPreferenceResult> => {
      try {
        const nodeHandle = findNodeHandle(this);
        if (!nodeHandle) {
          return {
            preferred: false,
            error:
              "Component not mounted - ensure ViroARSceneNavigator is rendered and visible",
          };
        }
        const result =
          await ViroARSceneNavigatorModule.isPreferMonocularDepth(nodeHandle);
        return result;
      } catch (error) {
        return {
          preferred: false,
          error: `Failed to check monocular depth preference: ${error}`,
        };
      }
    };

  // ===========================================================================
  // Debugging & Validation Methods
  // ===========================================================================

  /**
   * Check if depth-based occlusion is supported on this device.
   * Requires:
   * - Android: ARCore 1.18+ with depth support
   * - iOS: Always supported (uses monocular depth + LiDAR)
   *
   * @returns Promise resolving to depth occlusion support status and requirements
   */
  _isDepthOcclusionSupported =
    async (): Promise<ViroDepthOcclusionSupportResult> => {
      try {
        const nodeHandle = findNodeHandle(this);
        if (!nodeHandle) {
          return {
            supported: false,
            error:
              "Component not mounted - ensure ViroARSceneNavigator is rendered and visible",
          };
        }
        const result =
          await ViroARSceneNavigatorModule.isDepthOcclusionSupported(
            nodeHandle
          );
        return result;
      } catch (error) {
        return {
          supported: false,
          error: `Failed to check depth occlusion support: ${error}`,
        };
      }
    };

  /**
   * Check geospatial mode setup status and prerequisites.
   * Validates:
   * - Geospatial API support on device
   * - Location services availability
   * - Google Cloud API key configuration (Android)
   *
   * @returns Promise resolving to geospatial setup status with error details
   */
  _getGeospatialSetupStatus =
    async (): Promise<ViroGeospatialSetupStatusResult> => {
      try {
        const nodeHandle = findNodeHandle(this);
        if (!nodeHandle) {
          return {
            geospatialSupported: false,
            locationServicesAvailable: false,
            apiKeyConfigured: false,
            error:
              "Component not mounted - ensure ViroARSceneNavigator is rendered and visible",
          };
        }
        const result =
          await ViroARSceneNavigatorModule.getGeospatialSetupStatus(nodeHandle);
        return result;
      } catch (error) {
        return {
          geospatialSupported: false,
          locationServicesAvailable: false,
          apiKeyConfigured: false,
          error: `Failed to check geospatial setup: ${error}`,
        };
      }
    };

  /**
   * Renders the Scene Views in the stack.
   *
   * @returns Array of rendered Scene views.
   */
  _renderSceneStackItems = () => {
    let views = [];
    let i = 0;
    const { sceneDictionary } = this.state;
    for (const scene in sceneDictionary) {
      const Component = sceneDictionary[scene].sceneClass.scene;
      const props = sceneDictionary[scene].sceneClass.passProps;
      views.push(
        <Component
          key={"scene" + i}
          sceneNavigator={this.sceneNavigator}
          {...props}
          arSceneNavigator={this.arSceneNavigator}
          {...props}
        />
      );
      i++;
    }
    return views;
  };

  arSceneNavigator = {
    push: this.push,
    pop: this.pop,
    popN: this.popN,
    jump: this.jump,
    replace: this.replace,
    startVideoRecording: this._startVideoRecording,
    stopVideoRecording: this._stopVideoRecording,
    takeScreenshot: this._takeScreenshot,
    resetARSession: this._resetARSession,
    setWorldOrigin: this._setWorldOrigin,
    project: this._project,
    unproject: this._unproject,
    hostCloudAnchor: this._hostCloudAnchor,
    resolveCloudAnchor: this._resolveCloudAnchor,
    cancelCloudAnchorOperations: this._cancelCloudAnchorOperations,
    // Geospatial API
    isGeospatialModeSupported: this._isGeospatialModeSupported,
    setGeospatialModeEnabled: this._setGeospatialModeEnabled,
    getEarthTrackingState: this._getEarthTrackingState,
    getCameraGeospatialPose: this._getCameraGeospatialPose,
    checkVPSAvailability: this._checkVPSAvailability,
    createGeospatialAnchor: this._createGeospatialAnchor,
    hostGeospatialAnchor: this._hostGeospatialAnchor,
    resolveGeospatialAnchor: this._resolveGeospatialAnchor,
    createTerrainAnchor: this._createTerrainAnchor,
    createRooftopAnchor: this._createRooftopAnchor,
    removeGeospatialAnchor: this._removeGeospatialAnchor,
    // ReactVision Geospatial CRUD
    rvGetGeospatialAnchor: this._rvGetGeospatialAnchor,
    rvFindNearbyGeospatialAnchors: this._rvFindNearbyGeospatialAnchors,
    rvUpdateGeospatialAnchor: this._rvUpdateGeospatialAnchor,
    rvDeleteGeospatialAnchor: this._rvDeleteGeospatialAnchor,
    rvListGeospatialAnchors: this._rvListGeospatialAnchors,
    // ReactVision Cloud Anchor Management
    rvGetCloudAnchor: this._rvGetCloudAnchor,
    rvListCloudAnchors: this._rvListCloudAnchors,
    rvUpdateCloudAnchor: this._rvUpdateCloudAnchor,
    rvDeleteCloudAnchor: this._rvDeleteCloudAnchor,
    rvFindNearbyCloudAnchors: this._rvFindNearbyCloudAnchors,
    rvAttachAssetToCloudAnchor: this._rvAttachAssetToCloudAnchor,
    rvRemoveAssetFromCloudAnchor: this._rvRemoveAssetFromCloudAnchor,
    rvTrackCloudAnchorResolution: this._rvTrackCloudAnchorResolution,
    rvGetScene: this._rvGetScene,
    rvGetSceneAssets: this._rvGetSceneAssets,
    // Assets API
    rvUploadAsset: this._rvUploadAsset,
    // Scene Semantics API
    isSemanticModeSupported: this._isSemanticModeSupported,
    setSemanticModeEnabled: this._setSemanticModeEnabled,
    getSemanticLabelFractions: this._getSemanticLabelFractions,
    getSemanticLabelFraction: this._getSemanticLabelFraction,
    // Monocular Depth Estimation API
    setPreferMonocularDepth: this._setPreferMonocularDepth,
    isPreferMonocularDepth: this._isPreferMonocularDepth,
    // Debugging & Validation API
    isDepthOcclusionSupported: this._isDepthOcclusionSupported,
    getGeospatialSetupStatus: this._getGeospatialSetupStatus,
    viroAppProps: {} as any,
  };
  sceneNavigator = {
    push: this.push,
    pop: this.pop,
    popN: this.popN,
    jump: this.jump,
    replace: this.replace,
    startVideoRecording: this._startVideoRecording,
    stopVideoRecording: this._stopVideoRecording,
    takeScreenshot: this._takeScreenshot,
    resetARSession: this._resetARSession,
    setWorldOrigin: this._setWorldOrigin,
    project: this._project,
    unproject: this._unproject,
    hostCloudAnchor: this._hostCloudAnchor,
    resolveCloudAnchor: this._resolveCloudAnchor,
    cancelCloudAnchorOperations: this._cancelCloudAnchorOperations,
    // Geospatial API
    isGeospatialModeSupported: this._isGeospatialModeSupported,
    setGeospatialModeEnabled: this._setGeospatialModeEnabled,
    getEarthTrackingState: this._getEarthTrackingState,
    getCameraGeospatialPose: this._getCameraGeospatialPose,
    checkVPSAvailability: this._checkVPSAvailability,
    createGeospatialAnchor: this._createGeospatialAnchor,
    hostGeospatialAnchor: this._hostGeospatialAnchor,
    resolveGeospatialAnchor: this._resolveGeospatialAnchor,
    createTerrainAnchor: this._createTerrainAnchor,
    createRooftopAnchor: this._createRooftopAnchor,
    removeGeospatialAnchor: this._removeGeospatialAnchor,
    // ReactVision Geospatial CRUD
    rvGetGeospatialAnchor: this._rvGetGeospatialAnchor,
    rvFindNearbyGeospatialAnchors: this._rvFindNearbyGeospatialAnchors,
    rvUpdateGeospatialAnchor: this._rvUpdateGeospatialAnchor,
    rvDeleteGeospatialAnchor: this._rvDeleteGeospatialAnchor,
    rvListGeospatialAnchors: this._rvListGeospatialAnchors,
    // ReactVision Cloud Anchor Management
    rvGetCloudAnchor: this._rvGetCloudAnchor,
    rvListCloudAnchors: this._rvListCloudAnchors,
    rvUpdateCloudAnchor: this._rvUpdateCloudAnchor,
    rvDeleteCloudAnchor: this._rvDeleteCloudAnchor,
    rvFindNearbyCloudAnchors: this._rvFindNearbyCloudAnchors,
    rvAttachAssetToCloudAnchor: this._rvAttachAssetToCloudAnchor,
    rvRemoveAssetFromCloudAnchor: this._rvRemoveAssetFromCloudAnchor,
    rvTrackCloudAnchorResolution: this._rvTrackCloudAnchorResolution,
    rvGetScene: this._rvGetScene,
    rvGetSceneAssets: this._rvGetSceneAssets,
    // Assets API
    rvUploadAsset: this._rvUploadAsset,
    // Scene Semantics API
    isSemanticModeSupported: this._isSemanticModeSupported,
    setSemanticModeEnabled: this._setSemanticModeEnabled,
    getSemanticLabelFractions: this._getSemanticLabelFractions,
    getSemanticLabelFraction: this._getSemanticLabelFraction,
    // Monocular Depth Estimation API
    setPreferMonocularDepth: this._setPreferMonocularDepth,
    isPreferMonocularDepth: this._isPreferMonocularDepth,
    // Debugging & Validation API
    isDepthOcclusionSupported: this._isDepthOcclusionSupported,
    getGeospatialSetupStatus: this._getGeospatialSetupStatus,
    viroAppProps: {} as any,
  };

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroARSceneNavigator", this.props);

    if (isQuest) {
      if (!ViroARSceneNavigator._questWarningLogged) {
        console.warn(
          "[Viro] ViroARSceneNavigator is not supported on Meta Quest. " +
            "Use ViroXRSceneNavigator (auto-detects Quest) or ViroVRSceneNavigator instead."
        );
        ViroARSceneNavigator._questWarningLogged = true;
      }
      if ("questFallback" in this.props) {
        return <>{this.props.questFallback}</>;
      }
      return (
        <View style={[styles.container, styles.questFallback]}>
          <Text style={styles.questFallbackText}>
            AR is not supported on Meta Quest.
          </Text>
        </View>
      );
    }

    const items = this._renderSceneStackItems();

    // update the arSceneNavigator with the latest given props on every render
    this.arSceneNavigator.viroAppProps = this.props.viroAppProps;
    this.sceneNavigator.viroAppProps = this.props.viroAppProps;

    // If the user simply passes us the props from the root React component,
    // then we'll have an extra 'rootTag' key which React automatically includes
    // so remove it.
    if (this.arSceneNavigator.viroAppProps?.rootTag) {
      delete this.arSceneNavigator.viroAppProps?.rootTag;
    }
    if (this.sceneNavigator.viroAppProps?.rootTag) {
      delete this.sceneNavigator.viroAppProps?.rootTag;
    }

    const {
      viroAppProps = {},
      provider = "reactvision",
      ...restProps
    } = this.props;

    return (
      <VRTARSceneNavigator
        ref={(component) => {
          this._component = component;
        }}
        {...restProps}
        cloudAnchorProvider={provider}
        geospatialAnchorProvider={provider}
        viroAppProps={viroAppProps}
        currentSceneIndex={this.state.currentSceneIndex}
        style={(this.props.style, styles.container)}
        key={this.state.internalRemountKey}
        onTabSwitch={this._onTabSwitch}
      >
        {items}
      </VRTARSceneNavigator>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  questFallback: {
    backgroundColor: "#000",
    padding: 24,
  },
  questFallbackText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
});

const VRTARSceneNavigator = requireNativeComponent<any>(
  "VRTARSceneNavigator",
  // @ts-ignore
  ViroARSceneNavigator,
  {
    nativeOnly: { currentSceneIndex: true },
  }
);
