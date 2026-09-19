/**
 * Copyright (c) 2024-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Configuration for world mesh generation and physics properties.
 */
export type ViroWorldMeshConfig = {
  /**
   * Sample every Nth pixel from the depth image.
   * Lower values = more detail but higher cost.
   * @default 4
   */
  stride?: number;

  /**
   * Minimum confidence threshold for depth samples (0.0-1.0).
   * Samples below this threshold are excluded from the mesh.
   * @default 0.3
   */
  minConfidence?: number;

  /**
   * Maximum depth distance in meters.
   * Samples beyond this distance are excluded from the mesh.
   * @default 5.0
   */
  maxDepth?: number;

  /**
   * Minimum time between mesh updates in milliseconds.
   * @default 100
   */
  updateIntervalMs?: number;

  /**
   * Time to keep the mesh after depth data is lost, in milliseconds.
   * After this time, the mesh is marked as stale.
   * @default 500
   */
  meshPersistenceMs?: number;

  /**
   * Friction coefficient for the physics surface (0.0-1.0).
   * Higher values = more friction.
   * @default 0.5
   */
  friction?: number;

  /**
   * Restitution (bounciness) of the physics surface (0.0-1.0).
   * 0 = no bounce, 1 = full bounce.
   * @default 0.3
   */
  restitution?: number;

  /**
   * Tag used to identify world mesh collisions in onCollision events.
   * @default "world"
   */
  collisionTag?: string;

  /**
   * Enable wireframe visualization of the depth mesh.
   * Useful for debugging and understanding the collision surface.
   * @default false
   */
  debugDrawEnabled?: boolean;
};

/**
 * Statistics about the current world mesh state.
 */
export type ViroWorldMeshStats = {
  /**
   * Number of vertices in the current mesh.
   */
  vertexCount: number;

  /**
   * Number of triangles in the current mesh.
   */
  triangleCount: number;

  /**
   * Average confidence of depth samples used to generate the mesh (0.0-1.0).
   */
  averageConfidence: number;

  /**
   * Timestamp of the last mesh update in milliseconds.
   */
  lastUpdateTimeMs: number;

  /**
   * True if depth data hasn't been received recently and the mesh may be outdated.
   */
  isStale: boolean;
};

/**
 * What `getWorldMeshStats()` answers.
 *
 * Poll it. The navigator's `onWorldMeshUpdated` prop looks like the way to learn this, but it
 * never fires: `VROARScene` calls its delegate on every mesh update and neither the iOS nor the
 * Android bridge forwards that call, so the event has been dead since it was added.
 *
 * `available: false` is an ordinary answer — capture off, or no AR scene mounted yet — and
 * `reason` says which, so a caller can tell "turn it on" apart from "keep looking around".
 */
export type ViroWorldMeshStatsResult =
  | ({ available: true; enabled: boolean } & ViroWorldMeshStats)
  | { available: false; enabled?: boolean; reason: string };

/**
 * Event fired when the world mesh is updated.
 */
export type ViroWorldMeshUpdatedEvent = {
  /**
   * Current mesh statistics.
   */
  stats: ViroWorldMeshStats;
};
