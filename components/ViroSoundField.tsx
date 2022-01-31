/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSoundField
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
import { ViroNativeRef, ViroRotation, ViroSource } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";

type Props = ViewProps & {
  // Source can either be a String referencing a preloaded file, a web uri, or a
  // local js file (using require())
  source: ViroSource;

  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  rotation: ViroRotation;
  onFinish?: (event: NativeSyntheticEvent<ViroSoundFinishEvent>) => void;
  onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};

export class ViroSoundField extends React.Component<Props> {
  _component: ViroNativeRef = null;

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
    checkMisnamedProps("ViroSoundField", this.props);

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
    nativeProps.onErrorViro = this._onError;
    nativeProps.onFinishViro = this._onFinish;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };

    return <VRTSoundField {...nativeProps} />;
  }

  seekToTime = (timeInSeconds: number) => {
    switch (Platform.OS) {
      case "ios":
        NativeModules.VRTSoundFieldManager.seekToTime(
          findNodeHandle(this),
          timeInSeconds
        );
        break;
      case "android":
        NativeModules.UIManager.dispatchViewManagerCommand(
          findNodeHandle(this),
          NativeModules.UIManager.VRTSoundField.Commands.seekToTime,
          [timeInSeconds]
        );
        break;
    }
  };
}

var VRTSoundField = requireNativeComponent(
  "VRTSoundField",
  // @ts-ignore
  ViroSoundField,
  {
    nativeOnly: {
      onFinishViro: true,
      onErrorViro: true,
    },
  }
);
