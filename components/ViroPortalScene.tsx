/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroPortalScene
 */

"use strict";

import * as React from "react";
import { NativeSyntheticEvent, requireNativeComponent } from "react-native";
import { ViroCommonProps } from "./AR/ViroCommonProps";
import { ViroPortalEnterEvent, ViroPortalExitEvent } from "./Types/ViroEvents";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroBase } from "./ViroBase";

type Props = ViroCommonProps & {
  onPortalEnter?: (event: NativeSyntheticEvent<ViroPortalEnterEvent>) => void;
  onPortalExit?: (event: NativeSyntheticEvent<ViroPortalExitEvent>) => void;

  passable?: boolean;
};

/**
 * Portal container for revealing different sections of the scene graph.
 */
export class ViroPortalScene extends ViroBase<Props> {
  _onPortalEnter = (event: NativeSyntheticEvent<ViroPortalEnterEvent>) => {
    this.props.onPortalEnter && this.props.onPortalEnter(event);
  };

  _onPortalExit = (event: NativeSyntheticEvent<ViroPortalExitEvent>) => {
    this.props.onPortalExit && this.props.onPortalExit(event);
  };

  render() {
    checkMisnamedProps("ViroPortalScene", this.props);

    // Since transformBehaviors can be either a string or an array, convert the string to a 1-element array.
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

    return (
      <VRTPortalScene
        {...this.props}
        ref={(component) => {
          this._component = component;
        }}
        onNativeTransformDelegateViro={transformDelegate}
        hasTransformDelegate={this.props.onTransformUpdate != undefined}
        transformBehaviors={transformBehaviors}
        canHover={this.props.onHover != undefined}
        canClick={
          this.props.onClick != undefined ||
          this.props.onClickState != undefined
        }
        canTouch={this.props.onTouch != undefined}
        canScroll={this.props.onScroll != undefined}
        canSwipe={this.props.onSwipe != undefined}
        canDrag={this.props.onDrag != undefined}
        canFuse={this.props.onFuse != undefined}
        canPinch={this.props.onPinch != undefined}
        canRotate={this.props.onRotate != undefined}
        onHoverViro={this._onHover}
        onClickViro={this._onClickState}
        onTouchViro={this._onTouch}
        onScrollViro={this._onScroll}
        onSwipeViro={this._onSwipe}
        onDragViro={this._onDrag}
        onFuseViro={this._onFuse}
        onPinchViro={this._onPinch}
        onRotateViro={this._onRotate}
        onPortalEnterViro={this._onPortalEnter}
        onPortalExitViro={this._onPortalExit}
        onAnimationStartViro={this._onAnimationStart}
        onAnimationFinishViro={this._onAnimationFinish}
        timeToFuse={timeToFuse}
        canCollide={this.props.onCollision != undefined}
        onCollisionViro={this._onCollision}
      />
    );
  }
}

var VRTPortalScene = requireNativeComponent<any>(
  "VRTPortalScene",
  // @ts-ignore
  ViroPortalScene,
  {
    nativeOnly: {
      physicsBody: {},
      materials: [],
      canHover: true,
      canClick: true,
      canTouch: true,
      canScroll: true,
      canSwipe: true,
      canDrag: true,
      canFuse: true,
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
      onFuseViro: true,
      onPortalEnterViro: true,
      onPortalExitViro: true,
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
