import { ViroAnimations } from "../../Animation/ViroAnimations";
import { StudioAnimation } from "../types";

const MAX_CONCURRENT_ANIMATIONS = 10;
const MAX_DURATION_MS = 30_000;
const MAX_POSITION_ABS = 1_000;
const MAX_SCALE = 100;
const MIN_SCALE = 0.01;

/**
 * Builds the Viro animation registry object from StudioAnimation rows.
 * The properties field is already in Viro's native keyframe format.
 */
export function buildViroAnimationRegistry(
  animations: StudioAnimation[]
): Record<string, unknown> {
  const registry: Record<string, unknown> = {};

  for (const anim of animations) {
    warnAnimationPerformance(anim);
    registry[anim.name] = {
      properties: anim.properties,
      duration: anim.duration ?? 1000,
      delay: anim.delay ?? 0,
      ...(anim.easing ? { easing: anim.easing } : {}),
    };
  }

  return registry;
}

/**
 * Registers all scene animations with ViroReact.
 * Must be called before any animated Viro components mount.
 */
export function registerSceneAnimations(animations: StudioAnimation[]): void {
  if (animations.length === 0) return;

  if (animations.length > MAX_CONCURRENT_ANIMATIONS) {
    console.warn(
      `[Studio/Animation] Scene has ${animations.length} animations. ` +
        `Recommended max is ${MAX_CONCURRENT_ANIMATIONS} for smooth performance.`
    );
  }

  const registry = buildViroAnimationRegistry(animations);
  ViroAnimations.registerAnimations(registry as any);

  console.log(
    `[Studio/Animation] Registered ${Object.keys(registry).length} animation(s): ${Object.keys(registry).join(", ")}`
  );
}

function warnAnimationPerformance(anim: StudioAnimation): void {
  if ((anim.duration ?? 0) > MAX_DURATION_MS) {
    console.warn(
      `[Studio/Animation] "${anim.name}" duration ${anim.duration}ms exceeds ` +
        `recommended max of ${MAX_DURATION_MS}ms.`
    );
  }

  const props = anim.properties as Record<string, unknown>;
  if (!props || typeof props !== "object") return;

  for (const key of Object.keys(props)) {
    const val = (props as Record<string, unknown>)[key];
    if (typeof val !== "number") continue;

    if (key === "scaleX" || key === "scaleY" || key === "scaleZ") {
      if (val > MAX_SCALE || val < MIN_SCALE) {
        console.warn(
          `[Studio/Animation] "${anim.name}" ${key}=${val} is outside ` +
            `recommended range [${MIN_SCALE}, ${MAX_SCALE}].`
        );
      }
    }

    if (key === "positionX" || key === "positionY" || key === "positionZ") {
      if (Math.abs(val) > MAX_POSITION_ABS) {
        console.warn(
          `[Studio/Animation] "${anim.name}" ${key}=${val} is far from origin.`
        );
      }
    }
  }
}
