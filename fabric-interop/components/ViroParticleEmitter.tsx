/**
 * ViroParticleEmitter
 *
 * A component for creating particle effects.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroParticleEmitterProps extends ViroCommonProps {
  // Particle properties
  duration?: number;
  delay?: number;
  loop?: boolean;
  run?: boolean;
  fixedToEmitter?: boolean;

  // Particle image
  image?: {
    source: { uri: string } | number;
    height?: number;
    width?: number;
    bloomThreshold?: number;
  };

  // Spawn properties
  spawnBehavior?: {
    particleLifetime?: [number, number];
    emissionRatePerSecond?: [number, number];
    emissionRatePerMeter?: [number, number];
    spawnVolume?: {
      shape: "box" | "sphere";
      params?: [number, number, number];
      spawnOnSurface?: boolean;
    };
    maxParticles?: number;
  };

  // Particle behavior
  particleAppearance?: {
    opacity?: [number, number];
    rotation?: [number, number];
    rotationSpeed?: [number, number];
    scale?: [number, number, number, number];
    color?: [number, number, number, number];
  };

  // Physics
  particlePhysics?: {
    velocity?: [number, number, number, number, number, number];
    acceleration?: [number, number, number, number, number, number];
    explosiveImpulse?: [number, number];
  };

  // Events
  onFinish?: () => void;
}

/**
 * ViroParticleEmitter is a component for creating particle effects.
 * It provides a flexible system for creating various particle-based visual effects.
 */
export const ViroParticleEmitter: React.FC<ViroParticleEmitterProps> = (
  props
) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    duration: props.duration,
    delay: props.delay,
    loop: props.loop,
    run: props.run,
    fixedToEmitter: props.fixedToEmitter,
    image: props.image,
    spawnBehavior: props.spawnBehavior,
    particleAppearance: props.particleAppearance,
    particlePhysics: props.particlePhysics,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("particle", nativeProps);

  
  // Register event handlers using our new event system
  useViroEventListeners(nodeId, {
    onHover: props.onHover,
    onClick: props.onClick,
    onClickState: props.onClickState,
    onTouch: props.onTouch,
    onScroll: props.onScroll,
    onSwipe: props.onSwipe,
    onDrag: props.onDrag,
    onPinch: props.onPinch,
    onRotate: props.onRotate,
    onFuse:
      typeof props.onFuse === "function"
        ? props.onFuse
        : props.onFuse?.callback,
    onCollision: props.onCollision,
    onTransformUpdate: props.onTransformUpdate,
  });

  // Component doesn't have children, so just return null
  return null;
};
