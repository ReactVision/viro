/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSkyBox
 * @flow
 */
"use strict";

import * as React from "react";
import {
  ColorValue,
  NativeSyntheticEvent,
  requireNativeComponent,
  ViewProps,
} from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import { ViroCubeMap, ViroResolvedCubeMap } from "./Material/ViroMaterials";
import { ViroLoadEndEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";

type Props = ViewProps & {
  source?: ViroCubeMap;
  color?: ColorValue;
  format?: "RGBA8" | "RGB565";
  onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
  onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
};

/**
 * Used to render a skybox as a scene background.
 */
export class ViroSkyBox extends React.Component<Props> {
  _component: ViroNativeRef = null;

  _onLoadStart = (event: NativeSyntheticEvent<ViroLoadStartEvent>) => {
    this.props.onLoadStart && this.props.onLoadStart(event);
  };

  _onLoadEnd = (event: NativeSyntheticEvent<ViroLoadEndEvent>) => {
    this.props.onLoadEnd && this.props.onLoadEnd(event);
  };

  setNativeProps = (nativeProps: Props) => {
    this._component?.setNativeProps(nativeProps);
  };

  render() {
    checkMisnamedProps("ViroSkyBox", this.props);

    // Create and set the native props.
    var skyboxDict: any = {};
    let nativeProps = Object.assign({} as any, this.props);

    if (this.props.source !== undefined) {
      for (var key in this.props.source) {
        var s = resolveAssetSource(this.props.source[key as keyof ViroCubeMap]);
        skyboxDict[key] = s;
      }
      nativeProps.source = skyboxDict as ViroResolvedCubeMap;
    }

    nativeProps.onViroSkyBoxLoadStart = this._onLoadStart;
    nativeProps.onViroSkyBoxLoadEnd = this._onLoadEnd;
    nativeProps.color = this.props.color;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };

    return <VRTSkyBox {...nativeProps} />;
  }
}

var VRTSkyBox = requireNativeComponent(
  "VRTSkybox",
  // @ts-ignore
  ViroSkyBox,
  {
    nativeOnly: { onViroSkyBoxLoadStart: true, onViroSkyBoxLoadEnd: true },
  }
);
