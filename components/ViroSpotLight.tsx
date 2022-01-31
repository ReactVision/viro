/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSpotLight
 * @flow
 */
"use strict";

import * as React from "react";
import { ColorValue, requireNativeComponent, ViewProps } from "react-native";
import { Viro3DPoint, ViroNativeRef } from "./Types/ViroUtils";

type Props = ViewProps & {
  position?: Viro3DPoint;
  color?: ColorValue;
  intensity?: number;
  temperature?: number;
  direction?: Viro3DPoint;
  attenuationStartDistance?: number;
  attenuationEndDistance?: number;
  innerAngle?: number;
  outerAngle?: number;
  influenceBitMask?: number;

  // Shadow Properties
  castsShadow?: boolean;
  shadowOpacity?: number;
  shadowMapSize?: number;
  shadowBias?: number;
  shadowNearZ?: number;
  shadowFarZ?: number;
};
/**
 * Used to render a ViroSpotLight
 */
export class ViroSpotLight extends React.Component<Props> {
  _component: ViroNativeRef = null;

  setNativeProps(nativeProps: Props) {
    this._component?.setNativeProps(nativeProps);
  }

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroSpotLight", this.props);

    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.style = [this.props.style];
    nativeProps.color = this.props.color;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };

    return <VRTSpotLight {...nativeProps} />;
  }
}

var VRTSpotLight = requireNativeComponent(
  "VRTSpotLight",
  // @ts-ignore
  ViroSpotLight
);
