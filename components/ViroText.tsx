/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroText
 * @flow
 */
"use strict";

import * as React from "react";
import { ColorValue, processColor, requireNativeComponent } from "react-native";
import { ViroTextStyle } from "./Styles/ViroTextStyle";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroBase } from "./ViroBase";

type Props = {
  text: string;
  color?: ColorValue;
  extrusionDepth?: number;
  style?: ViroTextStyle;
  outerStroke?: {
    type?: "None" | "Outline" | "DropShadow";
    width?: number;
    color?: ColorValue;
  };

  maxLines?: number;
  textClipMode?: "None" | "ClipToBounds";
  textLineBreakMode?: "WordWrap" | "CharWrap" | "Justify" | "None";
};

/**
 * Used to render a ViroText
 */
export class ViroText extends ViroBase<Props> {
  render() {
    checkMisnamedProps("ViroText", this.props);

    // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
    let materials =
      typeof this.props.materials === "string"
        ? new Array(this.props.materials)
        : this.props.materials;
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

    let outerStroke = undefined;
    if (this.props.outerStroke) {
      let outerStrokeColor = this.props.outerStroke.color;
      let processedColor = processColor(outerStrokeColor);
      outerStroke = {
        type: this.props.outerStroke.type,
        width: this.props.outerStroke.width,
        color: processedColor,
      };
    }

    let transformDelegate =
      this.props.onTransformUpdate != undefined
        ? this._onNativeTransformUpdate
        : undefined;

    return (
      <VRTText
        {...this.props}
        ref={(component) => {
          this._component = component;
        }}
        onNativeTransformDelegateViro={transformDelegate}
        hasTransformDelegate={this.props.onTransformUpdate != undefined}
        style={[this.props.style]}
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
        materials={materials}
        transformBehaviors={transformBehaviors}
        outerStroke={outerStroke}
        canCollide={this.props.onCollision != undefined}
        onCollisionViro={this._onCollision}
        timeToFuse={timeToFuse}
      />
    );
  }
}

var VRTText = requireNativeComponent<any>(
  "VRTText",
  // @ts-ignore
  ViroText,
  {
    nativeOnly: {
      scale: [1, 1, 1],
      scalePivot: [0, 0, 0],
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
