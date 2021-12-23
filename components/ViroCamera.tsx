/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroCamera
 * @flow
 */

import * as React from "react";
import {
  NativeSyntheticEvent,
  requireNativeComponent,
  ViewProps,
} from "react-native";
import {
  ViroAnimationFinishEvent,
  ViroAnimationStartEvent,
} from "./Types/ViroEvents";
import { Viro3DPoint, ViroRotation } from "./Types/ViroUtils";
import { ViroSceneContext } from "./ViroSceneContext";

type Props = ViewProps & {
  position?: Viro3DPoint;
  rotation?: ViroRotation;
  active: boolean;
  animation?: {
    name?: string;
    delay?: number;
    loop?: boolean;
    onStart?: () => void;
    onFinish?: () => void;
    run?: boolean;
    interruptible?: boolean;
  };
  fieldOfView?: number;
};

type State = {
  active: boolean;
};

export class ViroCamera extends React.Component<Props, State> {
  _component: any;
  static contextType?: React.Context<any> | undefined = ViroSceneContext;

  componentDidMount() {
    this.context.cameraDidMount(this);
  }

  componentWillUnmount() {
    this.context.cameraWillUnmount(this);
  }

  componentDidUpdate(prevProps: Props, _prevState: State) {
    if (prevProps.active != this.props.active) {
      this.context.cameraDidUpdate(this, this.props.active);
    }
  }

  setNativeProps = (nativeProps: any) => {
    this._component?.setNativeProps(nativeProps);
  };

  _onAnimationStart = (
    _event: NativeSyntheticEvent<ViroAnimationStartEvent>
  ) => {
    this.props.animation &&
      this.props.animation.onStart &&
      this.props.animation.onStart();
  };

  _onAnimationFinish = (
    _event: NativeSyntheticEvent<ViroAnimationFinishEvent>
  ) => {
    this.props.animation &&
      this.props.animation.onFinish &&
      this.props.animation.onFinish();
  };

  render() {
    // Uncomment this to check props
    //checkMisnamedProps("ViroCamera", this.props);

    return (
      <VRTCamera
        ref={(component) => {
          this._component = component;
        }}
        {...this.props}
        onAnimationStartViro={this._onAnimationStart}
        onAnimationFinishViro={this._onAnimationFinish}
      />
    );
  }
}

var VRTCamera = requireNativeComponent<any>(
  "VRTCamera",
  // @ts-ignore
  ViroCamera,
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
      onAnimationStartViro: true,
      onAnimationFinishViro: true,
      ignoreEventHandling: true,
      dragPlane: true,
      renderingOrder: true,
    },
  }
);
