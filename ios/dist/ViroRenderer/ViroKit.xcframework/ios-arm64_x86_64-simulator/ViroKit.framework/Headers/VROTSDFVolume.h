//
//  VROTSDFVolume.h
//  ViroRenderer
//
//  Copyright © 2026 ReactVision. All rights reserved.
//

#ifndef VROTSDFVolume_h
#define VROTSDFVolume_h

#include <cstdint>
#include <memory>
#include <map>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "VROVector3f.h"

/*
 A sparse truncated signed distance field, for fusing depth frames into a surface that persists
 across them.

 ARKit's scene reconstruction does this on LiDAR devices and hands back ARMeshAnchors, which is why
 the world mesh accumulates there and nowhere else. ARCore has no equivalent — it gives a depth
 image per frame and nothing more — so on Android, and on iPhones without LiDAR, the fusion has to
 live here. Without it the mesh, and the VPS Lite snapshot taken from it, is whatever the camera
 last pointed at.

 Storage is a hash of 8³ blocks, so only the space near observed surfaces costs anything: a voxel
 is 8 bytes, a block 4 KB. Blocks past the budget are evicted least-recently-seen first.

 Averaging is the point, not just persistence. A single ARCore depth frame is noisy; a voxel that
 several frames agree on converges on the real surface, which matters most for monocular depth.
 */
class VROTSDFVolume {
public:
    /*
     voxelSize        edge of a voxel, in meters.
     truncation       how far from a surface a voxel still records a distance. Below about three
                      voxels the surface tears between frames; much above it, thin structure fills
                      in. Three voxels is the usual choice.
     maxBlocks        eviction threshold. 4 KB each, so 16384 blocks is 64 MB of voxels.
     */
    VROTSDFVolume(float voxelSize, float truncation, size_t maxBlocks);

    /*
     Fuses one frame. `points` are surface samples in world space and `cameraPosition` is where they
     were seen from, which is what gives each update its sign: a voxel between the camera and a
     sample is in front of the surface, one past it is behind.

     `confidences` weights each sample and may be empty, in which case every sample counts as 1.
     Call only while tracking is normal — integrating across a relocalisation smears the volume.
     */
    void integrate(const std::vector<VROVector3f> &points,
                   const std::vector<float> &confidences,
                   const VROVector3f &cameraPosition);

    /*
     Extracts the zero crossing as a triangle mesh in world space.

     Surface nets rather than marching cubes: one vertex per cell that straddles the surface, placed
     at the average of its edge crossings, then quads across each sign-changing edge. It needs no
     256-entry case table, which is a table that cannot be checked by reading it — one wrong row
     leaves holes that only show on a device.
     */
    void extractSurface(std::vector<VROVector3f> *outVertices,
                        std::vector<float> *outConfidences,
                        std::vector<int> *outIndices) const;

    /* Drops every block. For starting a new scan without carrying the old room into it. */
    void reset();

    bool isEmpty() const { return _blocks.empty(); }
    size_t getBlockCount() const { return _blocks.size(); }
    size_t getApproximateBytes() const { return _blocks.size() * getBytesPerBlock(); }

    /*
     What one block actually costs in memory: its voxels, its eviction timestamp, and the hash node
     and bucket slot that hold it. A caller turning a memory budget into a block count has to use
     this rather than multiplying out the voxels, or the budget is spent before it is reached —
     Block is padded past the voxel array and the map node is not free. Defined where Block is.
     */
    static size_t getBytesPerBlock();

    /* True when integrate() has changed anything since the last call to this. Lets a caller re-mesh
       only when there is something new to mesh. */
    bool consumeDirty() { bool d = _dirty; _dirty = false; return d; }

    /* Cells whose surface was recomputed by the last extractSurface(). Diagnostics: a walk that
       keeps re-meshing the whole room is a dirty-tracking bug, not a slow mesher. */
    size_t getLastRemeshedCellCount() const { return _lastRemeshedCells; }

    static constexpr int kBlockSize = 8;

private:
    struct Voxel {
        float sdf = 0.0f;
        float weight = 0.0f;
    };

    struct Block {
        Voxel voxels[kBlockSize * kBlockSize * kBlockSize];
        uint64_t lastTouched = 0;
    };

    /* Block coordinates packed into a key. 21 bits per axis is ±1 million blocks, far past any
       room, and keeps the hash a single integer. */
    static uint64_t blockKey(int bx, int by, int bz);

    Voxel *voxelAt(int gx, int gy, int gz, bool create);
    const Voxel *voxelAt(int gx, int gy, int gz) const;

    /* Drops the least recently touched blocks until the count is within budget. */
    void evictIfNeeded();

    /*
     One surface vertex, cached per cell.

     Placing a vertex costs eight voxel lookups and up to twelve edge interpolations, and a walk
     changes a handful of blocks per frame while leaving the rest of the room alone. Re-deriving
     every cell each time was the bulk of a 41 ms extraction on a 4x5 m room; cells outside the
     blocks that moved are reused as they stand.
     */
    struct CellVertex {
        VROVector3f position;
        float confidence = 0.0f;
    };

    /* Recomputes the cells that the given block can reach, into _cells. */
    void remeshBlock(int bx, int by, int bz);

    /* Packs a cell's coordinates the way blockKey packs a block's. An ordered map keyed by a
       tuple spent more time in comparisons and node allocation than the meshing itself. */
    static uint64_t cellKey(int gx, int gy, int gz) { return blockKey(gx, gy, gz); }
    static void unpackCell(uint64_t key, int *gx, int *gy, int *gz);

    std::unordered_map<uint64_t, CellVertex> _cells;
    std::unordered_set<uint64_t> _dirtyBlocks;
    mutable size_t _lastRemeshedCells = 0;

    float _voxelSize;
    float _truncation;
    size_t _maxBlocks;
    uint64_t _frameCounter = 0;
    bool _dirty = false;

    std::unordered_map<uint64_t, std::unique_ptr<Block>> _blocks;
};

#endif /* VROTSDFVolume_h */
