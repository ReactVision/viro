"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildViroAnimationRegistry = buildViroAnimationRegistry;
exports.registerSceneAnimations = registerSceneAnimations;
const ViroAnimations_1 = require("../../Animation/ViroAnimations");
const MAX_CONCURRENT_ANIMATIONS = 10;
const MAX_DURATION_MS = 30_000;
const MAX_POSITION_ABS = 1_000;
const MAX_SCALE = 100;
const MIN_SCALE = 0.01;
/**
 * Builds the Viro animation registry object from StudioAnimation rows.
 * The properties field is already in Viro's native keyframe format.
 */
function buildViroAnimationRegistry(animations) {
    const registry = {};
    for (const anim of animations) {
        warnAnimationPerformance(anim);
        registry[anim.animation_key] = {
            properties: anim.properties,
            duration: anim.duration_ms ?? 1000,
            delay: anim.delay_ms ?? 0,
            ...(anim.easing ? { easing: anim.easing } : {}),
        };
    }
    return registry;
}
/**
 * Registers all scene animations with ViroReact.
 * Must be called before any animated Viro components mount.
 */
function registerSceneAnimations(animations) {
    if (animations.length === 0)
        return;
    if (animations.length > MAX_CONCURRENT_ANIMATIONS) {
        console.warn(`[Studio/Animation] Scene has ${animations.length} animations. ` +
            `Recommended max is ${MAX_CONCURRENT_ANIMATIONS} for smooth performance.`);
    }
    const registry = buildViroAnimationRegistry(animations);
    ViroAnimations_1.ViroAnimations.registerAnimations(registry);
    console.log(`[Studio/Animation] Registered ${Object.keys(registry).length} animation(s): ${Object.keys(registry).join(", ")}`);
}
function warnAnimationPerformance(anim) {
    if ((anim.duration_ms ?? 0) > MAX_DURATION_MS) {
        console.warn(`[Studio/Animation] "${anim.animation_key}" duration ${anim.duration_ms}ms exceeds ` +
            `recommended max of ${MAX_DURATION_MS}ms.`);
    }
    const props = anim.properties;
    if (!props || typeof props !== "object")
        return;
    for (const key of Object.keys(props)) {
        const val = props[key];
        if (typeof val !== "number")
            continue;
        if (key === "scaleX" || key === "scaleY" || key === "scaleZ") {
            if (val > MAX_SCALE || val < MIN_SCALE) {
                console.warn(`[Studio/Animation] "${anim.animation_key}" ${key}=${val} is outside ` +
                    `recommended range [${MIN_SCALE}, ${MAX_SCALE}].`);
            }
        }
        if (key === "positionX" || key === "positionY" || key === "positionZ") {
            if (Math.abs(val) > MAX_POSITION_ABS) {
                console.warn(`[Studio/Animation] "${anim.animation_key}" ${key}=${val} is far from origin.`);
            }
        }
    }
}
