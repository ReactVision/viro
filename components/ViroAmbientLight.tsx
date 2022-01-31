/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroAmbientLight
 * @flow
 */
"use strict";

import * as React from "react";
import { ColorValue, requireNativeComponent, ViewProps } from "react-native";
import { ViroNativeRef } from "./Types/ViroUtils";

type Props = ViewProps & {
  color?: ColorValue;
  intensity?: number;
  temperature?: number;
  influenceBitMask?: number;
};

/**
 * Used to render a ViroAmbientLight
 */
export class ViroAmbientLight extends React.Component<Props> {
  _component: ViroNativeRef = null;

  setNativeProps(nativeProps: Props) {
    this._component?.setNativeProps(nativeProps);
  }

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroAmbientLight", this.props);

    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.style = [this.props.style];
    nativeProps.color = this.props.color;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };

    return <VRTAmbientLight {...nativeProps} />;
  }
}

var VRTAmbientLight = requireNativeComponent<any>(
  "VRTAmbientLight",
  // @ts-ignore
  ViroAmbientLight
);
