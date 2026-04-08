/**
 * Studio physics_config and physics_world_config parsing and Viro prop building.
 * Ported from studio-go/domain/physicsConfig.ts — no zod dependency.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type Vec3 = [number, number, number];

type ForceEntry = { value: Vec3; position?: Vec3 };

type PhysicsShape =
  | { type: "Box"; params: [number, number, number] }
  | { type: "Sphere"; params: [number] }
  | { type: "Compound"; children: Array<{ type: "Box" | "Sphere"; params: number[]; position: Vec3; rotation?: Vec3 }> };

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number");
}

function parseShape(raw: unknown): PhysicsShape | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;

  if (r.type === "Box" && Array.isArray(r.params) && r.params.length === 3) {
    return { type: "Box", params: r.params as [number, number, number] };
  }
  if (r.type === "Sphere" && Array.isArray(r.params) && r.params.length >= 1) {
    return { type: "Sphere", params: [r.params[0] as number] };
  }
  if (r.type === "Compound" && Array.isArray(r.children)) {
    const children = (r.children as unknown[]).filter((c): c is { type: "Box" | "Sphere"; params: number[]; position: Vec3; rotation?: Vec3 } => {
      if (!c || typeof c !== "object") return false;
      const ch = c as Record<string, unknown>;
      return (ch.type === "Box" || ch.type === "Sphere") && Array.isArray(ch.params) && isVec3(ch.position);
    });
    if (children.length > 0) return { type: "Compound", children };
  }
  return undefined;
}

function mapShapeToViro(shape: PhysicsShape): Record<string, unknown> {
  if (shape.type === "Box") return { type: "Box", params: [...shape.params] };
  if (shape.type === "Sphere") return { type: "Sphere", params: [...shape.params] };
  return {
    type: "Compound",
    params: [],
    children: shape.children.map((c) => {
      const base: Record<string, unknown> = { type: c.type, params: [...c.params], position: [...c.position] };
      if (c.rotation) base.rotation = [...c.rotation];
      return base;
    }),
  };
}

function normalizeTorque(torque: Vec3 | Vec3[]): Vec3 {
  if (Array.isArray(torque[0])) {
    return (torque as Vec3[]).reduce<Vec3>(
      (acc, t) => [acc[0] + t[0], acc[1] + t[1], acc[2] + t[2]],
      [0, 0, 0],
    );
  }
  return [...(torque as Vec3)] as Vec3;
}

function normalizeForce(force: ForceEntry | ForceEntry[]): Array<{ value: number[]; position?: number[] }> {
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
export function parsePhysicsWorldConfig(raw: unknown): PhysicsWorldConfig | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  try {
    return {
      enabled: typeof r.enabled === "boolean" ? r.enabled : false,
      gravity: isVec3(r.gravity) ? r.gravity : [0, -9.8, 0],
      drawBounds: typeof r.drawBounds === "boolean" ? r.drawBounds : false,
    };
  } catch {
    return null;
  }
}

/**
 * Parses `asset.physics_config` JSON. Returns null if missing or invalid.
 */
export function parsePhysicsBodyConfig(raw: unknown): PhysicsBodyConfig | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  try {
    const type = (["Dynamic", "Kinematic", "Static"].includes(r.type as string)
      ? r.type
      : undefined) as PhysicsBodyConfig["type"] | undefined;
    if (!type) return null;

    const mass = typeof r.mass === "number" ? r.mass : 0;
    const config: PhysicsBodyConfig = {
      enabled: typeof r.enabled === "boolean" ? r.enabled : true,
      type,
      mass,
    };

    const shape = parseShape(r.shape);
    if (shape) config.shape = shape;
    if (typeof r.restitution === "number") config.restitution = r.restitution;
    if (typeof r.friction === "number")    config.friction    = r.friction;
    if (typeof r.useGravity === "boolean") config.useGravity  = r.useGravity;
    if (typeof r.viroTag === "string")     config.viroTag     = r.viroTag;
    if (isVec3(r.velocity))               config.velocity    = r.velocity;
    if (r.torque != null)                 config.torque      = r.torque as Vec3 | Vec3[];
    if (r.force != null)                  config.force       = r.force as ForceEntry | ForceEntry[];

    return config;
  } catch {
    return null;
  }
}

/** Viro `ViroARScene` physicsWorld prop. */
export function buildViroPhysicsWorld(config: PhysicsWorldConfig): {
  gravity: Vec3;
  drawBounds?: boolean;
} {
  return {
    gravity: [...config.gravity] as Vec3,
    ...(config.drawBounds ? { drawBounds: true } : {}),
  };
}

/** Maps validated Studio physics_config to Viro `physicsBody` prop. */
export function buildViroPhysicsBody(
  config: PhysicsBodyConfig,
  options?: BuildViroPhysicsBodyOptions,
): Record<string, unknown> {
  const kinematicDrag =
    options?.kinematicDragOverride === true && config.type === "Dynamic" && config.enabled;

  const type = kinematicDrag ? "Kinematic" : config.type;
  const mass = kinematicDrag ? 0 : config.mass;
  const shape = mapShapeToViro(config.shape ?? { type: "Box", params: [1, 1, 1] });

  const body: Record<string, unknown> = { type, mass, shape, enabled: config.enabled };

  if (config.restitution !== undefined) body.restitution = config.restitution;
  if (config.friction    !== undefined) body.friction    = config.friction;
  if (config.useGravity  !== undefined) body.useGravity  = kinematicDrag ? false : config.useGravity;
  if (config.velocity    !== undefined) body.velocity    = [...config.velocity];
  if (config.torque      !== undefined) body.torque      = normalizeTorque(config.torque);
  if (config.force       !== undefined) body.force       = normalizeForce(config.force);

  return body;
}

/**
 * Draggable Dynamic bodies need kinematic override during drag so the simulation
 * doesn't fight the gesture.
 */
export function shouldUseKinematicPhysicsDrag(
  asset: { is_draggable: boolean },
  config: PhysicsBodyConfig | null,
): boolean {
  return (
    asset.is_draggable === true &&
    config != null &&
    config.enabled === true &&
    config.type === "Dynamic"
  );
}
