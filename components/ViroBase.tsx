import * as React from "react";
import {
  NativeSyntheticEvent,
  NativeModules,
  findNodeHandle,
} from "react-native";
import { ViroCommonProps, ViroObjectProps } from "./AR/ViroCommonProps";
import {
  ViroHoverEvent,
  ViroClickEvent,
  ViroClickStateEvent,
  ViroClickStateTypes,
  ViroTouchEvent,
  ViroScrollEvent,
  ViroSwipeEvent,
  ViroPinchEvent,
  ViroRotateEvent,
  ViroDragEvent,
  ViroFuseEvent,
  ViroAnimationStartEvent,
  ViroAnimationFinishEvent,
  ViroCollisionEvent,
  ViroNativeTransformUpdateEvent,
  ViroErrorEvent,
} from "./Types/ViroEvents";
import {
  ViroNativeRef,
  ViroForce,
  Viro3DPoint,
  ViroTorque,
  ViroVelocity,
} from "./Types/ViroUtils";

export type ViroBaseProps = ViroCommonProps & ViroObjectProps;

export class ViroBase<T> extends React.Component<ViroBaseProps & T> {
  _component: ViroNativeRef = null;

  _onHover = (event: NativeSyntheticEvent<ViroHoverEvent>) => {
    this.props.onHover &&
      this.props.onHover(
        event.nativeEvent.isHovering,
        event.nativeEvent.position,
        event.nativeEvent.source
      );
  };

  _onClick = (event: NativeSyntheticEvent<ViroClickEvent>) => {
    this.props.onClick &&
      this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
  };

  _onClickState = (event: NativeSyntheticEvent<ViroClickStateEvent>) => {
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
  };

  _onTouch = (event: NativeSyntheticEvent<ViroTouchEvent>) => {
    this.props.onTouch &&
      this.props.onTouch(
        event.nativeEvent.touchState,
        event.nativeEvent.touchPos,
        event.nativeEvent.source
      );
  };

  _onScroll = (event: NativeSyntheticEvent<ViroScrollEvent>) => {
    this.props.onScroll &&
      this.props.onScroll(
        event.nativeEvent.scrollPos,
        event.nativeEvent.source
      );
  };

  _onSwipe = (event: NativeSyntheticEvent<ViroSwipeEvent>) => {
    this.props.onSwipe &&
      this.props.onSwipe(
        event.nativeEvent.swipeState,
        event.nativeEvent.source
      );
  };

  _onPinch = (event: NativeSyntheticEvent<ViroPinchEvent>) => {
    this.props.onPinch &&
      this.props.onPinch(
        event.nativeEvent.pinchState,
        event.nativeEvent.scaleFactor,
        event.nativeEvent.source
      );
  };

  _onRotate = (event: NativeSyntheticEvent<ViroRotateEvent>) => {
    this.props.onRotate &&
      this.props.onRotate(
        event.nativeEvent.rotateState,
        event.nativeEvent.rotationFactor,
        event.nativeEvent.source
      );
  };

  _onDrag = (event: NativeSyntheticEvent<ViroDragEvent>) => {
    this.props.onDrag &&
      this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
  };

  _onFuse = (event: NativeSyntheticEvent<ViroFuseEvent>) => {
    if (this.props.onFuse) {
      if (typeof this.props.onFuse === "function") {
        this.props.onFuse(event.nativeEvent.source);
      } else if (
        this.props.onFuse != undefined &&
        this.props.onFuse.callback != undefined
      ) {
        this.props.onFuse.callback(event.nativeEvent.source);
      }
    }
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

  _onError = (event: NativeSyntheticEvent<ViroErrorEvent>) => {
    this.props.onError && this.props.onError(event);
  };

  getTransformAsync = async () => {
    return await NativeModules.VRTNodeModule.getNodeTransform(
      findNodeHandle(this)
    );
  };

  getBoundingBoxAsync = async () => {
    return await NativeModules.VRTNodeModule.getBoundingBox(
      findNodeHandle(this)
    );
  };

  applyImpulse = (force: ViroForce, position: Viro3DPoint) => {
    NativeModules.VRTNodeModule.applyImpulse(
      findNodeHandle(this),
      force,
      position
    );
  };

  applyTorqueImpulse = (torque: ViroTorque) => {
    NativeModules.VRTNodeModule.applyTorqueImpulse(
      findNodeHandle(this),
      torque
    );
  };

  setVelocity = (velocity: ViroVelocity) => {
    NativeModules.VRTNodeModule.setVelocity(findNodeHandle(this), velocity);
  };

  _onCollision = (event: NativeSyntheticEvent<ViroCollisionEvent>) => {
    if (this.props.onCollision) {
      this.props.onCollision(
        event.nativeEvent.viroTag,
        event.nativeEvent.collidedPoint,
        event.nativeEvent.collidedNormal
      );
    }
  };

  // Called from native on the event a positional change has occured
  // for the underlying control within the renderer.
  _onNativeTransformUpdate = (
    event: NativeSyntheticEvent<ViroNativeTransformUpdateEvent>
  ) => {
    var position = event.nativeEvent.position;
    if (this.props.onTransformUpdate) {
      this.props.onTransformUpdate(position);
    }
  };

  setNativeProps = (nativeProps: ViroBaseProps & T) => {
    this._component?.setNativeProps(nativeProps);
  };
}
