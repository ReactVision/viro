/**
 * Web implementation of ViroParticleEmitter — attaches a `VROParticleEmitter` to
 * a node via the C API. The sprite is `image.source` on a quad; spawn behavior
 * and a velocity range come from `spawnBehavior`/`particlePhysics`.
 *
 * Scope: image, spawnBehavior (rate/lifetime/maxParticles/spawnVolume),
 * particlePhysics.velocity and .acceleration, particleAppearance (colour,
 * opacity, scale and rotation over the particle's life), run. Bursts,
 * explosiveImpulse, spawnOnSurface and emissionRatePerMeter are follow-ups.
 */
import * as React from "react";
import { useEffect, useRef } from "react";
import {
  ViroParticleSpawnShape,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene } from "./Web/ViroWebContext";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";
import {
  resolveParticleAppearance,
  type ViroParticleAppearanceProp,
} from "./Web/viroParticleAppearance";

type Vec3 = [number, number, number];

type Props = ViroWebNodeProps & {
  image: { source: unknown; width?: number; height?: number };
  run?: boolean;
  loop?: boolean;
  spawnBehavior?: {
    emissionRatePerSecond?: number[];
    particleLifetime?: number[];
    maxParticles?: number;
    spawnVolume?: { shape?: string; params?: number[] };
  };
  particlePhysics?: {
    velocity?: VelocityRange;
    acceleration?: VelocityRange;
  };
  /** Colour, opacity, scale and rotation over the particle's life. */
  particleAppearance?: ViroParticleAppearanceProp;
  [key: string]: any;
};

/** Both `velocity` and `acceleration` take this shape. */
type VelocityRange = {
  /** ViroParticleEmitter's own shape: a [min, max] pair of vectors. */
  initialRange?: number[][];
  /** The shape this web component shipped with. */
  min?: number[];
  max?: number[];
};

function shapeEnum(shape?: string): ViroParticleSpawnShape {
  switch ((shape ?? "").toLowerCase()) {
    case "box":
      return ViroParticleSpawnShape.Box;
    case "sphere":
      return ViroParticleSpawnShape.Sphere;
    default:
      return ViroParticleSpawnShape.Point;
  }
}

const asVec3 = (a?: number[]): Vec3 => [a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0];
const asPair = (a?: number[], d = 0): [number, number] => [a?.[0] ?? d, a?.[1] ?? a?.[0] ?? d];

/**
 * The velocity range, from either shape it can arrive in.
 *
 * `initialRange` is what ViroParticleEmitter's own API takes, so it is what
 * every scene written against the native component sends. This read only
 * `min`/`max`, so those scenes resolved to [0, 0, 0] and their particles were
 * born and died on the emitter — no warning, and the emitter itself still drew,
 * so it looked like it worked. `initialRange` wins where both are present.
 *
 * A range with one entry is a fixed velocity, not a range from zero.
 */
export function velocityRange(velocity?: VelocityRange): [Vec3, Vec3] {
  const range = velocity?.initialRange;
  if (range && range.length > 0) {
    const min = asVec3(range[0]);
    return [min, range.length > 1 ? asVec3(range[1]) : min];
  }
  const min = asVec3(velocity?.min);
  return [min, velocity?.max ? asVec3(velocity.max) : min];
}

export function ViroParticleEmitter(props: Props): null {
  const scene = useViroScene();
  const node = useViroNode(props);

  const url = resolveImageSource(props.image?.source);
  const texRef = useRef<ViroHandle>(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Build the emitter once the sprite texture is ready.
  useEffect(() => {
    if (!node || !url) return;
    let cancelled = false;
    loadImageRGBA(url)
      .then((img) => {
        if (cancelled) return;
        const p = propsRef.current;
        const texture = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
        texRef.current = texture;
        const sb = p.spawnBehavior ?? {};
        const [velocityMin, velocityMax] = velocityRange(p.particlePhysics?.velocity);
        scene.createParticleEmitter(node, texture, {
          particleWidth: p.image?.width ?? 0.1,
          particleHeight: p.image?.height ?? 0.1,
          maxParticles: sb.maxParticles,
          emissionRatePerSecond: asPair(sb.emissionRatePerSecond, 10),
          particleLifetime: asPair(sb.particleLifetime, 2000),
          spawnShape: shapeEnum(sb.spawnVolume?.shape),
          spawnParams: asVec3(sb.spawnVolume?.params),
          velocityMin,
          velocityMax,
        });
        // After the emitter exists: acceleration is set on a live emitter, not
        // passed to the factory that creates it.
        const accel = p.particlePhysics?.acceleration;
        if (accel) {
          const [accelMin, accelMax] = velocityRange(accel);
          scene.setParticleAcceleration(node, accelMin, accelMax);
        }
        for (const call of resolveParticleAppearance(p.particleAppearance)) {
          scene.setParticleModifier(
            node,
            call.property,
            call.min,
            call.max,
            call.factor,
            call.intervals,
          );
        }
        scene.setParticleEmitterRun(node, p.run !== false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (texRef.current) {
        scene.destroyTexture(texRef.current);
        texRef.current = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, url]);

  // A changed appearance, after the emitter exists. Keyed on the serialised prop
  // because it arrives as a fresh object literal on every render.
  const appearanceKey = props.particleAppearance
    ? JSON.stringify(props.particleAppearance)
    : "";
  useEffect(() => {
    if (!node || !appearanceKey) return;
    for (const call of resolveParticleAppearance(propsRef.current.particleAppearance)) {
      scene.setParticleModifier(
        node,
        call.property,
        call.min,
        call.max,
        call.factor,
        call.intervals,
      );
    }
  }, [scene, node, appearanceKey]);

  // Run/pause toggling.
  useEffect(() => {
    if (node) scene.setParticleEmitterRun(node, props.run !== false);
  }, [scene, node, props.run]);

  return null;
}
