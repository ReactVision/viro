/**
 * Studio physics_config and physics_world_config parsing and Viro prop building.
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
    /**
     * The node's uniform scale, applied to an explicit Box or Sphere shape.
     * virocore does not scale one: `generateBasicBulletShape(type, params)` builds
     * the bullet shape from the params as given and only the geometry-inferred
     * branch calls `setLocalScaling`, so a 1 m collider stayed 1 m around a node
     * scaled to 2 and the node sank halfway through whatever it landed on. The
     * editors multiply when they build their own collider; this is the same rule.
     */
    scale?: number;
};
/**
 * Parses `scene.physics_world_config` JSON. Returns null if missing or invalid.
 */
export declare function parsePhysicsWorldConfig(raw: unknown): PhysicsWorldConfig | null;
/**
 * The scene-level switch, and the gate on every body: no world, no bodies.
 *
 * Without it a placement carrying `physics_config` simulated on the device in a
 * scene whose author had physics switched off, because virocore adds a body to a
 * `VROPhysicsWorld` it creates on demand at its own -9.81 gravity
 * (`VROScene::getPhysicsWorld`) whether or not the scene sent a `physicsWorld`
 * prop. Nothing landed, since AR has no floor, so the content fell out of sight
 * while the Studio editor drew it standing still. `StudioARScene` reads the same
 * flag for the `physicsWorld` prop, where it also carries the gravity.
 */
export declare function isPhysicsWorldEnabled(scene: {
    physics_world_config?: Record<string, unknown> | null;
} | null): boolean;
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
