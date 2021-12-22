/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import { ViroSceneContext } from "../ViroSceneContext";
import * as React from "react";
import {
  findNodeHandle,
  NativeModules,
  NativeSyntheticEvent,
  requireNativeComponent,
} from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import {
  ViroAmbientLightInfo,
  ViroAmbientLightUpdateEvent,
  ViroARAnchorFoundEvent,
  ViroARAnchorRemovedEvent,
  ViroARAnchorUpdatedEvent,
  ViroARPointCloud,
  ViroARPointCloudUpdateEvent,
  ViroCameraARHitTest,
  ViroCameraARHitTestEvent,
  ViroCameraTransform,
  ViroCameraTransformEvent,
  ViroPlatformInfo,
  ViroPlatformUpdateEvent,
  ViroTrackingReason,
  ViroTrackingState,
  ViroTrackingUpdatedEvent,
} from "../Types/ViroEvents";
import {
  Viro3DPoint,
  ViroPhysicsWorld,
  ViroRay,
  ViroRotation,
  ViroScale,
  ViroSoundRoom,
  ViroSource,
} from "../Types/ViroUtils";
import { ViroBase } from "../ViroBase";
import { ViroCamera } from "../ViroCamera";
import { ViroTrackingStateConstants } from "../ViroConstants";
import { ViroCommonProps } from "./ViroCommonProps";

const ViroCameraModule = NativeModules.ViroCameraModule;

type Props = ViroCommonProps & {
  displayPointCloud?: {
    imageSource?: ViroSource;
    imageScale?: ViroScale;
    maxPoints?: number;
  };

  anchorDetectionTypes?: string[] | string;

  onCameraARHitTest?: (event: ViroCameraARHitTest) => void;
  onARPointCloudUpdate?: (pointCloud: ViroARPointCloud) => void;
  onCameraTransformUpdate?: (cameraTransform: ViroCameraTransform) => void;
  onTrackingUpdated?: (
    state: ViroTrackingState,
    reason: ViroTrackingReason
  ) => void;
  onPlatformUpdate?: (platformInfoViro: ViroPlatformInfo) => void;
  onAmbientLightUpdate?: (update: ViroAmbientLightInfo) => void;
  /**
   * Describes the acoustic properties of the room around the user
   */
  soundRoom?: ViroSoundRoom;
  physicsWorld?: ViroPhysicsWorld;
  postProcessEffects?: string[];

  /**
   * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
   * @deprecated
   */
  onTrackingInitialized?: () => void;
};

export class ViroARScene extends ViroBase<Props> {
  onTrackingFirstInitialized = false;

  _onCameraARHitTest = (
    event: NativeSyntheticEvent<ViroCameraARHitTestEvent>
  ) => {
    var hitTestEventObj = {
      hitTestResults: event.nativeEvent.hitTestResults,
      cameraOrientation: {
        position: [
          event.nativeEvent.cameraOrientation[0],
          event.nativeEvent.cameraOrientation[1],
          event.nativeEvent.cameraOrientation[2],
        ] as Viro3DPoint,
        rotation: [
          event.nativeEvent.cameraOrientation[3],
          event.nativeEvent.cameraOrientation[4],
          event.nativeEvent.cameraOrientation[5],
        ] as ViroRotation,
        forward: [
          event.nativeEvent.cameraOrientation[6],
          event.nativeEvent.cameraOrientation[7],
          event.nativeEvent.cameraOrientation[8],
        ] as Viro3DPoint,
        up: [
          event.nativeEvent.cameraOrientation[9],
          event.nativeEvent.cameraOrientation[10],
          event.nativeEvent.cameraOrientation[11],
        ] as Viro3DPoint,
      },
    };
    this.props.onCameraARHitTest &&
      this.props.onCameraARHitTest(hitTestEventObj);
  };

  _onARPointCloudUpdate = (
    event: NativeSyntheticEvent<ViroARPointCloudUpdateEvent>
  ) => {
    this.props.onARPointCloudUpdate &&
      this.props.onARPointCloudUpdate(event.nativeEvent.pointCloud);
  };

  _onCameraTransformUpdate = (
    event: NativeSyntheticEvent<ViroCameraTransformEvent>
  ) => {
    var cameraTransform = {
      // ** DEPRECATION WARNING ** The cameraTransform key will be deprecated in a future release,
      cameraTransform: {
        position: [
          event.nativeEvent.cameraTransform[0],
          event.nativeEvent.cameraTransform[1],
          event.nativeEvent.cameraTransform[2],
        ] as Viro3DPoint,
        rotation: [
          event.nativeEvent.cameraTransform[3],
          event.nativeEvent.cameraTransform[4],
          event.nativeEvent.cameraTransform[5],
        ] as ViroRotation,
        forward: [
          event.nativeEvent.cameraTransform[6],
          event.nativeEvent.cameraTransform[7],
          event.nativeEvent.cameraTransform[8],
        ] as Viro3DPoint,
        up: [
          event.nativeEvent.cameraTransform[9],
          event.nativeEvent.cameraTransform[10],
          event.nativeEvent.cameraTransform[11],
        ] as Viro3DPoint,
      },
      position: [
        event.nativeEvent.cameraTransform[0],
        event.nativeEvent.cameraTransform[1],
        event.nativeEvent.cameraTransform[2],
      ] as Viro3DPoint,
      rotation: [
        event.nativeEvent.cameraTransform[3],
        event.nativeEvent.cameraTransform[4],
        event.nativeEvent.cameraTransform[5],
      ] as ViroRotation,
      forward: [
        event.nativeEvent.cameraTransform[6],
        event.nativeEvent.cameraTransform[7],
        event.nativeEvent.cameraTransform[8],
      ] as Viro3DPoint,
      up: [
        event.nativeEvent.cameraTransform[9],
        event.nativeEvent.cameraTransform[10],
        event.nativeEvent.cameraTransform[11],
      ] as Viro3DPoint,
    };
    this.props.onCameraTransformUpdate &&
      this.props.onCameraTransformUpdate(cameraTransform);
  };

  _onPlatformUpdate = (
    event: NativeSyntheticEvent<ViroPlatformUpdateEvent>
  ) => {
    this.props.onPlatformUpdate &&
      this.props.onPlatformUpdate(event.nativeEvent.platformInfoViro);
  };

  // TODO VIRO-3172: Remove in favor of deprecating onTrackingInitialized
  componentDidMount() {
    this.onTrackingFirstInitialized = false;
  }

  _onTrackingUpdated = (
    event: NativeSyntheticEvent<ViroTrackingUpdatedEvent>
  ) => {
    if (this.props.onTrackingUpdated) {
      this.props.onTrackingUpdated(
        event.nativeEvent.state,
        event.nativeEvent.reason
      );
    }

    // TODO VIRO-3172: Remove in favor of deprecating onTrackingInitialized
    if (
      (event.nativeEvent.state == ViroTrackingStateConstants.TRACKING_LIMITED ||
        event.nativeEvent.state ==
          ViroTrackingStateConstants.TRACKING_NORMAL) &&
      !this.onTrackingFirstInitialized
    ) {
      this.onTrackingFirstInitialized = true;
      if (this.props.onTrackingInitialized) {
        this.props.onTrackingInitialized();
      }
    }
  };

  /**
   * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
   * @deprecated
   */
  _onTrackingInitialized = (
    _event: NativeSyntheticEvent<ViroTrackingUpdatedEvent>
  ) => {
    this.props.onTrackingInitialized && this.props.onTrackingInitialized();
  };

  /**
   * Gives constant estimates of the ambient light as detected by the camera.
   * Returns object w/ "intensity" and "color" keys
   */
  _onAmbientLightUpdate = (
    event: NativeSyntheticEvent<ViroAmbientLightUpdateEvent>
  ) => {
    this.props.onAmbientLightUpdate &&
      this.props.onAmbientLightUpdate(event.nativeEvent.ambientLightInfo);
  };

  _onAnchorFound = (event: NativeSyntheticEvent<ViroARAnchorFoundEvent>) => {
    // TODO: this is in a different format than the other onAnchorFound methods
    this.props.onAnchorFound &&
      this.props.onAnchorFound(event.nativeEvent.anchor);
  };

  _onAnchorUpdated = (
    event: NativeSyntheticEvent<ViroARAnchorUpdatedEvent>
  ) => {
    // TODO: this is in a different format than the other onAnchorUpdated methods
    this.props.onAnchorUpdated &&
      this.props.onAnchorUpdated(event.nativeEvent.anchor);
  };

  _onAnchorRemoved = (
    event: NativeSyntheticEvent<ViroARAnchorRemovedEvent>
  ) => {
    // TODO: this is in a different format than the other onAnchorRemoved methods
    this.props.onAnchorRemoved &&
      this.props.onAnchorRemoved(event.nativeEvent.anchor);
  };

  findCollisionsWithRayAsync = async (
    from: Viro3DPoint,
    to: Viro3DPoint,
    closest: any,
    viroTag: string
  ) => {
    return await NativeModules.VRTSceneModule.findCollisionsWithRayAsync(
      findNodeHandle(this),
      from,
      to,
      closest,
      viroTag
    );
  };

  findCollisionsWithShapeAsync = async (
    from: Viro3DPoint,
    to: Viro3DPoint,
    shapeString: string,
    shapeParam: any,
    viroTag: string
  ) => {
    return await NativeModules.VRTSceneModule.findCollisionsWithShapeAsync(
      findNodeHandle(this),
      from,
      to,
      shapeString,
      shapeParam,
      viroTag
    );
  };

  performARHitTestWithRay = async (ray: ViroRay) => {
    return await NativeModules.VRTARSceneModule.performARHitTestWithRay(
      findNodeHandle(this),
      ray
    );
  };

  performARHitTestWithWorldPoints = async (
    origin: Viro3DPoint,
    destination: Viro3DPoint
  ) => {
    return await NativeModules.VRTARSceneModule.performARHitTestWithRay(
      findNodeHandle(this),
      origin,
      destination
    );
  };

  performARHitTestWithPosition = async (position: Viro3DPoint) => {
    return await NativeModules.VRTARSceneModule.performARHitTestWithPosition(
      findNodeHandle(this),
      position
    );
  };

  performARHitTestWithPoint = async (x: number, y: number) => {
    return await NativeModules.VRTARSceneModule.performARHitTestWithPoint(
      findNodeHandle(this),
      x,
      y
    );
  };

  /**
   * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
   * @deprecated
   */
  // getCameraPositionAsync = async () => {
  //   console.warn(
  //     "[Viro] ViroScene.getCameraPositionAsync has been DEPRECATED. Please use getCameraOrientationAsync instead."
  //   );
  //   var orientation = await NativeModules.VRTCameraModule.getCameraOrientation(
  //     findNodeHandle(this)
  //   );
  //   var position = [orientation[0], orientation[1], orientation[2]];
  //   return position;
  // }

  getCameraOrientationAsync = async () => {
    var orientation = await NativeModules.VRTCameraModule.getCameraOrientation(
      findNodeHandle(this)
    );
    return {
      position: [orientation[0], orientation[1], orientation[2]],
      rotation: [orientation[3], orientation[4], orientation[5]],
      forward: [orientation[6], orientation[7], orientation[8]],
      up: [orientation[9], orientation[10], orientation[11]],
    };
  };

  getCameraPositionAsync = async () => {
    // TODO: Two functions with the same name??
    return await ViroCameraModule.getCameraPosition(findNodeHandle(this));
  };

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroARScene", this.props);

    // Since anchorDetectionTypes can be either a string or an array, convert the string to a 1-element array.
    let anchorDetectionTypes =
      typeof this.props.anchorDetectionTypes === "string"
        ? new Array(this.props.anchorDetectionTypes)
        : this.props.anchorDetectionTypes;

    let timeToFuse = undefined;
    if (
      this.props.onFuse != undefined &&
      typeof this.props.onFuse === "object"
    ) {
      timeToFuse = this.props.onFuse.timeToFuse;
    }

    let displayPointCloud = false;
    let pointCloudImage = undefined;
    let pointCloudScale = undefined;
    let pointCloudMaxPoints = undefined;
    // parse out displayPointCloud prop
    if (this.props.displayPointCloud) {
      displayPointCloud = true;
      pointCloudImage = resolveAssetSource(
        this.props.displayPointCloud.imageSource
      );
      pointCloudScale = this.props.displayPointCloud.imageScale;
      pointCloudMaxPoints = this.props.displayPointCloud.maxPoints;
    }

    if (this.props.onTrackingInitialized && !this.onTrackingFirstInitialized) {
      console.warn(
        "[Viro] ViroARScene.onTrackingInitialized() has been DEPRECATED. Please use onTrackingUpdated() instead."
      );
    }

    return (
      <ViroSceneContext.Provider
        value={{
          cameraDidMount: (camera: ViroCamera) => {
            if (camera.props.active) {
              NativeModules.VRTCameraModule.setSceneCamera(
                findNodeHandle(this),
                findNodeHandle(camera)
              );
            }
          },
          cameraWillUnmount: (camera: ViroCamera) => {
            if (camera.props.active) {
              NativeModules.VRTCameraModule.removeSceneCamera(
                findNodeHandle(this),
                findNodeHandle(camera)
              );
            }
          },
          cameraDidUpdate: (camera: ViroCamera, active: boolean) => {
            if (active) {
              NativeModules.VRTCameraModule.setSceneCamera(
                findNodeHandle(this),
                findNodeHandle(camera)
              );
            } else {
              NativeModules.VRTCameraModule.removeSceneCamera(
                findNodeHandle(this),
                findNodeHandle(camera)
              );
            }
          },
        }}
      >
        <VRTARScene
          {...this.props}
          canHover={this.props.onHover != undefined}
          canClick={
            this.props.onClick != undefined ||
            this.props.onClickState != undefined
          }
          canTouch={this.props.onTouch != undefined}
          canScroll={this.props.onScroll != undefined}
          canSwipe={this.props.onSwipe != undefined}
          canDrag={this.props.onDrag != undefined}
          canPinch={this.props.onPinch != undefined}
          canRotate={this.props.onRotate != undefined}
          canFuse={this.props.onFuse != undefined}
          canCameraARHitTest={this.props.onCameraARHitTest != undefined}
          canARPointCloudUpdate={this.props.onARPointCloudUpdate != undefined}
          canCameraTransformUpdate={
            this.props.onCameraTransformUpdate != undefined
          }
          onHoverViro={this._onHover}
          onClickViro={this._onClickState}
          onTouchViro={this._onTouch}
          onScrollViro={this._onScroll}
          onSwipeViro={this._onSwipe}
          onDragViro={this._onDrag}
          onPinchViro={this._onPinch}
          onRotateViro={this._onRotate}
          onFuseViro={this._onFuse}
          onCameraARHitTestViro={this._onCameraARHitTest}
          onARPointCloudUpdateViro={this._onARPointCloudUpdate}
          onCameraTransformUpdateViro={this._onCameraTransformUpdate}
          onPlatformUpdateViro={this._onPlatformUpdate}
          onTrackingUpdatedViro={this._onTrackingUpdated}
          onAmbientLightUpdateViro={this._onAmbientLightUpdate}
          onAnchorFoundViro={this._onAnchorFound}
          onAnchorUpdatedViro={this._onAnchorUpdated}
          onAnchorRemovedViro={this._onAnchorRemoved}
          timeToFuse={timeToFuse}
          anchorDetectionTypes={anchorDetectionTypes}
          displayPointCloud={displayPointCloud}
          pointCloudImage={pointCloudImage}
          pointCloudScale={pointCloudScale}
          pointCloudMaxPoints={pointCloudMaxPoints}
        />
      </ViroSceneContext.Provider>
    );
  }
}

var VRTARScene = requireNativeComponent<any>(
  "VRTARScene",
  // @ts-ignore
  ViroARScene,
  {
    nativeOnly: {
      canHover: true,
      canClick: true,
      canTouch: true,
      canScroll: true,
      canSwipe: true,
      canDrag: true,
      canPinch: true,
      canRotate: true,
      canFuse: true,
      canCameraARHitTest: true,
      canARPointCloudUpdate: true,
      canCameraTransformUpdate: true,
      onHoverViro: true,
      onClickViro: true,
      onTouchViro: true,
      onScrollViro: true,
      onSwipeViro: true,
      onDragViro: true,
      onPinchViro: true,
      onRotateViro: true,
      onFuseViro: true,
      onPlatformUpdateViro: true,
      onTrackingInitializedViro: true,
      onTrackingUpdatedViro: true,
      onAmbientLightUpdateViro: true,
      onAnchorFoundViro: true,
      onAnchorUpdatedViro: true,
      onAnchorRemovedViro: true,
      onCameraARHitTestViro: true,
      onARPointCloudUpdateViro: true,
      onCameraTransformUpdateViro: true,
      timeToFuse: true,
      pointCloudImage: true,
      pointCloudScale: true,
      pointCloudMaxPoints: true,
    },
  }
);
