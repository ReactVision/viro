/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Viro360Image
 * @flow
 */
"use strict";

import * as React from "react";
import {
  NativeSyntheticEvent,
  requireNativeComponent,
  ViewProps,
} from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import {
  ViroLoadEndEvent,
  ViroLoadErrorEvent,
  ViroLoadStartEvent,
} from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";

type Props = ViewProps & {
  /**
   * The hdr image file, which is required
   */
  source: ViroSource;
  /**
   * Callback triggered when we are processing the assets to be
   * used in computing this lighting environment (either downloading / reading from file).
   */
  onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;

  /**
   * Callback triggered when we have finished processing assets to be
   * used in computing this lighting environment. Wether or not assets were
   * processed successfully will be indicated by the parameter "success".
   * For example:
   *
   *   _onLoadEnd(event:Event){
   *      // Indication of asset loading success
   *      event.nativeEvent.success
   *   }
   *
   */
  onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;

  /**
   * Callback triggered when the hdr image fails to load. Invoked with
   * {nativeEvent: {error}}
   */
  onError?: (event: NativeSyntheticEvent<ViroLoadErrorEvent>) => void;
};

export class ViroLightingEnvironment extends React.Component<Props> {
  _component: ViroNativeRef = null;

  _onLoadStart = (event: NativeSyntheticEvent<ViroLoadStartEvent>) => {
    this.props.onLoadStart && this.props.onLoadStart(event);
  };

  _onLoadEnd = (event: NativeSyntheticEvent<ViroLoadEndEvent>) => {
    this.props.onLoadEnd && this.props.onLoadEnd(event);
  };

  _onError = (event: NativeSyntheticEvent<ViroLoadErrorEvent>) => {
    this.props.onError && this.props.onError(event);
  };

  setNativeProps = (nativeProps: Props) => {
    this._component?.setNativeProps(nativeProps);
  };

  render() {
    checkMisnamedProps("ViroLightingEnvironment", this.props);

    var imgsrc = resolveAssetSource(this.props.source);

    // Create native props object.
    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.source = imgsrc;
    nativeProps.onErrorViro = this._onError;
    nativeProps.onLoadStartViro = this._onLoadStart;
    nativeProps.onLoadEndViro = this._onLoadEnd;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };

    return <VRTLightingEnvironment {...nativeProps} />;
  }
}

var VRTLightingEnvironment = requireNativeComponent<any>(
  "VRTLightingEnvironment",
  // @ts-ignore
  ViroLightingEnvironment,
  {
    nativeOnly: {
      onLoadStartViro: true,
      onErrorViro: true,
      onLoadEndViro: true,
    },
  }
);
