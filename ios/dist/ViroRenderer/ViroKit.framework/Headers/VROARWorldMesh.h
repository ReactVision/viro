//
//  VROARWorldMesh.h
//  ViroRenderer
//
//  Copyright © 2024 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

#ifndef VROARWorldMesh_h
#define VROARWorldMesh_h

#include <memory>
#include <string>
#include <chrono>
#include <functional>
#include <map>
#include <mutex>
#include <cstdint>
#include "VROVector3f.h"

class VROARDepthMesh;
class VROARFrame;
class VROPhysicsWorld;
class VROPhysicsShape;
class VROPencil;
class btRigidBody;
class btDefaultMotionState;

/**
 * Configuration for world mesh generation and physics properties.
 */
struct VROWorldMeshConfig {
    // Mesh generation settings
    int stride = 4;                     // Sample every Nth pixel (lower = more detail, higher cost)
    float minConfidence = 0.3f;         // Minimum confidence threshold (0.0-1.0)
    float maxDepth = 5.0f;              // Maximum depth in meters

    // Update settings
    double updateIntervalMs = 500.0;    // Minimum time between mesh updates
    double meshPersistenceMs = 500.0;   // Time to keep mesh after depth data lost

    // Physics properties
    float friction = 0.5f;              // Surface friction coefficient
    float restitution = 0.3f;           // Bounciness (0 = no bounce, 1 = full bounce)
    std::string collisionTag = "world"; // Tag for collision event identification
    int physicsMaxTriangles = 0;        // Stride-decimation triangle cap (0 = no limit). Leaves
                                        // large gaps — prefer physicsCellSize for collision.
    float physicsCellSize = 0.10f;      // Vertex-clustering cell size in meters (0 = disabled).
                                        // Groups nearby vertices into a single representative,
                                        // producing a gap-free simplified mesh. Max collision gap =
                                        // sqrt(3) * cellSize. 0.10m → catches objects >~8cm reliably.
                                        // Applied before physicsMaxTriangles (if both set).

    // Visualization
    bool debugDrawEnabled = false;         // Enable wireframe visualization of mesh
    bool debugDrawDepthTest = true;        // Depth-test wireframe against scene (occluded by real surfaces)
    int debugDrawMaxTriangles = 1000;      // Triangle cap for wireframe debug draw
    float debugDrawLineThickness = 0.001f; // Line thickness for wireframe (meters)
};

/**
 * Identifies the data source that produced a world mesh.
 */
enum class VROWorldMeshSource {
    LiDAR,      // ARKit ARMeshAnchor (LiDAR-equipped device)
    Monocular,  // Monocular depth estimation (non-LiDAR device)
    Plane,      // Triangulated AR plane anchors (fallback)
    Unknown
};

/**
 * Statistics about the current world mesh state.
 */
struct VROWorldMeshStats {
    int vertexCount = 0;                // Number of vertices in mesh
    int triangleCount = 0;              // Number of triangles in mesh
    float averageConfidence = 0.0f;     // Average confidence of depth samples
    double lastUpdateTimeMs = 0.0;      // Timestamp of last mesh update
    bool isStale = false;               // True if depth data hasn't been received recently
};

/**
 * Delivered to every registered subscriber when the world mesh is updated.
 */
struct VROWorldMeshUpdate {
    std::shared_ptr<VROARDepthMesh> mesh;
    VROWorldMeshStats stats;
    VROWorldMeshSource source = VROWorldMeshSource::Unknown;
};

/**
 * Per-subscriber options controlling mesh decimation.
 * maxTriangles = 0 means no limit (full mesh delivered as-is).
 */
struct VROWorldMeshSubscriberOptions {
    enum class DecimationStrategy {
        Stride,       // Take every N-th triangle (O(1) per triangle, default)
    };

    int maxTriangles = 0;                              // 0 = unlimited
    DecimationStrategy strategy = DecimationStrategy::Stride;
};

using VROWorldMeshSubscriberId = uint32_t;
using VROWorldMeshSubscriberCallback = std::function<void(const VROWorldMeshUpdate&)>;

/**
 * Legacy callback — delivers only stats. Kept for back-compat; prefer subscribe().
 */
using VROWorldMeshUpdateCallback = std::function<void(const VROWorldMeshStats&)>;

/**
 * Custom deleter for btRigidBody.
 * Bullet requires removing the body from the dynamics world before deletion;
 * this deleter encapsulates that invariant so it can't be forgotten.
 */
struct BulletRigidBodyDeleter {
    std::weak_ptr<VROPhysicsWorld> physicsWorld;
    void operator()(btRigidBody *body) const;
};

/**
 * VROARWorldMesh manages the lifecycle of a physics collision mesh generated
 * from AR depth data. It automatically updates the mesh from incoming AR frames
 * and maintains a Bullet physics body for collision detection.
 *
 * This enables virtual objects to physically interact with real-world surfaces
 * detected through depth sensing (LiDAR on iOS, ToF/ARCore Depth on Android).
 */
class VROARWorldMesh : public std::enable_shared_from_this<VROARWorldMesh> {
public:
    /**
     * Create a new world mesh manager.
     *
     * @param physicsWorld The physics world to add the collision body to
     */
    VROARWorldMesh(std::shared_ptr<VROPhysicsWorld> physicsWorld);
    ~VROARWorldMesh();

    /**
     * Update the world mesh from the current AR frame.
     * This should be called each frame. The mesh will only be regenerated
     * if enough time has passed since the last update (controlled by updateIntervalMs).
     *
     * @param frame The current AR frame with depth data
     */
    void updateFromFrame(const std::unique_ptr<VROARFrame>& frame);

    /**
     * Force an immediate mesh update, ignoring the update interval.
     *
     * @param frame The current AR frame with depth data
     */
    void forceUpdate(const std::unique_ptr<VROARFrame>& frame);

    /**
     * Set the mesh configuration. Changes take effect on next update.
     */
    void setConfig(const VROWorldMeshConfig& config);

    /**
     * Get the current configuration.
     */
    VROWorldMeshConfig getConfig() const { return _config; }

    /**
     * Enable or disable the world mesh.
     * When disabled, the mesh is removed from the physics world.
     */
    void setEnabled(bool enabled);

    /**
     * Check if the world mesh is enabled.
     */
    bool isEnabled() const { return _enabled; }

    /**
     * Get the current mesh data (may be nullptr if no mesh generated yet).
     */
    std::shared_ptr<VROARDepthMesh> getCurrentMesh() const { return _currentMesh; }

    /**
     * Get statistics about the current mesh state.
     */
    VROWorldMeshStats getStats() const;

    /**
     * Subscribe to mesh updates. Returns an opaque ID used to unsubscribe.
     * The callback is invoked on the render thread after each successful mesh build.
     * @param callback Receives the full VROWorldMeshUpdate (mesh, stats, source).
     * @param options  Per-consumer options (e.g. maxTriangles for W3 decimation).
     */
    VROWorldMeshSubscriberId subscribe(VROWorldMeshSubscriberCallback callback,
                                       VROWorldMeshSubscriberOptions options = {});

    /**
     * Unsubscribe a previously registered callback. No-op if id is not found.
     */
    void unsubscribe(VROWorldMeshSubscriberId id);

    /**
     * @deprecated Prefer subscribe(). Delivers stats only, no mesh data.
     */
    void setUpdateCallback(VROWorldMeshUpdateCallback callback) {
        _updateCallback = callback;
    }

    /**
     * Draw the mesh wireframe using the provided pencil.
     * Should be called each frame when debugDrawEnabled is true.
     *
     * @param pencil The pencil to use for drawing lines
     */
    void debugDraw(std::shared_ptr<VROPencil> pencil);

private:
    std::weak_ptr<VROPhysicsWorld> _physicsWorld;

    // Bullet physics components — smart pointers for exception-safe lifecycle.
    // BulletRigidBodyDeleter removes the body from the world before deletion.
    std::unique_ptr<btRigidBody, BulletRigidBodyDeleter> _rigidBody;
    std::unique_ptr<btDefaultMotionState> _motionState;
    std::shared_ptr<VROPhysicsShape> _physicsShape;

    // Current mesh data
    std::shared_ptr<VROARDepthMesh> _currentMesh;

    // Configuration and state
    VROWorldMeshConfig _config;
    bool _enabled = false;
    bool _isAddedToPhysicsWorld = false;  // guard against re-add on rapid updates

    // Timing
    double _lastUpdateTimeMs = 0.0;
    double _lastDepthTimeMs = 0.0;

    // Legacy stats-only callback
    VROWorldMeshUpdateCallback _updateCallback;

    // Subscriber registry
    std::map<VROWorldMeshSubscriberId,
             std::pair<VROWorldMeshSubscriberCallback, VROWorldMeshSubscriberOptions>> _subscribers;
    VROWorldMeshSubscriberId _nextSubscriberId = 1;
    mutable std::mutex _subscriberMutex;

    /**
     * Apply a new mesh to the physics world.
     * Creates a new physics shape and rigid body from the mesh.
     */
    void applyMeshToPhysics(std::shared_ptr<VROARDepthMesh> mesh);

    /**
     * Remove the current physics body from the world.
     */
    void removeFromPhysicsWorld();

    /**
     * Add the current physics body to the world.
     */
    void addToPhysicsWorld();

    /**
     * Get the current time in milliseconds.
     */
    double getCurrentTimeMs() const;

    /**
     * Check if enough time has passed for a new update.
     */
    bool shouldUpdate() const;

    /**
     * Check if the mesh is stale (depth data not received recently).
     */
    bool isMeshStale() const;

    /**
     * Fire the legacy _updateCallback and all registered subscribers.
     * Called on the render thread after a mesh is successfully applied.
     */
    void notifySubscribers(std::shared_ptr<VROARDepthMesh> mesh);

    /**
     * Return a decimated copy of mesh with at most maxTriangles triangles,
     * using Stride strategy (every N-th triangle). Vertices are copied as-is;
     * only the index buffer is thinned. Returns mesh unchanged if already within budget.
     */
    static std::shared_ptr<VROARDepthMesh> decimateMesh(
        std::shared_ptr<VROARDepthMesh> mesh, int maxTriangles);

    /**
     * Vertex-clustering simplification. Groups all vertices within cellSize metres
     * into a single representative, rebuilds triangles, drops degenerate ones.
     * Produces a gap-free mesh: max gap = sqrt(3)*cellSize.
     * 0.10m cells → catches objects wider than ~8cm reliably.
     */
    static std::shared_ptr<VROARDepthMesh> clusterMesh(
        std::shared_ptr<VROARDepthMesh> mesh, float cellSize);
};

#endif /* VROARWorldMesh_h */
