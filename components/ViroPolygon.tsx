/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroPolygon
 * @flow
 */
"use strict";

import * as React from "react";
import { requireNativeComponent } from "react-native";
import { ViroStyle } from "./Styles/ViroStyle";
import {
  Viro2DPoint,
  ViroNativeRef,
  ViroUVCoordinate,
} from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroBase } from "./ViroBase";

type Props = {
  /**
   * An array of boundary vertex positions in local model space.
   * Each point is a 2D array consisting of an X and a Y coordinate.
   * For example:
   * ```typescript
   * vertices={[[-1,0], [0,1], [1,0]]}
   * ```
   */
  vertices: Viro2DPoint[];
  /**
   * An array of arrays. Each inner array contains the boundary
   * vertex positions that define a hole in the polygon.
   * Each vertex position is a 2D array consisting of an X and a
   * Y coordinate in local model space. For example:
   * ```typescript
   * holes={[
   *   [[-0.75, -0.75], [-0.75, -0.50], [-0.50, -0.50], [-0.50, -0.75]],
   *   [[ 0.75, -0.75], [0.75, -0.50], [0.50, -0.50], [0.50, -0.75]]
   * ]}.
   * ```
   */
  holes: Viro2DPoint[][];
  /**
   * An array of 4 values [u0, v0, u1, v1] representing the UV-coordinates which
   * determines how a texture should be tiled across the surface.
   *
   * Texture coordinates are represented on 2D U and V axes (essentially
   * the X and Y axes of the image). The left edge of a texture is U = 0.0
   * and the right edge of the texture is U = 1.0. Similarly, the top edge o
   * f a texture is V=0.0 and the bottom edge of the texture is V=1.0.
   *
   * Specifying greater than 1.0 on either the U or V axis will cause the
   * tile to repeat itself or clamp, depending on the Material's wrapS and
   * wrapT properties. Specifying less than 1.0 on the U or V axis will render
   * that texture partially over the entire surface.
   */
  uvCoordinates?: ViroUVCoordinate;
  style?: ViroStyle;
};

/**
 * Used to render a ViroPolygon
 */
export class ViroPolygon extends ViroBase<Props> {
  render() {
    checkMisnamedProps("ViroPolygon", this.props);

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

    let transformDelegate =
      this.props.onTransformUpdate != undefined
        ? this._onNativeTransformUpdate
        : undefined;

    // Create native props object.
    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.onNativeTransformDelegateViro = transformDelegate;
    nativeProps.hasTransformDelegate =
      this.props.onTransformUpdate != undefined;
    nativeProps.materials = materials;
    nativeProps.transformBehaviors = transformBehaviors;
    nativeProps.style = [this.props.style];
    nativeProps.onHoverViro = this._onHover;
    nativeProps.onClickViro = this._onClickState;
    nativeProps.onTouchViro = this._onTouch;
    nativeProps.onScrollViro = this._onScroll;
    nativeProps.onSwipeViro = this._onSwipe;
    nativeProps.onDragViro = this._onDrag;
    nativeProps.onPinchViro = this._onPinch;
    nativeProps.onRotateViro = this._onRotate;
    nativeProps.canHover = this.props.onHover != undefined;
    nativeProps.canClick =
      this.props.onClick != undefined || this.props.onClickState != undefined;
    nativeProps.canTouch = this.props.onTouch != undefined;
    nativeProps.canScroll = this.props.onScroll != undefined;
    nativeProps.canSwipe = this.props.onSwipe != undefined;
    nativeProps.canDrag = this.props.onDrag != undefined;
    nativeProps.canPinch = this.props.onPinch != undefined;
    nativeProps.canRotate = this.props.onRotate != undefined;
    nativeProps.canFuse = this.props.onFuse != undefined;
    nativeProps.onFuseViro = this._onFuse;
    nativeProps.onAnimationStartViro = this._onAnimationStart;
    nativeProps.onAnimationFinishViro = this._onAnimationFinish;
    nativeProps.timeToFuse = timeToFuse;
    nativeProps.canCollide = this.props.onCollision != undefined;
    nativeProps.onCollisionViro = this._onCollision;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };

    return <VRTPolygon {...nativeProps} />;
  }
}

var VRTPolygon = requireNativeComponent(
  "VRTPolygon",
  // @ts-ignore
  ViroPolygon,
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
      onHoverViro: true,
      onClickViro: true,
      onTouchViro: true,
      onScrollViro: true,
      onSwipeViro: true,
      onDragViro: true,
      onPinchViro: true,
      onRotateViro: true,
      canFuse: true,
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
