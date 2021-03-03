import React, { Component, useCallback, useRef } from "react";
import {
  requireNativeComponent,
  ViewProps,
  ImageSourcePropType,
  findNodeHandle,
  Image,
  NativeModules,
  NativeMethods,
} from "react-native";
var createReactClass = require("create-react-class");
import PropTypes from "prop-types";

import { checkMisnamedProps } from "./Utilities/ViroProps";

const { resolveAssetSource } = Image;

// Value representation of Clicked ClickState within EventDelegateJni.
const CLICKED = 3;

type Force = {
  value: Array<number>;
  position: Array<number>;
};

type DragPlane = {
  planePoint: Array<number>;
  planeNormal: Array<number>;
  maxDistance?: number;
};

type NativeRef =
  | (React.Component<unknown, {}, any> & Readonly<NativeMethods>)
  | null;

type Props = ViewProps & {
  position?: Array<number>;
  scale?: Array<number>;
  rotation?: Array<number>;
  scalePivot?: Array<number>;
  rotationPivot?: Array<number>;
  materials?: string | Array<string>;
  transformBehaviors?: string | Array<string>;
  type: "OBJ" | "VRX" | "GLTF" | "GLB";
  opacity?: number;
  ignoreEventHandling?: boolean;
  dragType?:
    | "FixedDistance"
    | "FixedDistanceOrigin"
    | "FixedToWorld"
    | "FixedToPlane";
  dragPlane?: DragPlane;

  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;
  onTransformUpdate?: (...args: any) => any;

  /*
   * The model file, which is required
   */
  source: ImageSourcePropType;

  resources?: Array<ImageSourcePropType>;

  animation?: {
    name?: string;
    delay?: number;
    duration?: number;
    loop?: boolean;
    onStart?: (...args: any) => any;
    onFinish?: (...args: any) => any;
    run?: boolean;
    interruptible?: boolean;
  };

  renderingOrder?: number;
  visible?: boolean;

  onHover?: (...args: any) => any;
  onClick?: (...args: any) => any;
  onClickState?: (...args: any) => any;
  onTouch?: (...args: any) => any;
  onScroll?: (...args: any) => any;
  onSwipe?: (...args: any) => any;
  onLoadStart?: (...args: any) => any;
  onLoadEnd?: (...args: any) => any;
  onError?: (...args: any) => any;
  onDrag?: (...args: any) => any;
  onPinch?: (...args: any) => any;
  onRotate?: (...args: any) => any;
  onFuse?:
    | ((...args: any) => any)
    | {
        callback: (...args: any) => any;
        timeToFuse?: number;
      };

  /**
   * Enables high accuracy event collision checks for this object.
   * This can be useful for complex 3D objects where the default
   * checking method of bounding boxes do not provide adequate
   * collision detection coverage.
   *
   * NOTE: Enabling high accuracy event collision checks has a high
   * performance cost and should be used sparingly / only when
   * necessary.
   *
   * Flag is set to false by default.
   */
  highAccuracyEvents?: boolean;

  /* DEPRECATION WARNING - highAccuracyGaze has been deprecated, please use highAccuracyEvents instead */
  highAccuracyGaze?: boolean;

  physicsBody?: {
    type: "Dynamic" | "Kinematic" | "Static";
    mass?: number;
    restitution?: number;
    shape?: {
      type: "Box" | "Sphere" | "Compound";
      params?: Array<number>;
    };
    friction?: number;
    useGravity?: boolean;
    enabled?: boolean;
    velocity?: Array<number>;
    force?: Force | Array<Force>;
    torque?: Array<number>;
  };

  morphTargets?: Array<{
    target?: string;
    weight?: number;
  }>;

  viroTag?: string;
  onCollision?: (...args: any) => any;
};

class Viro3DObject extends Component<Props> {
  render() {
    checkMisnamedProps("Viro3DObject", this.props);
    const modelsrc = resolveAssetSource(this.props.source);
    const resources = this.props.resources?.map((resource) =>
      resolveAssetSource(resource)
    );

    // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
    const materials =
      typeof this.props.materials === "string"
        ? [this.props.materials]
        : this.props.materials;
    const transformBehaviors =
      typeof this.props.transformBehaviors === "string"
        ? [this.props.transformBehaviors]
        : this.props.transformBehaviors;

    // @ts-ignore since onFuse could be a function, but this should be fine either way.
    const timeToFuse = this.props.onFuse?.timeToFuse;

    // Always autogenerate a compound shape for 3DObjects if no shape is defined.
    const newPhysicsBody = this.props.physicsBody && {
      ...this.props.physicsBody,
      shape: this.props.physicsBody.shape || { type: "compound" },
    };

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

    // Called from native on the event a positional change has occured
    // for the underlying control within the renderer.
    const transformDelegate =
      this.props.onTransformUpdate != undefined
        ? this._onNativeTransformUpdate
        : undefined;

    return (
      <VRT3DObject
        {...this.props}
        ref={(component: NativeRef) => {
          this._viro3dobj = component;
        }}
        highAccuracyEvents={highAccuracyEvents}
        onNativeTransformDelegateViro={transformDelegate}
        hasTransformDelegate={this.props.onTransformUpdate != undefined}
        physicsBody={newPhysicsBody}
        source={modelsrc}
        resources={resources}
        materials={materials}
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
        onLoadStartViro={this._onLoadStart}
        onLoadEndViro={this._onLoadEnd}
        onErrorViro={this._onError}
        onAnimationStartViro={this._onAnimationStart}
        onAnimationFinishViro={this._onAnimationFinish}
        timeToFuse={timeToFuse}
        canCollide={this.props.onCollision != undefined}
        onCollisionViro={this._onCollision}
      />
    );
  }

  _viro3dobj?: NativeRef = undefined;

  setNativeProps = (nativeProps: any) => {
    this._viro3dobj?.setNativeProps(nativeProps);
  };

  _onHover = (event: any) => {
    this.props.onHover &&
      this.props.onHover(
        event.nativeEvent.isHovering,
        event.nativeEvent.position,
        event.nativeEvent.source
      );
  };

  _onClick = (event: any) => {
    this.props.onClick &&
      this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
  };

  _onClickState = (event: any) => {
    this.props.onClickState &&
      this.props.onClickState(
        event.nativeEvent.clickState,
        event.nativeEvent.position,
        event.nativeEvent.source
      );

    if (event.nativeEvent.clickState == CLICKED) {
      this._onClick(event);
    }
  };

  _onTouch = (event: any) => {
    this.props.onTouch &&
      this.props.onTouch(
        event.nativeEvent.touchState,
        event.nativeEvent.touchPos,
        event.nativeEvent.source
      );
  };

  _onScroll = (event: any) => {
    this.props.onScroll &&
      this.props.onScroll(
        event.nativeEvent.scrollPos,
        event.nativeEvent.source
      );
  };

  _onSwipe = (event: any) => {
    this.props.onSwipe &&
      this.props.onSwipe(
        event.nativeEvent.swipeState,
        event.nativeEvent.source
      );
  };

  _onLoadStart = (event: any) => {
    this.props.onLoadStart && this.props.onLoadStart(event);
  };

  _onLoadEnd = (event: any) => {
    this.props.onLoadEnd && this.props.onLoadEnd(event);
  };

  _onError = (event: any) => {
    this.props.onError && this.props.onError(event);
  };

  _onPinch = (event: any) => {
    this.props.onPinch &&
      this.props.onPinch(
        event.nativeEvent.pinchState,
        event.nativeEvent.scaleFactor,
        event.nativeEvent.source
      );
  };

  _onRotate = (event: any) => {
    this.props.onRotate &&
      this.props.onRotate(
        event.nativeEvent.rotateState,
        event.nativeEvent.rotationFactor,
        event.nativeEvent.source
      );
  };

  _onDrag = (event: any) => {
    this.props.onDrag &&
      this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
  };

  _onFuse = (event: any) => {
    if (this.props.onFuse) {
      if (typeof this.props.onFuse === "function") {
        this.props.onFuse(event.nativeEvent.source);
      } else if (this.props.onFuse?.callback) {
        this.props.onFuse.callback(event.nativeEvent.source);
      }
    }
  };

  _onAnimationStart = () => {
    this.props.animation?.onStart?.();
  };

  _onAnimationFinish = () => {
    this.props.animation?.onFinish?.();
  };

  applyImpulse = (force: any, position: any) => {
    NativeModules.VRTNodeModule.applyImpulse(
      findNodeHandle(this),
      force,
      position
    );
  };

  applyTorqueImpulse = (torque: any) => {
    NativeModules.VRTNodeModule.applyTorqueImpulse(
      findNodeHandle(this),
      torque
    );
  };

  setVelocity = (velocity: any) => {
    NativeModules.VRTNodeModule.setVelocity(findNodeHandle(this), velocity);
  };

  _onCollision = (event: any) => {
    this.props.onCollision?.(
      event.nativeEvent.viroTag,
      event.nativeEvent.collidedPoint,
      event.nativeEvent.collidedNormal
    );
  };

  // Called from native on the event a positional change has occured
  // for the underlying control within the renderer.
  _onNativeTransformUpdate = (event: any) => {
    this.props.onTransformUpdate?.(event.nativeEvent.position);
  };

  getTransformAsync = (): Promise<any> => {
    return NativeModules.VRTNodeModule.getNodeTransform(findNodeHandle(this));
  };

  getBoundingBoxAsync = (): Promise<any> => {
    return NativeModules.VRTNodeModule.getBoundingBox(findNodeHandle(this));
  };

  getMorphTargets = (): Promise<any> => {
    return NativeModules.VRTNodeModule.getMorphTargets(findNodeHandle(this));
  };
}

export default Viro3DObject;

// We can probably give a better type for this, but it's not exposed ouside this file so not urgent
const VRT3DObject = requireNativeComponent<any>(
  "VRT3DObject",
  // @ts-ignore type signnature incorrect, or extra arguments are ignored?
  Viro3DObject,
  {
    nativeOnly: {
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
      onPinchViro: true,
      onRotateViro: true,
      onSwipeViro: true,
      onDragViro: true,
      onLoadStartViro: true,
      onLoadEndViro: true,
      onErrorViro: true,
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
