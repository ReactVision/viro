/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroParticleEmitter
 * @flow
 */
"use strict";

import * as React from "react";
import {
  ColorValue,
  findNodeHandle,
  NativeModules,
  NativeSyntheticEvent,
  processColor,
  requireNativeComponent,
} from "react-native";
// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import { ViroObjectProps } from "./AR/ViroCommonProps";
import { ViroNativeTransformUpdateEvent } from "./Types/ViroEvents";
import { ViroNativeRef, ViroSource } from "./Types/ViroUtils";
import { checkMisnamedProps } from "./Utilities/ViroProps";

type ViroInterpolation = {
  interval?: number[];
  endValue: number[];
}[];

type Props = ViroObjectProps & {
  // The delay in milliseconds to apply before this emitter starts a new emission cycle. Particles are produced during each emission cycle.
  delay?: number;
  duration?: number;
  loop?: boolean;
  run?: boolean;
  fixedToEmitter?: boolean;

  image: {
    source: ViroSource;
    height: number;
    width: number;
    bloomThreshold: number;
  };
  height?: number;
  width?: number;
  bloomThreshold?: number;
  blendMode?: string;

  spawnBehavior?: {
    // The total number of particles this emitter spawns in a second. This value is
    // chosen at random from the given [min, max] range array, and is in addition
    // to the other emission parameters.
    emissionRatePerSecond?: number[];
    // The total number of particles this emitter spawns per meter travelled. This
    // value is chosen at random from the given [min, max] range array, and is in
    // addition to the other emission parameters.
    emissionRatePerMeter?: number[];
    // The lifetime of a particle in milliseconds.
    particleLifetime?: number[];
    // The maximum number of live particles that can exist at any moment from
    // this emitter. This includes particles that have been created by the
    // emissionRatePerSecond, emissionRatePerMeter, and emissionBurst parameters.
    // When the cap is reached, new particles will only be spawned as existing particles die off.
    maxParticles?: number;

    // An array of parameters controlling how this emitter spawns particles in
    // bursts, if any. Bursts can be scheduled to occur at certain times, or
    // after a certain distance travelled by the emitter.
    emissionBurst?:
      | {
          // Time in milliseconds, at which to emit this burst of particles. This time is set in reference to the start of the emission cycle of this emitter.
          time?: number;
          // The minimum number of particles to burst.
          min?: number;
          // The maximum number of particles to burst.
          max?: number;
          // The number of times to loop and repeat this burst.
          cycles?: number;
          // The cool down / waiting duration between cycles before the emitter
          // spawns another burst of particles.
          cooldownPeriod?: number;
        }
      | {
          // Can also be in terms of distance travelled, in meters.|
          distance?: number;
          // The minimum number of particles to burst.
          min?: number;
          // The maximum number of particles to burst.
          max?: number;
          // The number of times to loop and repeat this burst.
          cycles?: number;
          // The cool down / waiting duration between cycles before the emitter
          // spawns another burst of particles.
          cooldownDistance?: number;
        };
    // The shape of the volume within which to spawn particles, and the parameters
    // that describe that volume. If spawnOnSurface is true, particles will spawn on
    // the surface of the volume, instead of within the volume. Note that particles
    // will be uniformly distributed throughout the volume.
    spawnVolume?: {
      // Box: [width, height, and length]
      // Sphere: A single float describing a radius parameter for a perfect sphere,
      // or a vector representing the [x, y, z] length of an ellipsoid.
      shape?: string;
      params?: number[];
      spawnOnSurface?: boolean;
    };
  };

  particleAppearance?: {
    opacity?: {
      // The [min, max] range array within which to initialize a randomized opacity for
      // particles to start of with.
      initialRange: number[];
      // The unit of reference against which to interpolate your visual property values,
      // can be either time or distance.
      factor?: "Time" | "Distance" | "time" | "distance";
      // An array of data points, each containing an endValue and an interpolation
      // interval, thereby "charting" the behavior of this property over the lifetime
      // of the particle.
      interpolation?: {
        interval?: number[];
        endValue?: number;
      }[];
    };
    scale?: {
      // The [min, max] range array within which to initialize a randomized opacity for
      // particles to start of with. Here, min and max are vectors, as particles are
      // scaled in 3d space.
      initialRange?: number[][];
      // The unit of reference against which to interpolate your visual property values,
      // can be either time or distance.
      factor?: "Time" | "Distance" | "time" | "distance";
      // An array of data points, each containing an endValue and an interpolation
      // interval, thereby "charting" the behavior of this property over the lifetime
      // of the particle.
      interpolation?: {
        interval?: number[];
        endValue?: number[];
      }[];
    };
    // rotation is only about the Z axis
    rotation?: {
      // The [min, max] range array defining the interval of initial rotation values
      // for each particle. Min and max are floats. Rotation is performed on the
      // quad's Z axis, and are then billboarded to the user.
      initialRange?: number[];
      // The unit of reference against which to interpolate visual property values, can
      // be either time or distance.
      factor?: "Time" | "Distance" | "time" | "distance";
      // An array of data points, each containing an endValue and an interpolation
      // interval, thereby "charting" the behavior of this property over the lifetime
      // of the particle.
      interpolation?: {
        interval?: number[];
        endValue?: number;
      }[];
    };
    color?: {
      // The [min, max] range within which to initialize each particle's color.
      initialRange?: ColorValue[];
      // The unit of reference against which to interpolate your visual property values,
      // can be either time or distance.
      factor?: "Time" | "Distance" | "time" | "distance";
      // An array of data points, each containing an endValue and an interpolation interval,
      // thereby "charting" the behavior of this property over the lifetime of the particle.
      interpolation?: {
        interval?: number[];
        endValue?: ColorValue;
      }[];
    };
  };

  particlePhysics?: {
    velocity?: {
      initialRange?: number[][];
    };
    acceleration?: {
      initialRange?: number[][];
    };

    explosiveImpulse?: {
      impulse?: number;
      position?: number[];
      decelerationPeriod?: number;
    };
  };
};

type State = {
  nativePositionState: any;
  propsPositionState: any;
};

export class ViroParticleEmitter extends React.Component<Props, State> {
  state = {
    propsPositionState: this.props.position,
    nativePositionState: undefined,
  };
  _component: ViroNativeRef = null;

  async getTransformAsync() {
    return await NativeModules.VRTNodeModule.getNodeTransform(
      findNodeHandle(this)
    );
  }

  async getBoundingBoxAsync() {
    return await NativeModules.VRTNodeModule.getBoundingBox(
      findNodeHandle(this)
    );
  }
  // Called from native on the event a positional change has occured
  // for the underlying control within the renderer.
  _onNativeTransformUpdate(
    event: NativeSyntheticEvent<ViroNativeTransformUpdateEvent>
  ) {
    var position = event.nativeEvent.position;
    this.setState(
      {
        nativePositionState: position,
      },
      () => {
        if (this.props.onTransformUpdate) {
          this.props.onTransformUpdate(position);
        }
      }
    );
  }
  // Ignore all changes in native position state as it is only required to
  // keep track of the latest position prop set on this control.
  shouldComponentUpdate(_nextProps: Props, nextState: State) {
    if (nextState.nativePositionState != this.state.nativePositionState) {
      return false;
    }
    return true;
  }

  setNativeProps(nativeProps: Props) {
    this._component?.setNativeProps(nativeProps);
  }

  render() {
    checkMisnamedProps("ViroParticleEmitter", this.props);
    let image = { ...this.props.image };
    if (image.source != undefined) {
      image.source = resolveAssetSource(image.source);
    }
    let transformBehaviors =
      typeof this.props.transformBehaviors === "string"
        ? new Array(this.props.transformBehaviors)
        : this.props.transformBehaviors;
    let transformDelegate =
      this.props.onTransformUpdate != undefined
        ? this._onNativeTransformUpdate
        : undefined;
    // Create native props object.
    let nativeProps = Object.assign({} as any, this.props);
    nativeProps.position = this.state.propsPositionState;
    nativeProps.onNativeTransformDelegateViro = transformDelegate;
    nativeProps.hasTransformDelegate =
      this.props.onTransformUpdate != undefined;
    nativeProps.image = image;
    nativeProps.transformBehaviors = transformBehaviors;
    // For color modifiers, we'll need to processColor for each color value.
    if (this.props.particleAppearance && this.props.particleAppearance.color) {
      let colorModifier = this.props.particleAppearance.color;
      if (colorModifier.initialRange?.length != 2) {
        console.error(
          "The <ViroParticleEmitter> component requires initial value of [min, max] when defining inital rotation property!"
        );
        return;
      }
      let minColorFinal = processColor(colorModifier.initialRange[0]);
      let maxColorFinal = processColor(colorModifier.initialRange[1]);
      let modifierFinal = [];
      let interpolationLength =
        colorModifier.interpolation != undefined
          ? colorModifier.interpolation.length
          : 0;
      for (let i = 0; i < interpolationLength; i++) {
        let processedColor = processColor(
          (colorModifier.interpolation as any)[i].endValue as ColorValue
        );
        let mod = {
          interval: (colorModifier.interpolation as any[])[i].interval,
          endValue: processedColor,
        };
        modifierFinal.push(mod);
      }
      let newAppearanceColorMod = {
        initialRange: [minColorFinal, maxColorFinal],
        factor: colorModifier.factor,
        interpolation: modifierFinal,
      };
      nativeProps.particleAppearance.color = newAppearanceColorMod;
    }
    // For rotation modifiers, convert degrees to radians, then apply the
    // Z rotation (due to billboarding for quad particles)
    if (
      this.props.particleAppearance &&
      this.props.particleAppearance.rotation
    ) {
      let rotMod = this.props.particleAppearance.rotation;
      if ((rotMod.initialRange as any[]).length !== 2) {
        console.error(
          "The <ViroParticleEmitter> component requires initial value of [min, max] when defining inital rotation property!"
        );
      }
      let minRotFinal = [
        0,
        0,
        ((rotMod.initialRange as number[])[0] * Math.PI) / 180,
      ];
      let maxRotFinal = [
        0,
        0,
        ((rotMod.initialRange as number[])[1] * Math.PI) / 180,
      ];
      let modifierFinal = [];
      let interpolationLength =
        rotMod.interpolation != undefined ? rotMod.interpolation.length : 0;
      for (var i = 0; i < interpolationLength; i++) {
        let processedRot = [
          0,
          0,
          ((rotMod.interpolation as any[])[i].endValue * Math.PI) / 180,
        ];
        let mod = {
          interval: (rotMod.interpolation as any[])[i].interval,
          endValue: processedRot,
        };
        modifierFinal.push(mod);
      }
      let newAppearanceRotMod = {
        initialRange: [minRotFinal, maxRotFinal],
        factor: rotMod.factor,
        interpolation: modifierFinal,
      };
      nativeProps.particleAppearance.rotation = newAppearanceRotMod;
    }
    nativeProps.ref = (component: ViroNativeRef) => {
      this._component = component;
    };
    return <VRTParticleEmitter {...nativeProps} />;
  }
  // Set the propsPositionState on the native control if the
  // nextProps.position state differs from the nativePositionState that
  // reflects this control's current vroNode position.
  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    if (
      nextProps.position &&
      nextProps.position != prevState.nativePositionState
    ) {
      var newPosition = [
        nextProps.position[0],
        nextProps.position[1],
        nextProps.position[2],
        Math.random(),
      ];
      return {
        propsPositionState: newPosition,
      };
    }
    return {};
  }
}

var VRTParticleEmitter = requireNativeComponent(
  "VRTParticleEmitter",
  // @ts-ignore
  ViroParticleEmitter,
  {
    nativeOnly: {
      onNativeTransformDelegateViro: true,
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
      canCollide: true,
      onHoverViro: true,
      onClickViro: true,
      onTouchViro: true,
      onScrollViro: true,
      onSwipeViro: true,
      onDragViro: true,
      onPinchViro: true,
      onRotateViro: true,
      onPlatformUpdateViro: true,
      onFuseViro: true,
      timeToFuse: true,
      physicsBody: true,
      onCollisionViro: true,
      animation: true,
      materials: true,
      dragType: true,
      dragPlane: true,
      ignoreEventHandling: true,
    },
  }
);
