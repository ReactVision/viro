/**
 * Copyright (c) 2015-present, Viro Media, Inc.
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
} from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import {
  ViroVideoBufferEndEvent,
  ViroVideoBufferStartEvent,
  ViroVideoErrorEvent,
  ViroVideoUpdateTimeEvent,
} from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroBase } from "./ViroBase";

type Props = {
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
  width?: number;
  height?: number;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  source: ViroSource;
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
};

export class ViroVideo extends ViroBase<Props> {
  _onBufferStart = (event: NativeSyntheticEvent<ViroVideoBufferStartEvent>) => {
    this.props.onBufferStart && this.props.onBufferStart(event);
  };

  _onBufferEnd = (event: NativeSyntheticEvent<ViroVideoBufferEndEvent>) => {
    this.props.onBufferEnd && this.props.onBufferEnd(event);
  };

  _onFinish = () => {
    this.props.onFinish && this.props.onFinish();
  };

  _onUpdateTime = (event: NativeSyntheticEvent<ViroVideoUpdateTimeEvent>) => {
    this.props.onUpdateTime &&
      this.props.onUpdateTime(
        event.nativeEvent.currentTime,
        event.nativeEvent.totalTime
      );
  };

  render() {
    checkMisnamedProps("ViroVideo", this.props);

    var source = resolveAssetSource(this.props.source);
    // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
    let materials =
      typeof this.props.materials === "string"
        ? new Array(this.props.materials)
        : this.props.materials;
    let transformBehaviors =
      typeof this.props.transformBehaviors === "string"
        ? new Array(this.props.transformBehaviors)
        : this.props.transformBehaviors;

    let timeToFuse = undefined;
    if (
      this.props.onFuse != undefined &&
      typeof this.props.onFuse === "object"
    ) {
      timeToFuse = this.props.onFuse.timeToFuse;
    }

    let transformDelegate =
      this.props.onTransformUpdate != undefined
        ? this._onNativeTransformUpdate
        : undefined;

    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.onNativeTransformDelegateViro = transformDelegate;
    nativeProps.hasTransformDelegate =
      this.props.onTransformUpdate != undefined;
    nativeProps.style = [this.props.style];
    nativeProps.source = source;
    nativeProps.materials = materials;
    nativeProps.transformBehaviors = transformBehaviors;
    nativeProps.onBufferStartViro = this._onBufferStart;
    nativeProps.onBufferEndViro = this._onBufferEnd;
    nativeProps.onFinishViro = this._onFinish;
    nativeProps.onErrorViro = this._onError;
    nativeProps.onUpdateTimeViro = this._onUpdateTime;
    nativeProps.onHoverViro = this._onHover;
    nativeProps.onClickViro = this._onClickState;
    nativeProps.onTouchViro = this._onTouch;
    nativeProps.onScrollViro = this._onScroll;
    nativeProps.onSwipeViro = this._onSwipe;
    nativeProps.onDragViro = this._onDrag;
    nativeProps.onRotateViro = this._onRotate;
    nativeProps.onPinchViro = this._onPinch;
    nativeProps.canHover = this.props.onHover != undefined;
    nativeProps.canClick =
      this.props.onClick != undefined || this.props.onClickState != undefined;
    nativeProps.canTouch = this.props.onTouch != undefined;
    nativeProps.canScroll = this.props.onScroll != undefined;
    nativeProps.canSwipe = this.props.onSwipe != undefined;
    nativeProps.canDrag = this.props.onDrag != undefined;
    nativeProps.canPinch = this.props.onPinch != undefined;
    nativeProps.canRotate = this.props.onRotate != undefined;
    nativeProps.canFuse = this.props.onFuse != undefined;
    nativeProps.onFuseViro = this._onFuse;
    nativeProps.onAnimationStartViro = this._onAnimationStart;
    nativeProps.onAnimationFinishViro = this._onAnimationFinish;
    nativeProps.timeToFuse = timeToFuse;
    nativeProps.canCollide = this.props.onCollision != undefined;
    nativeProps.onCollisionViro = this._onCollision;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };
    return <VRTVideoSurface {...nativeProps} />;
  }

  seekToTime = (timeInSeconds: number) => {
    switch (Platform.OS) {
      case "ios":
        NativeModules.VRTVideoSurfaceManager.seekToTime(
          findNodeHandle(this),
          timeInSeconds
        );
        break;
      case "android":
        NativeModules.UIManager.dispatchViewManagerCommand(
          findNodeHandle(this),
          NativeModules.UIManager.VRTVideoSurface.Commands.seekToTime,
          [timeInSeconds]
        );
        break;
    }
  };
}

var VRTVideoSurface = requireNativeComponent(
  "VRTVideoSurface",
  // @ts-ignore
  ViroVideo,
  {
    nativeOnly: {
      onBufferStartViro: true,
      onBufferEndViro: true,
      onUpdateTimeViro: true,
      onFinishViro: true,
      canHover: true,
      canClick: true,
      canTouch: true,
      canScroll: true,
      canSwipe: true,
      canDrag: true,
      canPinch: true,
      canRotate: true,
      onHoverViro: true,
      onClickViro: true,
      onTouchViro: true,
      onScrollViro: true,
      onSwipeViro: true,
      onDragViro: true,
      onPinchViro: true,
      onRotateViro: true,
      onErrorViro: true,
      canFuse: true,
      onFuseViro: true,
      timeToFuse: true,
      canCollide: true,
      onCollisionViro: true,
      onNativeTransformDelegateViro: true,
      hasTransformDelegate: true,
      onAnimationStartViro: true,
      onAnimationFinishViro: true,
    },
  }
);
