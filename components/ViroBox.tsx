/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import * as React from "react";
import { requireNativeComponent } from "react-native";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroBase } from "./ViroBase";

export class ViroBox extends ViroBase<{}> {
  render() {
    checkMisnamedProps("ViroBox", this.props);

    // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
    let materials =
      typeof this.props.materials === "string"
        ? new Array(this.props.materials)
        : this.props.materials;
    let transformBehaviors =
      typeof this.props.transformBehaviors === "string"
        ? new Array(this.props.transformBehaviors)
        : this.props.transformBehaviors;

    if (materials) {
      if (materials.length != 1 && materials.length != 6) {
        console.error(
          "<ViroBox> can only take 1 material for all sides or 6, one for each side."
        );
      }
    }

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

    let highAccuracyEvents = this.props.highAccuracyEvents;
    if (
      this.props.highAccuracyEvents == undefined &&
      this.props.highAccuracyGaze != undefined
    ) {
      console.warn(
        "**DEPRECATION WARNING** highAccuracyGaze has been deprecated/renamed to highAccuracyEvents"
      );
      highAccuracyEvents = this.props.highAccuracyGaze;
    }

    return (
      <VRTBox
        {...this.props}
        ref={(component) => {
          this._component = component;
        }}
        highAccuracyEvents={highAccuracyEvents}
        transformBehaviors={transformBehaviors}
        onNativeTransformDelegateViro={transformDelegate}
        hasTransformDelegate={this.props.onTransformUpdate != undefined}
        materials={materials}
        canHover={this.props.onHover != undefined}
        canClick={
          this.props.onClick != undefined ||
          this.props.onClickState != undefined
        }
        canTouch={this.props.onTouch != undefined}
        canScroll={this.props.onScroll != undefined}
        canSwipe={this.props.onSwipe != undefined}
        canDrag={this.props.onDrag != undefined}
        canPinch={this.props.onPinch != undefined}
        canRotate={this.props.onRotate != undefined}
        canFuse={this.props.onFuse != undefined}
        onHoverViro={this._onHover}
        onClickViro={this._onClickState}
        onTouchViro={this._onTouch}
        onScrollViro={this._onScroll}
        onSwipeViro={this._onSwipe}
        onDragViro={this._onDrag}
        onPinchViro={this._onPinch}
        onRotateViro={this._onRotate}
        onFuseViro={this._onFuse}
        onAnimationStartViro={this._onAnimationStart}
        onAnimationFinishViro={this._onAnimationFinish}
        canCollide={this.props.onCollision != undefined}
        onCollisionViro={this._onCollision}
        timeToFuse={timeToFuse}
      />
    );
  }
}

var VRTBox = requireNativeComponent<any>(
  "VRTBox",
  // @ts-ignore
  ViroBox,
  {
    nativeOnly: {
      canHover: true,
      canClick: true,
      canTouch: true,
      canScroll: true,
      canSwipe: true,
      canDrag: true,
      canPinch: true,
      canRotate: true,
      canFuse: true,
      onHoverViro: true,
      onClickViro: true,
      onTouchViro: true,
      onScrollViro: true,
      onSwipeViro: true,
      onDragViro: true,
      onPinchViro: true,
      onRotateViro: true,
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
