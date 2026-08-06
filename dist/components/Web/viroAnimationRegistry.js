"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerViroAnimations = registerViroAnimations;
exports.getViroAnimationDef = getViroAnimationDef;
exports.runDeclarativeAnimation = runDeclarativeAnimation;
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const DEG2RAD = Math.PI / 180;
const registry = new Map();
function registerViroAnimations(animations) {
    for (const name of Object.keys(animations)) {
        registry.set(name, animations[name]);
    }
}
function getViroAnimationDef(name) {
    return registry.get(name);
}
function easingValue(easing) {
    switch (easing) {
        case "EaseIn": return viro_web_renderer_1.ViroEasing.EaseIn;
        case "EaseOut": return viro_web_renderer_1.ViroEasing.EaseOut;
        case "EaseInEaseOut": return viro_web_renderer_1.ViroEasing.EaseInEaseOut;
        case "Bounce": return viro_web_renderer_1.ViroEasing.Bounce;
        case "PowerDecel": return viro_web_renderer_1.ViroEasing.PowerDecel;
        default: return viro_web_renderer_1.ViroEasing.Linear;
    }
}
function coerce(value, fallback) {
    if (typeof value === "number")
        return value;
    if (typeof value === "string") {
        const n = parseFloat(value);
        return Number.isNaN(n) ? fallback : n;
    }
    return fallback;
}
/**
 * Run a declarative animation on a node, starting from its current transform.
 * Returns true if `name` was a registered animation.
 */
function runDeclarativeAnimation(scene, node, name, base, loop) {
    const def = registry.get(name);
    if (!def)
        return false;
    const p = def.properties;
    scene.beginAnimation(node, def.duration / 1000, (def.delay ?? 0) / 1000, loop, easingValue(def.easing));
    if (p.positionX !== undefined || p.positionY !== undefined || p.positionZ !== undefined) {
        scene.setNodePosition(node, coerce(p.positionX, base.position[0]), coerce(p.positionY, base.position[1]), coerce(p.positionZ, base.position[2]));
    }
    if (p.rotateX !== undefined || p.rotateY !== undefined || p.rotateZ !== undefined) {
        scene.setNodeRotation(node, coerce(p.rotateX, base.rotation[0]) * DEG2RAD, coerce(p.rotateY, base.rotation[1]) * DEG2RAD, coerce(p.rotateZ, base.rotation[2]) * DEG2RAD);
    }
    if (p.scaleX !== undefined || p.scaleY !== undefined || p.scaleZ !== undefined) {
        scene.setNodeScale(node, coerce(p.scaleX, base.scale[0]), coerce(p.scaleY, base.scale[1]), coerce(p.scaleZ, base.scale[2]));
    }
    if (p.opacity !== undefined) {
        scene.setNodeOpacity(node, coerce(p.opacity, base.opacity));
    }
    scene.commitAnimation();
    return true;
}
