/**
 * Translating a node's `physicsBody` prop into C API calls.
 *
 * The prop shape is whatever `Studio/domain/physicsConfig.ts` emits, which is
 * also what the native bridges take — that module is platform-agnostic domain
 * code and its rules (collider scale, inferred shapes, the instant velocity)
 * were already fought out against virocore's real behaviour. Nothing here
 * re-decides any of that; it only carries it across.
 */
import {
  ViroPhysicsBodyType,
  ViroPhysicsShapeType,
  VIRO_COMPOUND_CHILD_STRIDE,
  type ViroHandle,
  type ViroSceneApi,
} from "@reactvision/viro-web-renderer";

export interface ViroPhysicsShapeProp {
  type?: string;
  params?: number[];
  children?: { type?: string; params?: number[]; position?: number[] }[];
}

export interface ViroPhysicsBodyProp {
  type?: string;
  mass?: number;
  enabled?: boolean;
  shape?: ViroPhysicsShapeProp;
  restitution?: number;
  friction?: number;
  useGravity?: boolean;
  /** Consumed once by the next physics step; see applyPhysicsBody. */
  instantVelocity?: number[];
  [key: string]: unknown;
}

function bodyType(type?: string): ViroPhysicsBodyType {
  switch ((type ?? "").toLowerCase()) {
    case "dynamic": return ViroPhysicsBodyType.Dynamic;
    case "kinematic": return ViroPhysicsBodyType.Kinematic;
    default: return ViroPhysicsBodyType.Static;
  }
}

const vec3 = (a: number[] | undefined, i: number) => a?.[i] ?? 0;

/**
 * The shape as the C API takes it: a type and a flat param list.
 *
 * An absent or unrecognised shape resolves to `Infer`, which is the absence of
 * a shape rather than a shape — virocore then fits one to the node's own
 * bounding box and applies its world scale, which is what the editors measure.
 * Substituting a unit box here is what used to give a 0.4 m model a 1 m collider
 * and stand it off the ground.
 */
export function resolveShape(
  shape: ViroPhysicsShapeProp | undefined,
): { type: ViroPhysicsShapeType; params: number[] } {
  const name = (shape?.type ?? "").toLowerCase();

  if (name === "box") {
    return { type: ViroPhysicsShapeType.Box, params: [...(shape?.params ?? [])] };
  }
  if (name === "sphere") {
    return { type: ViroPhysicsShapeType.Sphere, params: [shape?.params?.[0] ?? 0] };
  }
  if (name === "compound") {
    // Flattened at VIRO_COMPOUND_CHILD_STRIDE floats per part. A part's rotation
    // is dropped rather than approximated: virocore carries no slot for it, and
    // placing a rotated part unrotated is at least a shape the author can see,
    // where inventing an encoding would disagree with every other surface.
    const params: number[] = [];
    for (const child of shape?.children ?? []) {
      const isSphere = (child.type ?? "").toLowerCase() === "sphere";
      params.push(
        isSphere ? 1 : 0,
        vec3(child.params, 0),
        isSphere ? 0 : vec3(child.params, 1),
        isSphere ? 0 : vec3(child.params, 2),
        vec3(child.position, 0),
        vec3(child.position, 1),
        vec3(child.position, 2),
      );
    }
    // No parts is the inferred compound virocore has always meant by the tag,
    // so let it infer rather than sending an empty explicit one.
    if (params.length < VIRO_COMPOUND_CHILD_STRIDE) {
      return { type: ViroPhysicsShapeType.Infer, params: [] };
    }
    return { type: ViroPhysicsShapeType.Compound, params };
  }

  return { type: ViroPhysicsShapeType.Infer, params: [] };
}

/**
 * Attach (or detach) a node's rigid body.
 *
 * `enabled: false` clears it rather than adding a disabled one: the scene-level
 * switch already decides whether the world simulates, and a body nobody drives
 * is just a collider waiting to surprise someone.
 */
export function applyPhysicsBody(
  scene: ViroSceneApi,
  node: ViroHandle,
  body: ViroPhysicsBodyProp | undefined,
  tag: string,
): void {
  if (!body || body.enabled === false) {
    scene.clearPhysicsBody(node);
    return;
  }

  const shape = resolveShape(body.shape);
  scene.setPhysicsBody(node, bodyType(body.type), body.mass ?? 0, shape.type, shape.params, tag);
  scene.setPhysicsBodyProperties(
    node,
    body.restitution ?? 0,
    body.friction ?? 0.5,
    body.useGravity !== false,
  );

  // Instant, never constant. A constant velocity is reasserted on the rigid body
  // every frame so gravity never gets a turn and a launched object climbs for
  // ever — which is why the config sends `instantVelocity`.
  if (body.instantVelocity) {
    const v = body.instantVelocity;
    scene.setPhysicsVelocity(node, [vec3(v, 0), vec3(v, 1), vec3(v, 2)], false);
  }
}
