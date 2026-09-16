/**
 * Translating a node's `physicsBody` prop into C API calls.
 *
 * The prop shape is whatever `Studio/domain/physicsConfig.ts` emits, which is
 * also what the native bridges take — that module is platform-agnostic domain
 * code and its rules (collider scale, inferred shapes, the instant velocity)
 * were already fought out against virocore's real behaviour. Nothing here
 * re-decides any of that; it only carries it across.
 */
import { ViroPhysicsShapeType, type ViroHandle, type ViroSceneApi } from "@reactvision/viro-web-renderer";
export interface ViroPhysicsShapeProp {
    type?: string;
    params?: number[];
    children?: {
        type?: string;
        params?: number[];
        position?: number[];
    }[];
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
/**
 * The shape as the C API takes it: a type and a flat param list.
 *
 * An absent or unrecognised shape resolves to `Infer`, which is the absence of
 * a shape rather than a shape — virocore then fits one to the node's own
 * bounding box and applies its world scale, which is what the editors measure.
 * Substituting a unit box here is what used to give a 0.4 m model a 1 m collider
 * and stand it off the ground.
 */
export declare function resolveShape(shape: ViroPhysicsShapeProp | undefined): {
    type: ViroPhysicsShapeType;
    params: number[];
};
/**
 * Attach (or detach) a node's rigid body.
 *
 * `enabled: false` clears it rather than adding a disabled one: the scene-level
 * switch already decides whether the world simulates, and a body nobody drives
 * is just a collider waiting to surprise someone.
 */
export declare function applyPhysicsBody(scene: ViroSceneApi, node: ViroHandle, body: ViroPhysicsBodyProp | undefined, tag: string): void;
