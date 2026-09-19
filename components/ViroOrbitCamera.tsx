/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroOrbitCamera
 * @flow
 */
"use strict";

import * as React from "react";
import { requireNativeComponent, ViewProps } from "react-native";
import { ViroAnimation } from "./Animation/ViroAnimations";
import { Viro3DPoint, ViroNativeRef } from "./Types/ViroUtils";
import { ViroSceneContext } from "./ViroSceneContext";

export type Props = ViewProps & {
  position?: Viro3DPoint;
  focalPoint?: Viro3DPoint;
  active: boolean;
  animation?: ViroAnimation;
  fieldOfView?: number;

  /**
   * "perspective" (the default) or "orthographic".
   *
   * Orthographic keeps parallel lines parallel, which is what a floor plan, blueprint, isometric
   * or CAD-style view needs. A perspective camera makes parallel aisles converge, and on a map
   * that reads as a mistake rather than as depth.
   *
   * AR and VR scenes ignore this: there the projection comes from the device.
   */
  projection?: "perspective" | "orthographic";

  /**
   * Height of the orthographic view in world units — the full height, not the half-height. The
   * width follows from the viewport's aspect ratio, so proportions hold when the view resizes.
   *
   * Only meaningful when `projection` is "orthographic".
   */
  orthographicScale?: number;

};

export class ViroOrbitCamera extends React.Component<Props> {
  _component: ViroNativeRef = null;

  static contextType?: React.Context<any> | undefined = ViroSceneContext;
  declare context: React.ContextType<typeof ViroSceneContext>;

  componentDidMount() {
    this.context.cameraDidMount(this);
  }

  componentWillUnmount() {
    this.context.cameraWillUnmount(this);
  }

  componentDidUpdate(prevProps: Props, _prevState: any) {
    if (prevProps.active != this.props.active) {
      this.context.cameraDidUpdate(this, this.props.active);
    }
  }

  setNativeProps = (nativeProps: Props) => {
    this._component?.setNativeProps(nativeProps);
  };

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroOrbitCamera", this.props);

    return (
      <VRTOrbitCamera
        ref={(component) => {
          this._component = component;
        }}
        {...this.props}
      />
    );
  }
}

var VRTOrbitCamera = requireNativeComponent(
  "VRTOrbitCamera",
  // @ts-ignore
  ViroOrbitCamera,
  {
    nativeOnly: {
      scale: [1, 1, 1],
      materials: [],
      visible: true,
      canHover: true,
      canClick: true,
      canTouch: true,
      canScroll: true,
      canSwipe: true,
      canDrag: true,
      canPinch: true,
      canRotate: true,
      onPinchViro: true,
      onRotateViro: true,
      onHoverViro: true,
      onClickViro: true,
      onTouchViro: true,
      onScrollViro: true,
      onSwipeViro: true,
      onDragViro: true,
      transformBehaviors: true,
      canFuse: true,
      onFuseViro: true,
      timeToFuse: true,
      viroTag: true,
      scalePivot: true,
      rotationPivot: true,
      canCollide: true,
      onCollisionViro: true,
      onNativeTransformDelegateViro: true,
      hasTransformDelegate: true,
      physicsBody: true,
      dragType: true,
      dragPlane: true,
      animation: true,
      ignoreEventHandling: true,
      renderingOrder: true,
    },
  }
);
