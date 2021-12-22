/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
"use strict";

import * as React from "react";
import {
  findNodeHandle,
  NativeSyntheticEvent,
  requireNativeComponent,
} from "react-native";
import { NativeModules } from "react-native";
import { ViroCommonProps, ViroObjectProps } from "./AR/ViroCommonProps";
import {
  ViroClickEvent,
  ViroClickStateEvent,
  ViroClickStateTypes,
  ViroControllerStatus,
  ViroControllerStatusEvent,
  ViroDragEvent,
  ViroFuseEvent,
  ViroPinchEvent,
  ViroRotateEvent,
  ViroScrollEvent,
  ViroSwipeEvent,
  ViroTouchEvent,
} from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";

const ViroControllerModule = NativeModules.VRTControllerModule;

type Props = ViroCommonProps &
  ViroObjectProps & {
    onSwipe?: () => void;
    onControllerStatus?: (
      status: ViroControllerStatus,
      source: ViroSource
    ) => void;
    reticleVisibility?: boolean;
    controllerVisibility?: boolean;
  };

export class ViroController extends React.Component<Props> {
  _component: ViroNativeRef = null;

  _onClick(event: NativeSyntheticEvent<ViroClickEvent>) {
    this.props.onClick &&
      this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
  }

  _onClickState(event: NativeSyntheticEvent<ViroClickStateEvent>) {
    this.props.onClickState &&
      this.props.onClickState(
        event.nativeEvent.clickState,
        event.nativeEvent.position,
        event.nativeEvent.source
      );
    let CLICKED = ViroClickStateTypes.CLICKED; // Value representation of Clicked ClickState within EventDelegateJni.
    if (event.nativeEvent.clickState == CLICKED) {
      this._onClick(event);
    }
  }

  _onTouch(event: NativeSyntheticEvent<ViroTouchEvent>) {
    this.props.onTouch &&
      this.props.onTouch(
        event.nativeEvent.touchState,
        event.nativeEvent.touchPos,
        event.nativeEvent.source
      );
  }

  _onScroll(event: NativeSyntheticEvent<ViroScrollEvent>) {
    this.props.onScroll &&
      this.props.onScroll(
        event.nativeEvent.scrollPos,
        event.nativeEvent.source
      );
  }

  _onSwipe(event: NativeSyntheticEvent<ViroSwipeEvent>) {
    this.props.onSwipe &&
      this.props.onSwipe(
        event.nativeEvent.swipeState,
        event.nativeEvent.source
      );
  }

  _onControllerStatus(event: NativeSyntheticEvent<ViroControllerStatusEvent>) {
    this.props.onControllerStatus &&
      this.props.onControllerStatus(
        event.nativeEvent.controllerStatus,
        event.nativeEvent.source
      );
  }

  _onFuse = (event: NativeSyntheticEvent<ViroFuseEvent>) => {
    if (this.props.onFuse) {
      if (typeof this.props.onFuse === "function") {
        this.props.onFuse(event.nativeEvent.source);
      } else if (this.props.onFuse?.callback) {
        this.props.onFuse.callback(event.nativeEvent.source);
      }
    }
  };

  _onPinch(event: NativeSyntheticEvent<ViroPinchEvent>) {
    this.props.onPinch &&
      this.props.onPinch(
        event.nativeEvent.pinchState,
        event.nativeEvent.scaleFactor,
        event.nativeEvent.source
      );
  }

  _onRotate(event: NativeSyntheticEvent<ViroRotateEvent>) {
    this.props.onRotate &&
      this.props.onRotate(
        event.nativeEvent.rotateState,
        event.nativeEvent.rotationFactor,
        event.nativeEvent.source
      );
  }

  async getControllerForwardAsync() {
    return await ViroControllerModule.getForwardVectorAsync(
      findNodeHandle(this)
    );
  }

  setNativeProps(nativeProps: Props) {
    this._component?.setNativeProps(nativeProps);
  }

  _onDrag(event: NativeSyntheticEvent<ViroDragEvent>) {
    this.props.onDrag &&
      this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
  }

  render() {
    // Uncomment this line to check for misnamed props
    //checkMisnamedProps("ViroController", this.props);

    return (
      <VRTController
        {...this.props}
        ref={(component) => {
          this._component = component;
        }}
        canClick={
          this.props.onClick != undefined ||
          this.props.onClickState != undefined
        }
        canTouch={this.props.onTouch != undefined}
        canScroll={this.props.onScroll != undefined}
        canSwipe={this.props.onSwipe != undefined}
        canGetControllerStatus={this.props.onControllerStatus != undefined}
        canDrag={this.props.onDrag != undefined}
        canPinch={this.props.onPinch != undefined}
        canRotate={this.props.onRotate != undefined}
        canFuse={this.props.onFuse != undefined}
        onClickViro={this._onClickState}
        onTouchViro={this._onTouch}
        onScrollViro={this._onScroll}
        onSwipeViro={this._onSwipe}
        onDragViro={this._onDrag}
        onPinchViro={this._onPinch}
        onRotateViro={this._onRotate}
        onFuseViro={this._onFuse}
        onControllerStatusViro={this._onControllerStatus}
      />
    );
  }
}

var VRTController = requireNativeComponent<any>(
  "VRTController",
  // @ts-ignore
  ViroController,
  {
    nativeOnly: {
      canClick: true,
      canTouch: true,
      canScroll: true,
      canSwipe: true,
      canDrag: true,
      canPinch: true,
      canRotate: true,
      canFuse: true,
      canGetControllerStatus: true,
      onClickViro: true,
      onTouchViro: true,
      onScrollViro: true,
      onSwipeViro: true,
      onControllerStatusViro: true,
      onDragViro: true,
      onPinchViro: true,
      onRotateViro: true,
      onFuseViro: true,
      timeToFuse: true,
    },
  }
);
