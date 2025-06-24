/**
 * ViroParticleEmitter
 *
 * A component for creating particle effects.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
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

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    const eventHandlers = [{ name: "onFinish", handler: props.onFinish }];

    // Register all event handlers and store callback IDs for cleanup
    const registeredCallbacks = eventHandlers
      .filter(({ handler }) => !!handler)
      .map(({ name, handler }) => {
        const callbackId = `${nodeId}_${name}`;

        // Register the callback in the global registry
        if (typeof global !== "undefined" && global.registerViroEventCallback) {
          global.registerViroEventCallback(callbackId, handler);
        }

        // Register with native code
        nativeViro.registerEventCallback(nodeId, name, callbackId);
        return { name, callbackId };
      });

    // Cleanup when unmounting
    return () => {
      const nativeViro = getNativeViro();
      if (!nativeViro) return;

      // Unregister all event handlers
      registeredCallbacks.forEach(({ name, callbackId }) => {
        nativeViro.unregisterEventCallback(nodeId, name, callbackId);
      });
    };
  }, [nodeId, props.onFinish]);

  // Particle emitter doesn't have children, so just return null
  return null;
};
