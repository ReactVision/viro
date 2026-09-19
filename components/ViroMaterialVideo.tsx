/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import * as React from "react";
import {
  findNodeHandle,
  NativeModules,
  NativeSyntheticEvent,
  Platform,
  requireNativeComponent,
  ViewProps,
} from "react-native";
import {
  ViroErrorEvent,
  ViroVideoBufferEndEvent,
  ViroVideoBufferStartEvent,
  ViroVideoUpdateTimeEvent,
} from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";

type Props = ViewProps & {
  material?: string;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;

  /**
   * Callback invoked when the underlying video component begins buffering. Called at
   * least once at the beginning of playback/video creation.
   */
  onBufferStart?: (
    event: NativeSyntheticEvent<ViroVideoBufferStartEvent>
  ) => void;

  /**
   * Callback invoked when the underlying video component has finished buffering.
   */
  onBufferEnd?: (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => void;

  /**
   * Callback that is called when the video is finished playing. This
   * function isn't called at the end of a video if looping is enabled.
   */
  onFinish?: () => void;

  /**
   * Callback that is called when the current playback position has changed.
   * This is called in the form:
   *     onUpdateTime(currentPlaybackTimeInSeconds, totalPlayBackDurationInSeconds);
   */
  onUpdateTime?: (currentTime: number, totalTime: number) => void;

  /**
   * Callback triggered when the video fails to load. Invoked with
   * {nativeEvent: {error}}
   */
  onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};

export class ViroMaterialVideo extends React.Component<Props> {
  _component: ViroNativeRef = null;

  componentWillUnmount() {
    // Pause the video texture on unmount to prevent memory leaks
    // Both Android and iOS need explicit pause since GC may not release immediately
    const nodeHandle = findNodeHandle(this);
    if (nodeHandle) {
      if (Platform.OS === "android") {
        NativeModules.UIManager.dispatchViewManagerCommand(
          nodeHandle,
          NativeModules.UIManager.VRTMaterialVideo.Commands.pause,
          [0]
        );
      } else if (Platform.OS === "ios") {
        // Also pause on iOS to ensure video resources are released
        NativeModules.VRTMaterialVideoManager?.pause?.(nodeHandle);
      }
    }
  }

  _onBufferStart = (event: NativeSyntheticEvent<ViroVideoBufferStartEvent>) => {
    this.props.onBufferStart && this.props.onBufferStart(event);
  };

  _onBufferEnd = (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => {
    this.props.onBufferEnd && this.props.onBufferEnd(event);
  };

  _onFinish = () => {
    this.props.onFinish && this.props.onFinish();
  };

  _onError = (event: NativeSyntheticEvent<ViroErrorEvent>) => {
    this.props.onError && this.props.onError(event);
  };

  _onUpdateTime = (event: NativeSyntheticEvent<ViroVideoUpdateTimeEvent>) => {
    this.props.onUpdateTime &&
      this.props.onUpdateTime(
        event.nativeEvent.currentTime,
        event.nativeEvent.totalTime
      );
  };

  setNativeProps = (nativeProps: Props) => {
    this._component?.setNativeProps(nativeProps);
  };

  render() {
    // ViroMaterialVideo's view manager is excluded from the visionOS renderer, so React has no view
    // config for it and mounting fails with "View config not found".
    if (isVisionOS) {
      warnUnsupported("ViroMaterialVideo", "Apple Vision Pro", "Video textures are not part of the visionOS renderer.");
      return null;
    }
    // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
    //let materials = typeof this.props.materials === 'string' ? new Array(this.props.materials) : this.props.materials;

    let nativeProps = Object.assign({} as any, this.props);
    //nativeProps.materials = materials;
    nativeProps.onBufferStartViro = this._onBufferStart;
    nativeProps.onBufferEndViro = this._onBufferEnd;
    nativeProps.onFinishViro = this._onFinish;
    nativeProps.onErrorViro = this._onError;
    nativeProps.onUpdateTimeViro = this._onUpdateTime;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };
    return <VRTMaterialVideo {...nativeProps} />;
  }

  seekToTime = (timeInSeconds: number) => {
    switch (Platform.OS) {
      case "ios":
        NativeModules.VRTMaterialVideoManager.seekToTime(
          findNodeHandle(this),
          timeInSeconds
        );
        break;
      case "android":
        NativeModules.UIManager.dispatchViewManagerCommand(
          findNodeHandle(this),
          NativeModules.UIManager.VRTMaterialVideo.Commands.seekToTime,
          [timeInSeconds]
        );
        break;
    }
  };
}

var VRTMaterialVideo = requireNativeComponent(
  "VRTMaterialVideo",
  // @ts-ignore
  ViroMaterialVideo,
  {
    nativeOnly: {
      onBufferStartViro: true,
      onBufferEndViro: true,
      onUpdateTimeViro: true,
      onFinishViro: true,
      onErrorViro: true,
    },
  }
);
