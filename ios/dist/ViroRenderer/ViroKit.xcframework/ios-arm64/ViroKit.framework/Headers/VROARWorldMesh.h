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
#include <vector>
#include <atomic>
#include <utility>
#include "VROVector3f.h"
#include "VROTSDFVolume.h"
#include "VROMatrix4f.h"

class VROARDepthMesh;
class VROARFrame;
class VROPhysicsWorld;
class VROPhysicsShape;
class VROPencil;
class VROScene;
class VROGeometry;
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

    // Fusion across frames. ARKit accumulates for us on LiDAR devices and hands back mesh anchors;
    // ARCore and monocular depth give one frame at a time, so those two paths fuse here instead.
    bool accumulate = true;             // false reproduces the per-frame behaviour exactly
    float voxelSize = 0.04f;            // Fusion voxel edge, meters
    int maxMemoryMB = 64;               // Budget for the fused volume; oldest blocks evicted first

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
    int debugDrawMaxEdges = 6000;          // Edge budget for the wireframe. Counted in unique edges,
                                           // which is what costs: a shared edge is one line, not two.
                                           // Replaces debugDrawMaxTriangles, whose 1000 was sized for
                                           // one depth-image grid and starved an accumulated LiDAR mesh.
    float debugDrawCellSize = 0.04f;       // Vertex-clustering cell size for the wireframe, in meters.
                                           // Simplifies while keeping the surface connected, instead of
                                           // dropping whole triangles. Grown automatically to fit the
                                           // edge budget. 0 disables simplification.
    float debugDrawLineThickness = 0.004f; // Line thickness for wireframe (meters). 1mm was under a
                                           // screen pixel at arm's length, which is why the lines
                                           // shimmered and dropped out.
};

/**
 * Identifies the data source that produced a world mesh.
 */
enum class VROWorldMeshSource {
    LiDAR,      // ARKit ARMeshAnchor (LiDAR-equipped device)
    Depth,      // ARCore depth camera image
    Monocular,  // Monocular depth estimation (non-LiDAR device)
    Plane,      // Triangulated AR plane anchors (fallback)
    Unknown
};

/**
 * The name apps see. An app cannot tell a real depth mesh from the plane-anchor fallback without
 * it, and until now it had no way to ask.
 */
const char *VROWorldMeshSourceToString(VROWorldMeshSource source);

/**
 * Statistics about the current world mesh state.
 */
struct VROWorldMeshStats {
    int vertexCount = 0;                // Number of vertices in mesh
    int triangleCount = 0;              // Number of triangles in mesh
    float averageConfidence = 0.0f;     // Average confidence of depth samples
    double lastUpdateTimeMs = 0.0;      // Timestamp of last mesh update
    bool isStale = false;               // True if depth data hasn't been received recently
    VROWorldMeshSource source = VROWorldMeshSource::Unknown;  // Which of the three paths produced it
    // True when the mesh covers more than the current view: fused here on the depth paths, or
    // accumulated by ARKit on the mesh-anchor path. Not "our fusion ran".
    bool accumulated = false;
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
     * Bypasses the fusion: it replaces the accumulated mesh with this one frame, which is the
     * single-frame behaviour the fusion exists to end. Nothing calls it today. Route it through
     * updateFromFrame()'s fusion path before giving it a caller.
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

    /*
     Clears the fused volume, so the next scan starts from an empty room rather than carrying the
     last one. Also drops the current mesh and its physics body, so getStats() reports zero and
     serializeCurrentMesh() has nothing to upload until the next frame fuses — a snapshot taken
     between a reset and the next frame must not carry the previous room.

     On the mesh-anchor path ARKit owns the accumulation, so there is no volume to empty: the
     current mesh is still dropped and comes back with ARKit's next mesh-anchor update.

     Must be called on the render thread: it touches the physics world and the current mesh.
     */
    void resetAccumulation();

    /**
     * Check if the world mesh is enabled.
     */
    bool isEnabled() const { return _enabled; }

    /**
     * Get the current mesh data (may be nullptr if no mesh generated yet).
     */
    std::shared_ptr<VROARDepthMesh> getCurrentMesh() const {
        std::lock_guard<std::mutex> lock(_currentMeshMutex);
        return _currentMesh;
    }

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

    /**
     * WS-C: serialize the current mesh (vertices, per-vertex confidences,
     * triangle indices) into a compact custom binary format for persisting
     * as a cloud anchor asset (see finishScan() and rvUploadAsset()).
     *
     * Not glTF: this format is only ever read back by loadMeshSnapshot() in
     * this same class, not by third-party tools, so a minimal custom layout
     * avoids the risk of an unvalidated hand-written glTF writer producing
     * spec-invalid files (this repo has no way to open the result in a
     * glTF viewer to confirm correctness).
     *
     * @param locationTransform The same anchor/location-frame transform used
     *        to host this scan (RVCCACloudAnchorProvider's anchorTransform or
     *        computeLocationTransform() result). Vertices are stored relative
     *        to this frame (world = locationTransform * local), NOT in this
     *        session's raw world space — a resolve on a different device has
     *        a different, unrelated world origin, so raw world-space vertices
     *        would be meaningless there. This mirrors how SIFT features are
     *        already stored anchor/location-local (FeatureExtractor::toLocal).
     *
     * Layout (little-endian, matches all current target architectures):
     *   [0:4)   magic "RVWM"
     *   [4:5)   format version (1)
     *   [5:9)   vertexCount   (uint32)
     *   [9:13)  triangleCount (uint32)
     *   vertices:    vertexCount   * 3 * float32 (x,y,z, relative to locationTransform)
     *   confidences: vertexCount   * float32
     *   indices:     triangleCount * 3 * int32
     *
     * @return Empty vector if there is no current mesh.
     */
    std::vector<uint8_t> serializeCurrentMesh(const VROMatrix4f& locationTransform) const;

    /**
     * WS-C: reconstruct a VROARDepthMesh from bytes produced by
     * serializeCurrentMesh(), transforming vertices from the stored
     * location-frame-relative space into this session's world space.
     *
     * @param resolvedTransform The transform resolveCloudAnchor() computed
     *        for this session (the resolved anchor's world transform) —
     *        the same role locationTransform played at host time, now
     *        mapping local -> this session's world instead of the reverse.
     * @return nullptr if data is malformed (bad magic/version, truncated).
     */
    static std::shared_ptr<VROARDepthMesh> loadMeshSnapshot(const std::vector<uint8_t>& data,
                                                             const VROMatrix4f& resolvedTransform);

    /**
     * WS-C: attach a resolved (static) mesh snapshot loaded via
     * loadMeshSnapshot() — the counterpart to the live per-frame mesh for
     * mesh data recovered from a resolved cloud anchor's asset. Adds both:
     *   - Physics: reuses applyMeshToPhysics() verbatim, the same pipeline
     *     already used for the live mesh (clustering/decimation + async BVH).
     *   - Visual occlusion: builds a static, invisible depth-only geometry
     *     (see buildOcclusionGeometry()) and adds it to the scene root.
     *     This path is NEW engine code, verified only by compilation — this
     *     repo has no way to render an AR scene, so it has not been visually
     *     confirmed to occlude correctly. Test on device before shipping.
     *
     * It shares the live mesh's single slot, which has three consequences worth knowing before
     * resolving an anchor in a session that is still scanning:
     *   - The next live frame calls applyMeshToPhysics() in turn and takes the physics body with
     *     it. The occlusion geometry stays, being a node of its own, so the resolved mesh keeps
     *     occluding but stops colliding.
     *   - _currentMesh becomes the resolved mesh, so getStats() reports it and
     *     serializeCurrentMesh() would upload it back — a snapshot taken after a resolve returns
     *     the downloaded room, not the scanned one, until the next frame lands.
     *   - Each call adds another occlusion node and nothing removes them; resolving twice leaves
     *     two overlapping meshes in the scene.
     *
     * @param mesh The resolved mesh, already in this session's world space
     *        (see loadMeshSnapshot()'s resolvedTransform parameter).
     * @param scene The scene to add the occlusion geometry node to.
     */
    void attachResolvedMesh(std::shared_ptr<VROARDepthMesh> mesh, std::shared_ptr<VROScene> scene);

    /**
     * WS-C: build a static, invisible depth-only VROGeometry from a mesh's
     * vertices/indices. The material writes to the depth buffer but not the
     * color buffer (VROColorMaskNone) and disables culling (the mesh's
     * winding was computed relative to a different session's camera, not
     * guaranteed consistent for this session's viewpoints) — so it never
     * appears itself but still correctly z-tests virtual content behind it.
     * Public for testability; normally called via attachResolvedMesh().
     *
     * @return nullptr if mesh is null/invalid/empty.
     */
    static std::shared_ptr<VROGeometry> buildOcclusionGeometry(std::shared_ptr<VROARDepthMesh> mesh);

    /**
     * Vertex-clustering simplification. Groups all vertices within cellSize metres
     * into a single representative, rebuilds triangles, drops degenerate ones.
     * Produces a gap-free mesh: max gap = sqrt(3)*cellSize.
     * 0.10m cells → catches objects wider than ~8cm reliably.
     * Public for the VPS map mesh (VROARScene::setVPSMapMesh()).
     */
    static std::shared_ptr<VROARDepthMesh> clusterMesh(
        std::shared_ptr<VROARDepthMesh> mesh, float cellSize);

private:
    std::weak_ptr<VROPhysicsWorld> _physicsWorld;

    // Bullet physics components — smart pointers for exception-safe lifecycle.
    // BulletRigidBodyDeleter removes the body from the world before deletion.
    std::unique_ptr<btRigidBody, BulletRigidBodyDeleter> _rigidBody;
    std::unique_ptr<btDefaultMotionState> _motionState;
    std::shared_ptr<VROPhysicsShape> _physicsShape;

    // Current mesh data. Replaced on the render thread only, but read from others too: Android
    // snapshots it on the UI thread (rvSnapshotWorldMeshToFile → serializeCurrentMesh). Writes and
    // off-thread reads hold _currentMeshMutex, and readers work on their own shared_ptr copy, so a
    // replacement mid-serialisation cannot free the vectors being read.
    std::shared_ptr<VROARDepthMesh> _currentMesh;
    mutable std::mutex _currentMeshMutex;
    void setCurrentMesh(std::shared_ptr<VROARDepthMesh> mesh);

    /*
     Bumped whenever the physics body is torn down (a new mesh, a reset, a disable). The BVH for a
     mesh is built on a background thread and its body installed later on the render thread; that
     continuation compares the generation it was started under and drops itself if anything
     happened since. Without it a reset could be undone by a build already in flight, and two
     overlapping builds could finish out of order and leave the newer body out of the world.
     Render thread only.
     */
    uint64_t _physicsGeneration = 0;

    // Last source announced to the log, so the line appears on a change rather than every update.
    VROWorldMeshSource _lastReportedSource = VROWorldMeshSource::Unknown;

    /*
     The fused volume, and the lock that lets the background fusion task touch it while the render
     thread may be resetting it. Integrating a frame and extracting a room's surface cost tens of
     milliseconds — measured, not guessed — so neither runs on the render thread.
     */
    std::unique_ptr<VROTSDFVolume> _volume;
    std::mutex _volumeMutex;
    std::atomic<bool> _fusionInFlight{false};
    bool _lastMeshWasAccumulated = false;

    /*
     Bumped by resetAccumulation(). A surface extracted before the reset is already on its way to
     the render thread, carrying the room that was just cleared; the continuation compares the
     generation it read under _volumeMutex against this one and drops the stale result rather than
     putting the old room back.
     */
    std::atomic<uint64_t> _fusionGeneration{0};

    /*
     Cached wireframe for debugDraw(). Rebuilding it means clustering the mesh and de-duplicating
     its edges, which is far too much to redo on every render frame; the mesh only changes at
     updateIntervalMs. _debugEdgeSource is the mesh _debugEdges was built from, compared by pointer.
     */
    std::shared_ptr<VROARDepthMesh> _debugEdgeSource;
    std::vector<std::pair<VROVector3f, VROVector3f>> _debugEdges;

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

    /* Whether this source is one the volume should fuse. */
    bool shouldFuse(VROWorldMeshSource source) const;

    /*
     Hands the frame's samples to the fused volume on a background thread and, when the volume has
     changed, re-meshes it and applies the result on the render thread. Returns true when the frame
     was taken over by fusion, so the caller does not also apply the single-frame mesh.
     */
    bool fuseFrame(std::shared_ptr<VROARDepthMesh> frameMesh,
                   const std::unique_ptr<VROARFrame> &frame);

    /*
     Rebuilds _debugEdges from _currentMesh: simplify with vertex clustering, then collect each
     edge once. Called from debugDraw() when the mesh has changed.
     */
    void rebuildDebugWireframe();

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

};

#endif /* VROARWorldMesh_h */
