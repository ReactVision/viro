//
//  VRODynamicGeometry.h
//  ViroKit
//
//  Copyright © 2026 ReactVision. All rights reserved.
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

#ifndef VRODynamicGeometry_h
#define VRODynamicGeometry_h

#include <memory>
#include <stdint.h>
#include "VROGeometry.h"

class VROVertexBuffer;
class VRODriver;

/*
 A geometry whose vertex buffers can be replaced in place every frame without
 recreating the geometry, its sources/elements, or its underlying GPU substrate.

 Use this when the data driving the mesh changes at render-loop frequency:
   - Procedural mesh (marching cubes, voxels)
   - External engines that emit vertex soup per tick (libsm64, soft-body sims)
   - CPU skinning of formats ViroCore doesn't parse natively
   - Visualisations of changing scientific data

 The first iteration supports unindexed triangle soup only. The vertex buffers
 are allocated once at construction with the supplied capacity. Subsequent
 calls to setBuffers() that stay within capacity reuse the GPU buffers without
 reallocation. Exceeding the capacity triggers a one-time reallocation and a
 warning; size the initial capacity to the upper bound your producer will emit.

 Attribute availability is declared at construction. Buffers passed to
 setBuffers() for absent attributes must be null; mismatches are logged.

 Typical use:

     auto geom = std::make_shared<VRODynamicGeometry>(
         driver,
         maxVertices,                       // upper bound the producer will emit
         VRODynamicGeometryFeatures::All    // positions + normals + uvs + colours
     );
     someNode->setGeometry(geom);
     someNode->getGeometry()->setMaterials({myMaterial});

     // each frame:
     geom->setBuffers(positions, normals, uvs, colours, triangleCount);
 */

enum class VRODynamicGeometryFeatures : uint32_t {
    None       = 0,
    Positions  = 1 << 0,   // always implicitly required
    Normals    = 1 << 1,
    UVs        = 1 << 2,
    Colors     = 1 << 3,
    PosNorm    = Positions | Normals,
    PosNormUV  = Positions | Normals | UVs,
    All        = Positions | Normals | UVs | Colors,
};

inline VRODynamicGeometryFeatures operator|(VRODynamicGeometryFeatures a,
                                            VRODynamicGeometryFeatures b) {
    return static_cast<VRODynamicGeometryFeatures>(
        static_cast<uint32_t>(a) | static_cast<uint32_t>(b));
}
inline bool hasFeature(VRODynamicGeometryFeatures set,
                       VRODynamicGeometryFeatures probe) {
    return (static_cast<uint32_t>(set) & static_cast<uint32_t>(probe)) != 0;
}

class VRODynamicGeometry : public VROGeometry {

public:

    /*
     Construct a dynamic geometry sized to hold up to maxVertices and configured
     for the given attribute set. Allocates and hydrates one VBO per declared
     attribute up front. Positions are always allocated.
     */
    VRODynamicGeometry(std::shared_ptr<VRODriver> driver,
                       int maxVertices,
                       VRODynamicGeometryFeatures features =
                           VRODynamicGeometryFeatures::PosNormUV);

    virtual ~VRODynamicGeometry();

    /*
     Replace the geometry's vertex data and triangle count.

     - positions: required, vertexCount * 3 floats
     - normals:   required iff Normals feature was declared at construction,
                  else must be null
     - uvs:       required iff UVs feature was declared, vertexCount * 2 floats
     - colors:    required iff Colors feature was declared, vertexCount * 4
                  RGBA8 bytes (0..255)
     - triangleCount: number of triangles to draw; vertexCount = triangleCount * 3

     vertexCount may not exceed maxVertices declared at construction without
     triggering a one-time VBO reallocation (logged warning).

     Safe to call from the render thread. Thread-safety with any other thread
     calling setBuffers concurrently is the caller's responsibility.
     */
    void setBuffers(const float    *positions,
                    const float    *normals,
                    const float    *uvs,
                    const uint8_t  *colors,
                    int             triangleCount);

    /*
     Maximum vertex capacity declared at construction (or grown by a previous
     overflowing setBuffers call).
     */
    int getMaxVertices() const { return _maxVertices; }

    /*
     Features (attributes) this dynamic geometry was constructed with.
     */
    VRODynamicGeometryFeatures getFeatures() const { return _features; }

private:

    std::weak_ptr<VRODriver> _driver;
    VRODynamicGeometryFeatures _features;
    int _maxVertices;
    int _currentTriangleCount;

    std::shared_ptr<VROVertexBuffer> _positionBuffer;
    std::shared_ptr<VROVertexBuffer> _normalBuffer;
    std::shared_ptr<VROVertexBuffer> _uvBuffer;
    std::shared_ptr<VROVertexBuffer> _colorBuffer;

    std::shared_ptr<VROGeometryElement> _triangleSoupElement;

    /*
     Allocate the per-attribute VBOs and wire up the parent VROGeometry's
     sources/elements once. Called from the constructor.
     */
    void initBuffers();

    /*
     Helper: replace a VertexBuffer's data and forward to its updateData hook.
     */
    void updateBuffer(const std::shared_ptr<VROVertexBuffer> &buffer,
                      const void *data,
                      size_t byteSize);

    /*
     Like updateBuffer but pads the VROData to totalBytes with zeros so
     VROGeometrySource's declared vertexCount stays consistent with the buffer
     capacity (avoids VROByteBuffer over-read during bounding-box computation).
     */
    void updateBufferPadded(const std::shared_ptr<VROVertexBuffer> &buffer,
                            const void *activeData, size_t activeBytes,
                            size_t totalBytes);

};

#endif /* VRODynamicGeometry_h */
