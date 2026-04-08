"use strict";
/**
 * Studio physics_config and physics_world_config parsing and Viro prop building.
 * Ported from studio-go/domain/physicsConfig.ts — no zod dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePhysicsWorldConfig = parsePhysicsWorldConfig;
exports.parsePhysicsBodyConfig = parsePhysicsBodyConfig;
exports.buildViroPhysicsWorld = buildViroPhysicsWorld;
exports.buildViroPhysicsBody = buildViroPhysicsBody;
exports.shouldUseKinematicPhysicsDrag = shouldUseKinematicPhysicsDrag;
// ─── Helpers ──────────────────────────────────────────────────────────────────
function isVec3(v) {
    return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number");
}
function parseShape(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    const r = raw;
    if (r.type === "Box" && Array.isArray(r.params) && r.params.length === 3) {
        return { type: "Box", params: r.params };
    }
    if (r.type === "Sphere" && Array.isArray(r.params) && r.params.length >= 1) {
        return { type: "Sphere", params: [r.params[0]] };
    }
    if (r.type === "Compound" && Array.isArray(r.children)) {
        const children = r.children.filter((c) => {
            if (!c || typeof c !== "object")
                return false;
            const ch = c;
            return (ch.type === "Box" || ch.type === "Sphere") && Array.isArray(ch.params) && isVec3(ch.position);
        });
        if (children.length > 0)
            return { type: "Compound", children };
    }
    return undefined;
}
function mapShapeToViro(shape) {
    if (shape.type === "Box")
        return { type: "Box", params: [...shape.params] };
    if (shape.type === "Sphere")
        return { type: "Sphere", params: [...shape.params] };
    return {
        type: "Compound",
        params: [],
        children: shape.children.map((c) => {
            const base = { type: c.type, params: [...c.params], position: [...c.position] };
            if (c.rotation)
                base.rotation = [...c.rotation];
            return base;
        }),
    };
}
function normalizeTorque(torque) {
    if (Array.isArray(torque[0])) {
        return torque.reduce((acc, t) => [acc[0] + t[0], acc[1] + t[1], acc[2] + t[2]], [0, 0, 0]);
    }
    return [...torque];
}
function normalizeForce(force) {
    const arr = Array.isArray(force) ? force : [force];
    return arr.map((f) => ({
        value: [...f.value],
        position: f.position != null ? [...f.position] : undefined,
    }));
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Parses `scene.physics_world_config` JSON. Returns null if missing or invalid.
 */
function parsePhysicsWorldConfig(raw) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw))
        return null;
    const r = raw;
    try {
        return {
            enabled: typeof r.enabled === "boolean" ? r.enabled : false,
            gravity: isVec3(r.gravity) ? r.gravity : [0, -9.8, 0],
            drawBounds: typeof r.drawBounds === "boolean" ? r.drawBounds : false,
        };
    }
    catch {
        return null;
    }
}
/**
 * Parses `asset.physics_config` JSON. Returns null if missing or invalid.
 */
function parsePhysicsBodyConfig(raw) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw))
        return null;
    const r = raw;
    try {
        const type = (["Dynamic", "Kinematic", "Static"].includes(r.type)
            ? r.type
            : undefined);
        if (!type)
            return null;
        const mass = typeof r.mass === "number" ? r.mass : 0;
        const config = {
            enabled: typeof r.enabled === "boolean" ? r.enabled : true,
            type,
            mass,
        };
        const shape = parseShape(r.shape);
        if (shape)
            config.shape = shape;
        if (typeof r.restitution === "number")
            config.restitution = r.restitution;
        if (typeof r.friction === "number")
            config.friction = r.friction;
        if (typeof r.useGravity === "boolean")
            config.useGravity = r.useGravity;
        if (typeof r.viroTag === "string")
            config.viroTag = r.viroTag;
        if (isVec3(r.velocity))
            config.velocity = r.velocity;
        if (r.torque != null)
            config.torque = r.torque;
        if (r.force != null)
            config.force = r.force;
        return config;
    }
    catch {
        return null;
    }
}
/** Viro `ViroARScene` physicsWorld prop. */
function buildViroPhysicsWorld(config) {
    return {
        gravity: [...config.gravity],
        ...(config.drawBounds ? { drawBounds: true } : {}),
    };
}
/** Maps validated Studio physics_config to Viro `physicsBody` prop. */
function buildViroPhysicsBody(config, options) {
    const kinematicDrag = options?.kinematicDragOverride === true && config.type === "Dynamic" && config.enabled;
    const type = kinematicDrag ? "Kinematic" : config.type;
    const mass = kinematicDrag ? 0 : config.mass;
    const shape = mapShapeToViro(config.shape ?? { type: "Box", params: [1, 1, 1] });
    const body = { type, mass, shape, enabled: config.enabled };
    if (config.restitution !== undefined)
        body.restitution = config.restitution;
    if (config.friction !== undefined)
        body.friction = config.friction;
    if (config.useGravity !== undefined)
        body.useGravity = kinematicDrag ? false : config.useGravity;
    if (config.velocity !== undefined)
        body.velocity = [...config.velocity];
    if (config.torque !== undefined)
        body.torque = normalizeTorque(config.torque);
    if (config.force !== undefined)
        body.force = normalizeForce(config.force);
    return body;
}
/**
 * Draggable Dynamic bodies need kinematic override during drag so the simulation
 * doesn't fight the gesture.
 */
function shouldUseKinematicPhysicsDrag(asset, config) {
    return (asset.is_draggable === true &&
        config != null &&
        config.enabled === true &&
        config.type === "Dynamic");
}
