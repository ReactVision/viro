/**
 * Web implementation of ViroParticleEmitter — attaches a `VROParticleEmitter` to
 * a node via the C API. The sprite is `image.source` on a quad; spawn behavior
 * and a velocity range come from `spawnBehavior`/`particlePhysics`.
 *
 * Every prop native takes, re-applied when it changes, with the emission
 * cycle restarted where native restarts it.
 */
import * as React from "react";
import { useEffect, useRef } from "react";
import {
  ViroParticleSpawnShape,
  type ViroHandle,
  type ViroParticleBurst,
  type ViroParticleEmitterConfig,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene } from "./Web/ViroWebContext";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";
import {
  resolveParticleAppearance,
  type ViroParticleAppearanceProp,
} from "./Web/viroParticleAppearance";

type Vec3 = [number, number, number];

type Props = ViroWebNodeProps & {
  image: { source: unknown; width?: number; height?: number; blendMode?: string; bloomThreshold?: number };
  run?: boolean;
  loop?: boolean;
  delay?: number;
  duration?: number;
  fixedToEmitter?: boolean;
  spawnBehavior?: {
    emissionRatePerSecond?: number[];
    emissionRatePerMeter?: number[];
    particleLifetime?: number[];
    maxParticles?: number;
    emissionBurst?: unknown;
    spawnVolume?: { shape?: string; params?: number[]; spawnOnSurface?: boolean };
  };
  particlePhysics?: {
    velocity?: VelocityRange;
    acceleration?: VelocityRange;
    explosiveImpulse?: { impulse?: number; position?: number[]; decelerationPeriod?: number };
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

// What both native bridges give an emitter whose particlePhysics has no
// velocity (VRTParticleEmitter's default velocity modifier).
const NATIVE_DEFAULT_VELOCITY: [Vec3, Vec3] = [[-0.5, 1, 0], [0.5, 1, 0]];

/** The emitter's velocity: `velocityRange`, or native's default when none is given. */
export function particleVelocity(velocity?: VelocityRange): [Vec3, Vec3] {
  const given = !!velocity && (!!velocity.initialRange?.length || !!velocity.min || !!velocity.max);
  return given ? velocityRange(velocity) : NATIVE_DEFAULT_VELOCITY;
}

/** `emissionBurst` as native reads it; an entry native refuses is left out. */
export function particleBursts(raw: unknown): ViroParticleBurst[] {
  if (!Array.isArray(raw)) return [];
  const bursts: ViroParticleBurst[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object" || b.min == null || b.max == null) continue;
    const min = Number(b.min), max = Number(b.max);
    if (!(min >= 0 && max >= min)) continue;
    const cycles = b.cycles > 0 ? Math.floor(b.cycles) : 1;
    if (b.time != null) {
      bursts.push({ factor: "time", start: Number(b.time), interval: Number(b.cooldownPeriod ?? 0), min, max, cycles });
    } else if (b.distance != null) {
      bursts.push({ factor: "distance", start: Number(b.distance), interval: Number(b.cooldownDistance ?? 0), min, max, cycles });
    }
  }
  return bursts;
}

/** Everything but the sprite, with native's defaults (VRTParticleEmitter.java) for what is unset. */
export function particleEmitterConfig(p: Props): ViroParticleEmitterConfig {
  const sb = p.spawnBehavior ?? {};
  const [min, max] = particleVelocity(p.particlePhysics?.velocity);
  const explosive = p.particlePhysics?.explosiveImpulse;
  const at = explosive?.position;
  return {
    delay: p.delay ?? 0,
    duration: p.duration ?? 2000,
    loop: p.loop ?? true,
    fixedToEmitter: p.fixedToEmitter ?? true,
    blendMode: p.image?.blendMode ?? "Add",
    bloomThreshold: p.image?.bloomThreshold ?? -1,
    emissionRatePerSecond: asPair(sb.emissionRatePerSecond, 10),
    emissionRatePerMeter: asPair(sb.emissionRatePerMeter, 0),
    particleLifetime: asPair(sb.particleLifetime, 2000),
    maxParticles: sb.maxParticles ?? 500,
    velocity: { min, max },
    spawnVolume: {
      shape: shapeEnum(sb.spawnVolume?.shape),
      params: sb.spawnVolume?.params ?? [],
      onSurface: !!sb.spawnVolume?.spawnOnSurface,
    },
    bursts: particleBursts(sb.emissionBurst),
    explosion:
      explosive && Array.isArray(at) && at.length >= 3
        ? { position: asVec3(at), impulse: explosive.impulse ?? 0, deceleration: explosive.decelerationPeriod }
        : null,
  };
}

/** The props that need the config call, for the warning on a renderer without it. */
function usesEmitterSettings(p: Props): boolean {
  const sb = p.spawnBehavior;
  return (
    p.delay != null ||
    p.duration != null ||
    p.loop === false ||
    p.fixedToEmitter === false ||
    p.image?.blendMode != null ||
    p.image?.bloomThreshold != null ||
    sb?.emissionBurst != null ||
    sb?.emissionRatePerMeter != null ||
    !!sb?.spawnVolume?.spawnOnSurface ||
    p.particlePhysics?.explosiveImpulse != null
  );
}

export function ViroParticleEmitter(props: Props): null {
  const scene = useViroScene();
  const node = useViroNode(props);

  const url = resolveImageSource(props.image?.source);
  const texRef = useRef<ViroHandle>(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  // What native restarts the emission cycle for (VRTParticleEmitter sets
  // _needsRestart): timing, spawn behaviour, physics and appearance.
  const restartKey = JSON.stringify([
    props.delay,
    props.duration,
    props.spawnBehavior,
    props.particlePhysics,
    props.particleAppearance,
  ]);
  const settingsKey = JSON.stringify(particleEmitterConfig(props));
  const appliedRestartKey = useRef<string | null>(null);
  const configure = () => {
    const p = propsRef.current;
    const [accelMin, accelMax] = velocityRange(p.particlePhysics?.acceleration);
    scene.setParticleAcceleration(node, accelMin, accelMax);
    if (typeof scene.configureParticleEmitter !== "function") {
      if (usesEmitterSettings(p)) {
        warnUnsupported(
          "ViroParticleEmitter delay, duration, loop, fixedToEmitter, blendMode, bloomThreshold, bursts, emissionRatePerMeter, spawnOnSurface and explosiveImpulse",
          "this version of the web renderer",
        );
      }
      return;
    }
    const reset = appliedRestartKey.current !== restartKey;
    appliedRestartKey.current = restartKey;
    scene.configureParticleEmitter(node, { ...particleEmitterConfig(p), reset });
  };

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
        const [velocityMin, velocityMax] = particleVelocity(p.particlePhysics?.velocity);
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
        // After the emitter exists: these are set on a live emitter, not
        // passed to the factory that creates it.
        appliedRestartKey.current = null;
        configure();
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
        scene.setParticleEmitterRun(node, p.run === true);
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

  // Changed settings, after the emitter exists.
  useEffect(() => {
    if (!node || !texRef.current) return;
    configure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, node, settingsKey, restartKey]);

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

  // Run/pause toggling. Off unless asked for, as on native.
  useEffect(() => {
    if (node) scene.setParticleEmitterRun(node, props.run === true);
  }, [scene, node, props.run]);

  return null;
}
