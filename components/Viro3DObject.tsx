import * as React from "react";
import {
  findNodeHandle,
  Image,
  ImageSourcePropType,
  NativeModules,
  NativeSyntheticEvent,
  requireNativeComponent,
} from "react-native";
import {
  ViroErrorEvent,
  ViroLoadEndEvent,
  ViroLoadStartEvent,
} from "./Types/ViroEvents";
import { ViroNativeRef } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroBase } from "./ViroBase";
const { resolveAssetSource } = Image;

type Props = {
  type: "OBJ" | "VRX" | "GLTF" | "GLB";

  /**
   * The model file, which is required
   */
  source: ImageSourcePropType;

  /**
   * Additional resource files for various model formats
   */
  resources?: ImageSourcePropType[];
  /**
   * TODO: what does this do?
   */
  morphTargets?: Array<{
    target?: string;
    weight?: number;
  }>;

  onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
  onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
  onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};

/**
 * Viro3DObject is a component that is used to render 3D models in the scene.
 */
export class Viro3DObject extends ViroBase<Props> {
  render() {
    checkMisnamedProps("Viro3DObject", this.props);
    const modelsrc = resolveAssetSource(this.props.source);
    const resources = this.props.resources?.map((resource) =>
      resolveAssetSource(resource)
    );

    console.log("RESOURCES", resources);

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
        ref={(component: ViroNativeRef) => {
          this._component = component;
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

  _onLoadStart = (event: NativeSyntheticEvent<ViroLoadStartEvent>) => {
    this.props.onLoadStart && this.props.onLoadStart(event);
  };

  _onLoadEnd = (event: NativeSyntheticEvent<ViroLoadEndEvent>) => {
    this.props.onLoadEnd && this.props.onLoadEnd(event);
  };

  getBoundingBoxAsync = (): Promise<any> => {
    return NativeModules.VRTNodeModule.getBoundingBox(findNodeHandle(this));
  };

  getMorphTargets = (): Promise<any> => {
    return NativeModules.VRTNodeModule.getMorphTargets(findNodeHandle(this));
  };
}

// We can probably give a better type for this, but it's not exposed ouside this file so not urgent
const VRT3DObject = requireNativeComponent<any>(
  "VRT3DObject",
  // @ts-ignore type signature incorrect, or extra arguments are ignored?
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
