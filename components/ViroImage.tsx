/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroImage
 * @flow
 */
"use strict";

import * as React from "react";
import {
  NativeModules,
  NativeSyntheticEvent,
  Platform,
  requireNativeComponent,
} from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import { ViroStyle } from "./Styles/ViroStyle";
import { ViroLoadEndEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroBase } from "./ViroBase";
const ViroImageModule = NativeModules.VRTImageModule;

type Props = {
  source: ViroSource;
  style?: ViroStyle;

  resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
  imageClipMode?: "None" | "ClipToBounds";
  stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
  // Required to be local source static image by using require(''./image.jpg').
  // or by specifying local uri.
  // If not set, the image will be transparent until the source is downloaded
  placeholderSource?: ViroSource;

  /**
   * DEPRECATION WARNING: DO NOT USE THE FOLLOWING PROP!
   * @deprecated
   */
  placeHolderSource?: ViroSource;

  mipmap?: boolean;
  format?: "RGBA8" | "RGB565";
  /**
   * Callback triggered when we are processing the assets to be
   * displayed in this ViroImage (either downloading / reading from file).
   */
  onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;

  /**
   * Callback triggered when we have finished processing assets to be
   * displayed. Wether or not assets were processed successfully and
   * thus displayed will be indicated by the parameter "success".
   * For example:
   *
   *   _onLoadEnd(event:Event){
   *      // Indication of asset loading success
   *      event.nativeEvent.success
   *   }
   *
   */
  onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
};

/**
 * Used to render a ViroImage
 */
export class ViroImage extends ViroBase<Props> {
  _onLoadStart = (event: NativeSyntheticEvent<ViroLoadStartEvent>) => {
    this.props.onLoadStart && this.props.onLoadStart(event);
  };

  _onLoadEnd = (event: NativeSyntheticEvent<ViroLoadEndEvent>) => {
    this.props.onLoadEnd && this.props.onLoadEnd(event);
  };

  render() {
    checkMisnamedProps("ViroImage", this.props);

    var defaultPlaceholder = require("./Resources/viro_blank.png");
    var imgsrc = resolveAssetSource(this.props.source);
    var placeholderSrc;

    if (this.props.placeholderSource) {
      placeholderSrc = resolveAssetSource(this.props.placeholderSource);
    } else {
      switch (Platform.OS) {
        case "ios":
          /*
          On iOS in dev mode, it takes time to download the default placeholder,
          so we use the renderer to set transparency instead.
          */
          break;
        case "android":
          placeholderSrc = resolveAssetSource(defaultPlaceholder);
          break;
      }
    }

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
    nativeProps.source = imgsrc;
    nativeProps.placeHolderSource = placeholderSrc;
    nativeProps.placeholderSource = placeholderSrc;
    nativeProps.transformBehaviors = transformBehaviors;
    nativeProps.onLoadStartViro = this._onLoadStart;
    nativeProps.onLoadEndViro = this._onLoadEnd;
    nativeProps.onErrorViro = this._onError;
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
    nativeProps.canFuse = this.props.onFuse != undefined;
    nativeProps.canPinch = this.props.onPinch != undefined;
    nativeProps.canRotate = this.props.onRotate != undefined;
    nativeProps.onFuseViro = this._onFuse;
    nativeProps.onAnimationStartViro = this._onAnimationStart;
    nativeProps.onAnimationFinishViro = this._onAnimationFinish;
    nativeProps.timeToFuse = timeToFuse;
    nativeProps.canCollide = this.props.onCollision != undefined;
    nativeProps.onCollisionViro = this._onCollision;
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };
    return <VRTImage {...nativeProps} />;
  }

  // Used to evict a given imageSource from the cache. This is Android-only
  // because the Fresco (RN's Image caching library) caches images by their
  // uri's. If you replace 1 image with another, then the first image will
  // be cached if they have the same imageSource.
  static evictFromCache = (imageSource: ViroSource) => {
    if (Platform.OS == "android") {
      var image = resolveAssetSource(imageSource);
      ViroImageModule.evictFromCache(image);
    }
  };
}

var VRTImage = requireNativeComponent<any>(
  "VRTImage",
  // @ts-ignore
  ViroImage,
  {
    nativeOnly: {
      onLoadStartViro: true,
      onLoadEndViro: true,
      onErrorViro: true,
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
