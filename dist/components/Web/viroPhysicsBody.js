"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveShape = resolveShape;
exports.applyPhysicsBody = applyPhysicsBody;
/**
 * Translating a node's `physicsBody` prop into C API calls.
 *
 * The prop shape is whatever `Studio/domain/physicsConfig.ts` emits, which is
 * also what the native bridges take — that module is platform-agnostic domain
 * code and its rules (collider scale, inferred shapes, the instant velocity)
 * were already fought out against virocore's real behaviour. Nothing here
 * re-decides any of that; it only carries it across.
 */
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
function bodyType(type) {
    switch ((type ?? "").toLowerCase()) {
        case "dynamic": return viro_web_renderer_1.ViroPhysicsBodyType.Dynamic;
        case "kinematic": return viro_web_renderer_1.ViroPhysicsBodyType.Kinematic;
        default: return viro_web_renderer_1.ViroPhysicsBodyType.Static;
    }
}
const vec3 = (a, i) => a?.[i] ?? 0;
/**
 * The shape as the C API takes it: a type and a flat param list.
 *
 * An absent or unrecognised shape resolves to `Infer`, which is the absence of
 * a shape rather than a shape — virocore then fits one to the node's own
 * bounding box and applies its world scale, which is what the editors measure.
 * Substituting a unit box here is what used to give a 0.4 m model a 1 m collider
 * and stand it off the ground.
 */
function resolveShape(shape) {
    const name = (shape?.type ?? "").toLowerCase();
    if (name === "box") {
        return { type: viro_web_renderer_1.ViroPhysicsShapeType.Box, params: [...(shape?.params ?? [])] };
    }
    if (name === "sphere") {
        return { type: viro_web_renderer_1.ViroPhysicsShapeType.Sphere, params: [shape?.params?.[0] ?? 0] };
    }
    if (name === "compound") {
        // Flattened at VIRO_COMPOUND_CHILD_STRIDE floats per part. A part's rotation
        // is dropped rather than approximated: virocore carries no slot for it, and
        // placing a rotated part unrotated is at least a shape the author can see,
        // where inventing an encoding would disagree with every other surface.
        const params = [];
        for (const child of shape?.children ?? []) {
            const isSphere = (child.type ?? "").toLowerCase() === "sphere";
            params.push(isSphere ? 1 : 0, vec3(child.params, 0), isSphere ? 0 : vec3(child.params, 1), isSphere ? 0 : vec3(child.params, 2), vec3(child.position, 0), vec3(child.position, 1), vec3(child.position, 2));
        }
        // No parts is the inferred compound virocore has always meant by the tag,
        // so let it infer rather than sending an empty explicit one.
        if (params.length < viro_web_renderer_1.VIRO_COMPOUND_CHILD_STRIDE) {
            return { type: viro_web_renderer_1.ViroPhysicsShapeType.Infer, params: [] };
        }
        return { type: viro_web_renderer_1.ViroPhysicsShapeType.Compound, params };
    }
    return { type: viro_web_renderer_1.ViroPhysicsShapeType.Infer, params: [] };
}
/**
 * Attach (or detach) a node's rigid body.
 *
 * `enabled: false` clears it rather than adding a disabled one: the scene-level
 * switch already decides whether the world simulates, and a body nobody drives
 * is just a collider waiting to surprise someone.
 */
function applyPhysicsBody(scene, node, body, tag) {
    if (!body || body.enabled === false) {
        scene.clearPhysicsBody(node);
        return;
    }
    const shape = resolveShape(body.shape);
    scene.setPhysicsBody(node, bodyType(body.type), body.mass ?? 0, shape.type, shape.params, tag);
    scene.setPhysicsBodyProperties(node, body.restitution ?? 0, body.friction ?? 0.5, body.useGravity !== false);
    // Instant, never constant. A constant velocity is reasserted on the rigid body
    // every frame so gravity never gets a turn and a launched object climbs for
    // ever — which is why the config sends `instantVelocity`.
    if (body.instantVelocity) {
        const v = body.instantVelocity;
        scene.setPhysicsVelocity(node, [vec3(v, 0), vec3(v, 1), vec3(v, 2)], false);
    }
}
