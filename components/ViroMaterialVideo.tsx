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
    // pause the current video texture on Android since java gc will release when it feels like it.
    if (Platform.OS == "android") {
      NativeModules.UIManager.dispatchViewManagerCommand(
        findNodeHandle(this),
        NativeModules.UIManager.VRTMaterialVideo.Commands.pause,
        [0]
      );
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
