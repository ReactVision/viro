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
    velocity?: { min?: number[]; max?: number[] };
  };
  [key: string]: any;
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
        const vel = p.particlePhysics?.velocity;
        scene.createParticleEmitter(node, texture, {
          particleWidth: p.image?.width ?? 0.1,
          particleHeight: p.image?.height ?? 0.1,
          maxParticles: sb.maxParticles,
          emissionRatePerSecond: asPair(sb.emissionRatePerSecond, 10),
          particleLifetime: asPair(sb.particleLifetime, 2000),
          spawnShape: shapeEnum(sb.spawnVolume?.shape),
          spawnParams: asVec3(sb.spawnVolume?.params),
          velocityMin: asVec3(vel?.min),
          velocityMax: asVec3(vel?.max ?? vel?.min),
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
