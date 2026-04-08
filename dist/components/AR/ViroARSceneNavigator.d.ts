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
import * as React from "react";
import { ViewProps } from "react-native";
import { ViroWorldOrigin, ViroProvider, ViroCloudAnchorStateChangeEvent, ViroHostCloudAnchorResult, ViroResolveCloudAnchorResult, ViroGeospatialSupportResult, ViroEarthTrackingStateResult, ViroGeospatialPoseResult, ViroVPSAvailabilityResult, ViroCreateGeospatialAnchorResult, ViroQuaternion, ViroSemanticSupportResult, ViroSemanticLabelFractionsResult, ViroSemanticLabelFractionResult, ViroSemanticLabel, ViroMonocularDepthPreferenceResult, ViroDepthOcclusionSupportResult, ViroGeospatialSetupStatusResult } from "../Types/ViroEvents";
import { Viro3DPoint, ViroNativeRef, ViroScene, ViroSceneDictionary } from "../Types/ViroUtils";
import { ViroWorldMeshConfig, ViroWorldMeshStats } from "../Types/ViroWorldMesh";
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
    autofocus?: boolean;
    /**
     * iOS only props! Note: these props may change as the underlying platforms coalesce in features.
     */
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    videoQuality?: "High" | "Low";
    numberOfTrackedImages?: number;
    viroAppProps?: any;
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
    internalRemountKey: number;
};
/**
 * ViroARSceneNavigator is used to transition between multiple AR Scenes.
 */
export declare class ViroARSceneNavigator extends React.Component<Props, State> {
    _component: ViroNativeRef;
    constructor(props: Props);
    componentDidMount(): void;
    componentDidUpdate(prevProps: Props): void;
    /**
     * [Android Only - Internal]
     * Handle tab switch detection from native side.
     * This is called automatically when the native view detects it was reattached
     * to the window after being detached (tab switching scenario).
     */
    _onTabSwitch: () => void;
    componentWillUnmount(): void;
    /**
     * Starts recording video of the Viro renderer and external audio
     *
     * @param fileName - name of the file (without extension)
     * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
     * @param onError - callback function that accepts an errorCode.
     */
    _startVideoRecording: (fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
    /**
     * Stops recording the video of the Viro Renderer.
     *
     * returns Object w/ success, url and errorCode keys.
     * @returns Promise that resolves when the video has stopped recording.
     */
    _stopVideoRecording: () => Promise<any>;
    /**
     * Takes a screenshot of the Viro renderer
     *
     * @param fileName - name of the file (without extension)
     * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
     * returns Object w/ success, url and errorCode keys.
     */
    _takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<any>;
    /**
     * @todo document _project
     *
     * @param point
     * @returns
     */
    _project: (point: Viro3DPoint) => Promise<any>;
    /**
     * TODO: Document _unproject
     *
     * @param point
     * @returns
     */
    _unproject: (point: Viro3DPoint) => Promise<any>;
    /**
     * Gets a random tag string.
     *
     * @returns a random tag.
     */
    getRandomTag: () => string;
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
    push: (param1?: ViroScene | string, param2?: ViroScene) => void;
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
    replace: (param1?: ViroScene | string, param2?: ViroScene) => void;
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
    jump: (param1?: ViroScene | string, param2?: ViroScene) => void;
    /**
     * Pop 1 screen from the stack.
     */
    pop: () => void;
    /**
     * Pop n screens from the stack.
     *
     * @param n number of scenes to pop
     * @returns void
     */
    popN: (n: number) => void;
    /**
     * Increments the reference count for a scene within sceneDictionary that is
     * mapped to the given sceneKey. If no scenes are found / mapped, we create
     * one, initialize it with a reference count of 1, and store it within the
     * sceneDictionary for future reference.
     *
     * @todo TODO: Document parameters.
     */
    incrementSceneReference: (scene: ViroScene, sceneKey: string, limitOne: boolean) => void;
    /**
     * Decrements the reference count for the last N scenes within
     * the sceneHistory by 1. If nothing else references that given scene
     * (counts equals 0), we then remove that scene from sceneDictionary.
     *
     * @param n number to decrement by.
     */
    decrementReferenceForLastNScenes: (n: number) => void;
    /**
     * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
     * to the scene on the top of the history stack (the most recent scene).
     *
     * @param sceneKey scene to insert into the stack.
     */
    addToHistory: (sceneKey: string) => void;
    /**
     * Instead of preserving history, we find the last pushed sceneKey within the history stack
     * matching the given sceneKey and re-order it to the front. We then update the
     * currentSceneIndex to point to the scene on the top of the history stack
     * (the most recent scene).
     *
     * @param sceneKey scene to put at the top of the stack.
     */
    reorderHistory: (sceneKey: string) => void;
    /**
     * Pops the history entries by n screens.
     *
     * @param n number of history entries to pop.
     */
    popHistoryByN(n: number): void;
    /**
     * Gets the index of a scene by the scene tag.
     *
     * @param sceneTag tag of the scene
     * @returns the index of the scene
     */
    getSceneIndex: (sceneTag: string) => number;
    /**
     * [iOS Only]
     *
     * Resets the tracking of the AR session.
     *
     * @param resetTracking - determines if the tracking should be reset.
     * @param removeAnchors - determines if the existing anchors should be removed too.
     */
    _resetARSession: (resetTracking: any, removeAnchors: any) => void;
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
    _setWorldOrigin: (worldOrigin: ViroWorldOrigin) => void;
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
    _hostCloudAnchor: (anchorId: string, ttlDays?: number) => Promise<ViroHostCloudAnchorResult>;
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
    _resolveCloudAnchor: (cloudAnchorId: string) => Promise<ViroResolveCloudAnchorResult>;
    /**
     * Cancel all pending cloud anchor operations.
     * Use this when exiting a scene or when cloud operations are no longer needed.
     */
    _cancelCloudAnchorOperations: () => void;
    /**
     * Check if geospatial mode is supported on this device.
     *
     * @returns Promise resolving to support status
     */
    _isGeospatialModeSupported: () => Promise<ViroGeospatialSupportResult>;
    /**
     * Enable or disable geospatial mode.
     * When enabled, the session will track the device's position relative to the Earth.
     *
     * @param enabled - Whether to enable geospatial mode
     */
    _setGeospatialModeEnabled: (enabled: boolean) => void;
    /**
     * Get the current Earth tracking state.
     *
     * @returns Promise resolving to the current tracking state
     */
    _getEarthTrackingState: () => Promise<ViroEarthTrackingStateResult>;
    /**
     * Get the camera's current geospatial pose (latitude, longitude, altitude, etc.)
     *
     * @returns Promise resolving to the camera's geospatial pose
     */
    _getCameraGeospatialPose: () => Promise<ViroGeospatialPoseResult>;
    /**
     * Check VPS (Visual Positioning System) availability at a specific location.
     * VPS provides enhanced accuracy in supported locations.
     *
     * @param latitude - Latitude in degrees
     * @param longitude - Longitude in degrees
     * @returns Promise resolving to VPS availability status
     */
    _checkVPSAvailability: (latitude: number, longitude: number) => Promise<ViroVPSAvailabilityResult>;
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
    _createGeospatialAnchor: (latitude: number, longitude: number, altitude: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
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
    _createTerrainAnchor: (latitude: number, longitude: number, altitudeAboveTerrain: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
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
    _createRooftopAnchor: (latitude: number, longitude: number, altitudeAboveRooftop: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
    /**
     * Remove a geospatial anchor from the session.
     *
     * @param anchorId - The ID of the anchor to remove
     */
    _removeGeospatialAnchor: (anchorId: string) => void;
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
    _hostGeospatialAnchor: (latitude: number, longitude: number, altitude: number, altitudeMode?: string) => Promise<any>;
    /**
     * ReactVision — fetch GPS coordinates from the backend by platform UUID and create a local AR anchor.
     * Combines rvGetGeospatialAnchor + createGeospatialAnchor into a single call.
     *
     * @param platformUuid UUID returned by hostGeospatialAnchor
     * @param quaternion   Orientation [x, y, z, w] (default identity)
     * @returns Promise resolving to { success, anchor: { anchorId, latitude, longitude, altitude } }
     */
    _resolveGeospatialAnchor: (platformUuid: string, quaternion?: ViroQuaternion) => Promise<any>;
    /**
     * ReactVision — fetch a geospatial anchor record by UUID.
     * Returns the anchor with linked scene asset data (position, rotation, scale, fileUrl).
     */
    _rvGetGeospatialAnchor: (anchorId: string) => Promise<any>;
    /**
     * ReactVision — find geospatial anchors near a GPS location.
     * @param latitude  Centre latitude
     * @param longitude Centre longitude
     * @param radius    Search radius in metres (default 500)
     * @param limit     Max results (default 50)
     */
    _rvFindNearbyGeospatialAnchors: (latitude: number, longitude: number, radius?: number, limit?: number) => Promise<any>;
    /**
     * ReactVision — update a geospatial anchor (link scene asset, scene, or rename).
     * Pass null/empty string to leave a field unchanged.
     */
    _rvUpdateGeospatialAnchor: (anchorId: string, sceneAssetId?: string, sceneId?: string, name?: string, userAssetId?: string) => Promise<any>;
    _rvUploadAsset: (filePath: string, assetType: string, fileName: string, appUserId?: string) => Promise<any>;
    /**
     * ReactVision — permanently delete a geospatial anchor from the backend.
     */
    _rvDeleteGeospatialAnchor: (anchorId: string) => Promise<any>;
    _rvListGeospatialAnchors: (limit: number, offset: number) => Promise<any>;
    _rvGetCloudAnchor: (anchorId: string) => Promise<any>;
    _rvListCloudAnchors: (limit: number, offset: number) => Promise<any>;
    _rvUpdateCloudAnchor: (anchorId: string, name: string, description: string, isPublic: boolean) => Promise<any>;
    _rvDeleteCloudAnchor: (anchorId: string) => Promise<any>;
    _rvFindNearbyCloudAnchors: (latitude: number, longitude: number, radius: number, limit: number) => Promise<any>;
    _rvGetScene: (sceneId: string) => Promise<any>;
    _rvGetSceneAssets: (sceneId: string) => Promise<any>;
    _rvAttachAssetToCloudAnchor: (anchorId: string, fileUrl: string, fileSize: number, name: string, assetType: string, externalUserId: string) => Promise<any>;
    _rvRemoveAssetFromCloudAnchor: (anchorId: string, assetId: string) => Promise<any>;
    _rvTrackCloudAnchorResolution: (anchorId: string, success: boolean, confidence: number, matchCount: number, inlierCount: number, processingTimeMs: number, platform: string, externalUserId: string) => Promise<any>;
    /**
     * Check if Scene Semantics mode is supported on this device.
     * Scene Semantics uses ML to classify each pixel in the camera feed
     * into categories like sky, building, tree, road, etc.
     *
     * @returns Promise resolving to support status
     */
    _isSemanticModeSupported: () => Promise<ViroSemanticSupportResult>;
    /**
     * Enable or disable Scene Semantics mode.
     * When enabled, the session will process each frame to generate
     * semantic labels for each pixel.
     *
     * @param enabled - Whether to enable semantic mode
     */
    _setSemanticModeEnabled: (enabled: boolean) => void;
    /**
     * Get the fraction of pixels for each semantic label in the current frame.
     * Returns a dictionary with label names as keys and fractions (0.0-1.0) as values.
     *
     * Available labels: unlabeled, sky, building, tree, road, sidewalk,
     * terrain, structure, object, vehicle, person, water
     *
     * @returns Promise resolving to semantic label fractions
     */
    _getSemanticLabelFractions: () => Promise<ViroSemanticLabelFractionsResult>;
    /**
     * Get the fraction of pixels for a specific semantic label.
     *
     * @param label - The semantic label name (e.g., "sky", "building", "road")
     * @returns Promise resolving to the fraction of pixels with that label
     */
    _getSemanticLabelFraction: (label: ViroSemanticLabel) => Promise<ViroSemanticLabelFractionResult>;
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
    _setPreferMonocularDepth: (prefer: boolean) => void;
    /**
     * Check if monocular depth is preferred over LiDAR.
     *
     * @returns Promise resolving to preference status
     */
    _isPreferMonocularDepth: () => Promise<ViroMonocularDepthPreferenceResult>;
    /**
     * Check if depth-based occlusion is supported on this device.
     * Requires:
     * - Android: ARCore 1.18+ with depth support
     * - iOS: Always supported (uses monocular depth + LiDAR)
     *
     * @returns Promise resolving to depth occlusion support status and requirements
     */
    _isDepthOcclusionSupported: () => Promise<ViroDepthOcclusionSupportResult>;
    /**
     * Check geospatial mode setup status and prerequisites.
     * Validates:
     * - Geospatial API support on device
     * - Location services availability
     * - Google Cloud API key configuration (Android)
     *
     * @returns Promise resolving to geospatial setup status with error details
     */
    _getGeospatialSetupStatus: () => Promise<ViroGeospatialSetupStatusResult>;
    /**
     * Renders the Scene Views in the stack.
     *
     * @returns Array of rendered Scene views.
     */
    _renderSceneStackItems: () => React.JSX.Element[];
    arSceneNavigator: {
        push: (param1?: ViroScene | string, param2?: ViroScene) => void;
        pop: () => void;
        popN: (n: number) => void;
        jump: (param1?: ViroScene | string, param2?: ViroScene) => void;
        replace: (param1?: ViroScene | string, param2?: ViroScene) => void;
        startVideoRecording: (fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
        stopVideoRecording: () => Promise<any>;
        takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<any>;
        resetARSession: (resetTracking: any, removeAnchors: any) => void;
        setWorldOrigin: (worldOrigin: ViroWorldOrigin) => void;
        project: (point: Viro3DPoint) => Promise<any>;
        unproject: (point: Viro3DPoint) => Promise<any>;
        hostCloudAnchor: (anchorId: string, ttlDays?: number) => Promise<ViroHostCloudAnchorResult>;
        resolveCloudAnchor: (cloudAnchorId: string) => Promise<ViroResolveCloudAnchorResult>;
        cancelCloudAnchorOperations: () => void;
        isGeospatialModeSupported: () => Promise<ViroGeospatialSupportResult>;
        setGeospatialModeEnabled: (enabled: boolean) => void;
        getEarthTrackingState: () => Promise<ViroEarthTrackingStateResult>;
        getCameraGeospatialPose: () => Promise<ViroGeospatialPoseResult>;
        checkVPSAvailability: (latitude: number, longitude: number) => Promise<ViroVPSAvailabilityResult>;
        createGeospatialAnchor: (latitude: number, longitude: number, altitude: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
        hostGeospatialAnchor: (latitude: number, longitude: number, altitude: number, altitudeMode?: string) => Promise<any>;
        resolveGeospatialAnchor: (platformUuid: string, quaternion?: ViroQuaternion) => Promise<any>;
        createTerrainAnchor: (latitude: number, longitude: number, altitudeAboveTerrain: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
        createRooftopAnchor: (latitude: number, longitude: number, altitudeAboveRooftop: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
        removeGeospatialAnchor: (anchorId: string) => void;
        rvGetGeospatialAnchor: (anchorId: string) => Promise<any>;
        rvFindNearbyGeospatialAnchors: (latitude: number, longitude: number, radius?: number, limit?: number) => Promise<any>;
        rvUpdateGeospatialAnchor: (anchorId: string, sceneAssetId?: string, sceneId?: string, name?: string, userAssetId?: string) => Promise<any>;
        rvDeleteGeospatialAnchor: (anchorId: string) => Promise<any>;
        rvListGeospatialAnchors: (limit: number, offset: number) => Promise<any>;
        rvGetCloudAnchor: (anchorId: string) => Promise<any>;
        rvListCloudAnchors: (limit: number, offset: number) => Promise<any>;
        rvUpdateCloudAnchor: (anchorId: string, name: string, description: string, isPublic: boolean) => Promise<any>;
        rvDeleteCloudAnchor: (anchorId: string) => Promise<any>;
        rvFindNearbyCloudAnchors: (latitude: number, longitude: number, radius: number, limit: number) => Promise<any>;
        rvAttachAssetToCloudAnchor: (anchorId: string, fileUrl: string, fileSize: number, name: string, assetType: string, externalUserId: string) => Promise<any>;
        rvRemoveAssetFromCloudAnchor: (anchorId: string, assetId: string) => Promise<any>;
        rvTrackCloudAnchorResolution: (anchorId: string, success: boolean, confidence: number, matchCount: number, inlierCount: number, processingTimeMs: number, platform: string, externalUserId: string) => Promise<any>;
        rvGetScene: (sceneId: string) => Promise<any>;
        rvGetSceneAssets: (sceneId: string) => Promise<any>;
        rvUploadAsset: (filePath: string, assetType: string, fileName: string, appUserId?: string) => Promise<any>;
        isSemanticModeSupported: () => Promise<ViroSemanticSupportResult>;
        setSemanticModeEnabled: (enabled: boolean) => void;
        getSemanticLabelFractions: () => Promise<ViroSemanticLabelFractionsResult>;
        getSemanticLabelFraction: (label: ViroSemanticLabel) => Promise<ViroSemanticLabelFractionResult>;
        setPreferMonocularDepth: (prefer: boolean) => void;
        isPreferMonocularDepth: () => Promise<ViroMonocularDepthPreferenceResult>;
        isDepthOcclusionSupported: () => Promise<ViroDepthOcclusionSupportResult>;
        getGeospatialSetupStatus: () => Promise<ViroGeospatialSetupStatusResult>;
        viroAppProps: any;
    };
    sceneNavigator: {
        push: (param1?: ViroScene | string, param2?: ViroScene) => void;
        pop: () => void;
        popN: (n: number) => void;
        jump: (param1?: ViroScene | string, param2?: ViroScene) => void;
        replace: (param1?: ViroScene | string, param2?: ViroScene) => void;
        startVideoRecording: (fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
        stopVideoRecording: () => Promise<any>;
        takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<any>;
        resetARSession: (resetTracking: any, removeAnchors: any) => void;
        setWorldOrigin: (worldOrigin: ViroWorldOrigin) => void;
        project: (point: Viro3DPoint) => Promise<any>;
        unproject: (point: Viro3DPoint) => Promise<any>;
        hostCloudAnchor: (anchorId: string, ttlDays?: number) => Promise<ViroHostCloudAnchorResult>;
        resolveCloudAnchor: (cloudAnchorId: string) => Promise<ViroResolveCloudAnchorResult>;
        cancelCloudAnchorOperations: () => void;
        isGeospatialModeSupported: () => Promise<ViroGeospatialSupportResult>;
        setGeospatialModeEnabled: (enabled: boolean) => void;
        getEarthTrackingState: () => Promise<ViroEarthTrackingStateResult>;
        getCameraGeospatialPose: () => Promise<ViroGeospatialPoseResult>;
        checkVPSAvailability: (latitude: number, longitude: number) => Promise<ViroVPSAvailabilityResult>;
        createGeospatialAnchor: (latitude: number, longitude: number, altitude: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
        hostGeospatialAnchor: (latitude: number, longitude: number, altitude: number, altitudeMode?: string) => Promise<any>;
        resolveGeospatialAnchor: (platformUuid: string, quaternion?: ViroQuaternion) => Promise<any>;
        createTerrainAnchor: (latitude: number, longitude: number, altitudeAboveTerrain: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
        createRooftopAnchor: (latitude: number, longitude: number, altitudeAboveRooftop: number, quaternion?: ViroQuaternion) => Promise<ViroCreateGeospatialAnchorResult>;
        removeGeospatialAnchor: (anchorId: string) => void;
        rvGetGeospatialAnchor: (anchorId: string) => Promise<any>;
        rvFindNearbyGeospatialAnchors: (latitude: number, longitude: number, radius?: number, limit?: number) => Promise<any>;
        rvUpdateGeospatialAnchor: (anchorId: string, sceneAssetId?: string, sceneId?: string, name?: string, userAssetId?: string) => Promise<any>;
        rvDeleteGeospatialAnchor: (anchorId: string) => Promise<any>;
        rvListGeospatialAnchors: (limit: number, offset: number) => Promise<any>;
        rvGetCloudAnchor: (anchorId: string) => Promise<any>;
        rvListCloudAnchors: (limit: number, offset: number) => Promise<any>;
        rvUpdateCloudAnchor: (anchorId: string, name: string, description: string, isPublic: boolean) => Promise<any>;
        rvDeleteCloudAnchor: (anchorId: string) => Promise<any>;
        rvFindNearbyCloudAnchors: (latitude: number, longitude: number, radius: number, limit: number) => Promise<any>;
        rvAttachAssetToCloudAnchor: (anchorId: string, fileUrl: string, fileSize: number, name: string, assetType: string, externalUserId: string) => Promise<any>;
        rvRemoveAssetFromCloudAnchor: (anchorId: string, assetId: string) => Promise<any>;
        rvTrackCloudAnchorResolution: (anchorId: string, success: boolean, confidence: number, matchCount: number, inlierCount: number, processingTimeMs: number, platform: string, externalUserId: string) => Promise<any>;
        rvGetScene: (sceneId: string) => Promise<any>;
        rvGetSceneAssets: (sceneId: string) => Promise<any>;
        rvUploadAsset: (filePath: string, assetType: string, fileName: string, appUserId?: string) => Promise<any>;
        isSemanticModeSupported: () => Promise<ViroSemanticSupportResult>;
        setSemanticModeEnabled: (enabled: boolean) => void;
        getSemanticLabelFractions: () => Promise<ViroSemanticLabelFractionsResult>;
        getSemanticLabelFraction: (label: ViroSemanticLabel) => Promise<ViroSemanticLabelFractionResult>;
        setPreferMonocularDepth: (prefer: boolean) => void;
        isPreferMonocularDepth: () => Promise<ViroMonocularDepthPreferenceResult>;
        isDepthOcclusionSupported: () => Promise<ViroDepthOcclusionSupportResult>;
        getGeospatialSetupStatus: () => Promise<ViroGeospatialSetupStatusResult>;
        viroAppProps: any;
    };
    render(): React.JSX.Element;
}
export {};
