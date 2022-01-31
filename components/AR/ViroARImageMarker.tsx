/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARImageMarker
 */

"use strict";

import * as React from "react";
import { NativeSyntheticEvent, requireNativeComponent } from "react-native";
import {
  ViroARAnchorFoundEvent,
  ViroARAnchorRemovedEvent,
  ViroARAnchorUpdatedEvent,
} from "../Types/ViroEvents";
import { ViroBase } from "../ViroBase";

/**
 * Container for Viro Components anchored to a detected image.
 */
export class ViroARImageMarker extends ViroBase<{}> {
  _onAnchorFound = (event: NativeSyntheticEvent<ViroARAnchorFoundEvent>) => {
    if (this.props.onAnchorFound) {
      this.props.onAnchorFound(event.nativeEvent.anchorFoundMap);
    }
  };

  _onAnchorUpdated = (
    event: NativeSyntheticEvent<ViroARAnchorUpdatedEvent>
  ) => {
    if (this.props.onAnchorUpdated) {
      this.props.onAnchorUpdated(event.nativeEvent.anchorUpdatedMap);
    }
  };

  _onAnchorRemoved = (
    _event: NativeSyntheticEvent<ViroARAnchorRemovedEvent>
  ) => {
    if (this.props.onAnchorRemoved) {
      this.props.onAnchorRemoved();
    }
  };

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroARImageMarker", this.props);

    let timeToFuse = undefined;
    if (
      this.props.onFuse != undefined &&
      typeof this.props.onFuse === "object"
    ) {
      timeToFuse = this.props.onFuse.timeToFuse;
    }

    return (
      <VRTARImageMarker
        {...this.props}
        ref={(component) => {
          this._component = component;
        }}
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
        timeToFuse={timeToFuse}
        canCollide={this.props.onCollision != undefined}
        onCollisionViro={this._onCollision}
        onAnchorFoundViro={this._onAnchorFound}
        onAnchorUpdatedViro={this._onAnchorUpdated}
        onAnchorRemovedViro={this._onAnchorRemoved}
      />
    );
  }
}

var VRTARImageMarker = requireNativeComponent<any>(
  "VRTARImageMarker",
  // @ts-ignore
  ViroARImageMarker,
  {
    nativeOnly: {
      position: [],
      scale: [],
      rotation: [],
      scalePivot: [],
      rotationPivot: [],
      animation: {},
      materials: [],
      physicsBody: {},
      transformBehaviors: [],
      hasTransformDelegate: true,
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
      onAnchorFoundViro: true,
      onAnchorUpdatedViro: true,
      onAnchorRemovedViro: true,
    },
  }
);
