//
//  VRODynamicMeshNode.h
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

#ifndef VRODynamicMeshNode_h
#define VRODynamicMeshNode_h

#include <memory>
#include <vector>
#include "VRONode.h"
#include "VRODynamicGeometry.h"
#include "VROVector3f.h"
#include "VROVector2f.h"
#include "VROVector4f.h"

class VRODriver;

/*
 A VRONode that owns a VRODynamicGeometry and exposes a high-level typed
 setBuffers() API, matching the output of simulation adapters (e.g. libsm64).

 Typical use:

     auto node = std::make_shared<VRODynamicMeshNode>();
     scene->getRootNode()->addChildNode(node);
     node->init(driver, maxVertices, VRODynamicGeometryFeatures::All);

     // each frame, from a VROFrameListener:
     node->setBuffers(positions, normals, uvs, colors, vertexCount);

 init() must be called once with a valid driver (e.g. from sceneWillAppear)
 before the first setBuffers() call. vertexCount = triangleCount * 3.

 scratch buffers for float packing are owned by the node and reused every
 frame to avoid per-frame heap allocation.
 */
class VRODynamicMeshNode : public VRONode {
public:
    VRODynamicMeshNode() = default;
    ~VRODynamicMeshNode() override = default;

    /*
     Allocate the underlying VRODynamicGeometry sized to hold up to maxVertices.
     Must be called once from the render thread (e.g. sceneWillAppear) before
     any setBuffers() call.
     */
    void init(std::shared_ptr<VRODriver> driver,
              int maxVertices,
              VRODynamicGeometryFeatures features = VRODynamicGeometryFeatures::All);

    /*
     Replace the mesh data for the current frame. vertexCount = triangleCount * 3.
     colors components must be in [0, 1]; they are converted to uint8 RGBA internally.
     Safe to call from the render thread at frame rate.
     */
    void setBuffers(const std::vector<VROVector3f> &positions,
                    const std::vector<VROVector3f> &normals,
                    const std::vector<VROVector2f> &uvs,
                    const std::vector<VROVector4f> &colors,
                    int vertexCount);

    std::shared_ptr<VRODynamicGeometry> getDynamicGeometry() const { return _dynGeom; }

private:
    std::shared_ptr<VRODynamicGeometry> _dynGeom;

    // Scratch buffers reused every frame to avoid heap churn
    std::vector<float>    _scratchPos;
    std::vector<float>    _scratchNorm;
    std::vector<float>    _scratchUV;
    std::vector<uint8_t>  _scratchColor;
};

#endif /* VRODynamicMeshNode_h */
