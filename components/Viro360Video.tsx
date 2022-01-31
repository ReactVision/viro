/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Viro360Video
 * @flow
 */
"use strict";

import * as React from "react";
import {
  findNodeHandle,
  NativeSyntheticEvent,
  Platform,
  requireNativeComponent,
  ViewProps,
} from "react-native";

// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import {
  ViroVideoBufferEndEvent,
  ViroVideoBufferStartEvent,
  ViroVideoErrorEvent,
  ViroVideoUpdateTimeEvent,
} from "./Types/ViroEvents";
import { ViroNativeRef, ViroRotation, ViroSource } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";

var NativeModules = require("react-native").NativeModules;

type Props = ViewProps & {
  source: ViroSource;
  rotation?: ViroRotation;
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
  onError?: (event: NativeSyntheticEvent<ViroVideoErrorEvent>) => void;
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
};

/**
 * Used to render a 360 video on the background sphere.
 */
export class Viro360Video extends React.Component<Props> {
  _component: ViroNativeRef = null;

  _onBufferStart = (event: NativeSyntheticEvent<ViroVideoBufferStartEvent>) => {
    this.props.onBufferStart && this.props.onBufferStart(event);
  };

  _onBufferEnd = (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => {
    this.props.onBufferEnd && this.props.onBufferEnd(event);
  };

  _onFinish = () => {
    this.props.onFinish && this.props.onFinish();
  };

  _onError = (event: NativeSyntheticEvent<ViroVideoErrorEvent>) => {
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
    checkMisnamedProps("Viro360Video", this.props);

    var vidsrc = resolveAssetSource(this.props.source);

    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.source = vidsrc;
    nativeProps.onBufferStartViro = this._onBufferStart;
    nativeProps.onBufferEndViro = this._onBufferEnd;
    nativeProps.onErrorViro = this._onError;
    nativeProps.onFinishViro = this._onFinish;
    nativeProps.onUpdateTimeViro = this._onUpdateTime;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };
    return <VRO360Video {...nativeProps} />;
  }

  seekToTime = (timeInSeconds: number) => {
    switch (Platform.OS) {
      case "ios":
        NativeModules.VRT360VideoManager.seekToTime(
          findNodeHandle(this),
          timeInSeconds
        );
        break;
      case "android":
        NativeModules.UIManager.dispatchViewManagerCommand(
          findNodeHandle(this),
          NativeModules.UIManager.VRT360Video.Commands.seekToTime,
          [timeInSeconds]
        );
        break;
    }
  };
}

var VRO360Video = requireNativeComponent<any>(
  "VRT360Video",
  // @ts-ignore
  Viro360Video,
  {
    nativeOnly: {
      onBufferStartViro: true,
      onBufferEndViro: true,
      onUpdateTimeViro: true,
      onErrorViro: true,
      onFinishViro: true,
    },
  }
);
