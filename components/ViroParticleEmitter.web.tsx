/**
 * Web implementation of ViroParticleEmitter — attaches a `VROParticleEmitter` to
 * a node via the C API. The sprite is `image.source` on a quad; spawn behavior
 * and a velocity range come from `spawnBehavior`/`particlePhysics`.
 *
 * MVP scope: image, spawnBehavior (rate/lifetime/maxParticles/spawnVolume),
 * particlePhysics.velocity, run. Appearance modifiers (color/scale/rotation/
 * alpha over life), bursts, acceleration and emissionRatePerMeter are follow-ups.
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
  };
  [key: string]: any;
};

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

  // Run/pause toggling.
  useEffect(() => {
    if (node) scene.setParticleEmitterRun(node, props.run !== false);
  }, [scene, node, props.run]);

  return null;
}
