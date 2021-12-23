/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSound
 * @flow
 */
"use strict";

import * as React from "react";
import {
  findNodeHandle,
  NativeModules,
  NativeSyntheticEvent,
  Platform,
  requireNativeComponent,
  ViewProps,
} from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import { ViroErrorEvent, ViroSoundFinishEvent } from "./Types/ViroEvents";
import {
  ViroNativeRef,
  ViroSoundMap,
  ViroSoundPreloadResult,
  ViroSource,
} from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";

const SoundModule = NativeModules.VRTSoundModule;

type Props = ViewProps & {
  // Source can either be a String referencing a preloaded file, a web uri, or a
  // local js file (using require())
  source: ViroSource;

  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  onFinish?: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
  onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};

/**
 * ViroSound is a component that plays a sound file.
 */
export class ViroSound extends React.Component<Props> {
  _component: ViroNativeRef = null;

  static preloadSounds = async (soundMap: ViroSoundMap) => {
    var results: ViroSoundPreloadResult = {};
    for (var index in soundMap) {
      const response = await SoundModule.preloadSounds({
        [index]: soundMap[index],
      });
      results[response.key] = { result: response.result, msg: response.msg };
    }

    return results;
  };

  static unloadSounds = (soundKeys: ViroSound[]) => {
    SoundModule.unloadSounds(soundKeys);
  };

  _onFinish = (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => {
    this.props.onFinish && this.props.onFinish(event);
  };

  _onError = (event: NativeSyntheticEvent<ViroErrorEvent>) => {
    this.props.onError && this.props.onError(event);
  };

  setNativeProps = (nativeProps: Props) => {
    this._component?.setNativeProps(nativeProps);
  };

  render() {
    checkMisnamedProps("ViroSound", this.props);

    var soundSrc = this.props.source;
    if (typeof soundSrc === "number") {
      soundSrc = resolveAssetSource(soundSrc);
    } else if (typeof soundSrc === "string") {
      /**
       * @todo
       *
       * This throws a typescript error:
       * Type '{ name: never; }' is not assignable to type 'ImageSourcePropType'.
       * Object literal may only specify known properties, and 'name' does not
       * exist in type 'ImageURISource | ImageURISource[]'.
       *
       * I assume that this works correctly for Viro, but we would need to standardize
       * this or remove this usage. The usage should be {uri: string} or require format
       * to be consistent with images/video.
       */
      soundSrc = { name: soundSrc } as any;
    }

    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.source = soundSrc;
    nativeProps.onFinishViro = this._onFinish;
    nativeProps.onErrorViro = this._onError;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };

    return <VRTSound {...nativeProps} />;
  }

  seekToTime = (timeInSeconds: number) => {
    switch (Platform.OS) {
      case "ios":
        NativeModules.VRTSoundManager.seekToTime(
          findNodeHandle(this),
          timeInSeconds
        );
        break;
      case "android":
        NativeModules.UIManager.dispatchViewManagerCommand(
          findNodeHandle(this),
          NativeModules.UIManager.VRTSound.Commands.seekToTime,
          [timeInSeconds]
        );
        break;
    }
  };
}

var VRTSound = requireNativeComponent(
  "VRTSound",
  // @ts-ignore
  ViroSound,
  {
    nativeOnly: {
      onFinishViro: true,
      onErrorViro: true,
    },
  }
);
