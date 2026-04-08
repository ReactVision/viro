/**
 * Studio physics_config and physics_world_config parsing and Viro prop building.
 * Ported from studio-go/domain/physicsConfig.ts — no zod dependency.
 */
type Vec3 = [number, number, number];
type ForceEntry = {
    value: Vec3;
    position?: Vec3;
};
type PhysicsShape = {
    type: "Box";
    params: [number, number, number];
} | {
    type: "Sphere";
    params: [number];
} | {
    type: "Compound";
    children: Array<{
        type: "Box" | "Sphere";
        params: number[];
        position: Vec3;
        rotation?: Vec3;
    }>;
};
export type PhysicsBodyConfig = {
    enabled: boolean;
    type: "Dynamic" | "Kinematic" | "Static";
    mass: number;
    shape?: PhysicsShape;
    restitution?: number;
    friction?: number;
    useGravity?: boolean;
    viroTag?: string;
    force?: ForceEntry | ForceEntry[];
    torque?: Vec3 | Vec3[];
    velocity?: Vec3;
};
export type PhysicsWorldConfig = {
    enabled: boolean;
    gravity: Vec3;
    drawBounds: boolean;
};
export type BuildViroPhysicsBodyOptions = {
    /** Forces Dynamic body to Kinematic with mass 0 while dragging. */
    kinematicDragOverride?: boolean;
};
/**
 * Parses `scene.physics_world_config` JSON. Returns null if missing or invalid.
 */
export declare function parsePhysicsWorldConfig(raw: unknown): PhysicsWorldConfig | null;
/**
 * Parses `asset.physics_config` JSON. Returns null if missing or invalid.
 */
export declare function parsePhysicsBodyConfig(raw: unknown): PhysicsBodyConfig | null;
/** Viro `ViroARScene` physicsWorld prop. */
export declare function buildViroPhysicsWorld(config: PhysicsWorldConfig): {
    gravity: Vec3;
    drawBounds?: boolean;
};
/** Maps validated Studio physics_config to Viro `physicsBody` prop. */
export declare function buildViroPhysicsBody(config: PhysicsBodyConfig, options?: BuildViroPhysicsBodyOptions): Record<string, unknown>;
/**
 * Draggable Dynamic bodies need kinematic override during drag so the simulation
 * doesn't fight the gesture.
 */
export declare function shouldUseKinematicPhysicsDrag(asset: {
    is_draggable: boolean;
}, config: PhysicsBodyConfig | null): boolean;
export {};
