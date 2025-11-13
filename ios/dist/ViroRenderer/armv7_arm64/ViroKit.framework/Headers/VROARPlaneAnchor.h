//
//  VROARPlaneAnchor.h
//  ViroRenderer
//
//  Created by Raj Advani on 6/11/17.
//  Copyright © 2017 Viro Media. All rights reserved.
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

#ifndef VROARPlaneAnchor_h
#define VROARPlaneAnchor_h

#include "VROARAnchor.h"
#include "VROVector3f.h"
#include "VROVector2f.h"
#include <chrono>

/*
 OPTIONAL: Enable this flag to use change detection and update throttling.
 By default, all updates from ARCore/ARKit are passed through for maximum precision.
 Enable this only if you need to reduce update frequency for performance reasons.

 WARNING: Enabling this may reduce precision and cause ViroCore to behave differently
 from native ARCore/ARKit applications.
 */
// #define VRO_PLANE_CHANGE_DETECTION_ENABLED

enum class VROARPlaneAlignment {
    Horizontal = 0x1,
    HorizontalUpward = 0x11,
    HorizontalDownward = 0x101,
    Vertical = 0x10,
};

/*
 Classification of detected planes (iOS 12+, ARCore semantic labels).
 Indicates the semantic meaning of a detected plane.
 */
enum class VROARPlaneClassification {
    None,
    Wall,
    Floor,
    Ceiling,
    Table,
    Seat,
    Door,
    Window,
    Unknown
};

/*
 Anchor representing a planar surface.
 */
class VROARPlaneAnchor : public VROARAnchor {

public:

    VROARPlaneAnchor() :
        _lastUpdateTime(std::chrono::steady_clock::now()),
        _updateCount(0),
        _significantChangeCount(0) {}
    virtual ~VROARPlaneAnchor() {}
    
    /*
     The approximate alignment of the detected plane.
     */
    VROARPlaneAlignment getAlignment() const {
        return _alignment;
    }
    void setAlignment(VROARPlaneAlignment alignment) {
        _alignment = alignment;
    }
    
    /*
     The center point of the detected plane. Relative to the parent
     anchor position.
     */
    VROVector3f getCenter() const {
        return _center;
    }
    void setCenter(VROVector3f center) {
        _center = center;
    }
    
    /*
     The width and length of the detected plane.
     */
    VROVector3f getExtent() const {
        return _extent;
    }
    void setExtent(VROVector3f extent) {
        _extent = extent;
    }

    void setBoundaryVertices(std::vector<VROVector3f> points) {
        _boundaryVertices = points;
    }

    std::vector<VROVector3f> getBoundaryVertices() {
        return  _boundaryVertices;
    }

    /*
     Full mesh geometry (iOS 11.3+ only - ARSCNPlaneGeometry equivalent).
     Provides detailed tessellated surface representation beyond just boundary.
     On Android/ARCore, these will be empty as ARCore only provides boundaries.
     */
    void setMeshVertices(std::vector<VROVector3f> vertices) {
        _meshVertices = std::move(vertices);
    }
    std::vector<VROVector3f> getMeshVertices() const {
        return _meshVertices;
    }

    void setTextureCoordinates(std::vector<VROVector2f> uvs) {
        _textureCoordinates = std::move(uvs);
    }
    std::vector<VROVector2f> getTextureCoordinates() const {
        return _textureCoordinates;
    }

    void setTriangleIndices(std::vector<int> indices) {
        _triangleIndices = std::move(indices);
    }
    std::vector<int> getTriangleIndices() const {
        return _triangleIndices;
    }

    /*
     Plane classification (iOS 12+, ARCore semantic labels).
     Indicates what type of surface this plane represents.
     */
    void setClassification(VROARPlaneClassification classification) {
        _classification = classification;
    }
    VROARPlaneClassification getClassification() const {
        return _classification;
    }

    /*
     Change detection and throttling for plane updates.
     */

    // Check if plane properties have changed significantly
    bool hasSignificantChanges(VROVector3f newCenter, VROVector3f newExtent,
                               VROARPlaneAlignment newAlignment,
                               const std::vector<VROVector3f> &newBoundaryVertices) const {
        // Thresholds for detecting significant changes
        static const float EXTENT_THRESHOLD = 0.01f;      // 1cm change in dimensions
        static const float CENTER_THRESHOLD = 0.01f;      // 1cm change in center
        static const float EXTENT_PERCENT_THRESHOLD = 0.05f; // 5% change in size

        // Check alignment change
        if (newAlignment != _alignment) {
            return true;
        }

        // Check extent change (absolute and percentage)
        VROVector3f extentDiff = newExtent - _extent;
        float maxExtentDiff = std::max(std::abs(extentDiff.x), std::abs(extentDiff.z));
        if (maxExtentDiff > EXTENT_THRESHOLD) {
            // Also check percentage change for larger planes
            if (_extent.magnitude() > 0.001f) {
                float percentChange = maxExtentDiff / _extent.magnitude();
                if (percentChange > EXTENT_PERCENT_THRESHOLD) {
                    return true;
                }
            } else {
                // For very small planes, any change is significant
                return true;
            }
        }

        // Check center change
        VROVector3f centerDiff = newCenter - _center;
        if (centerDiff.magnitude() > CENTER_THRESHOLD) {
            return true;
        }

        // Check boundary vertices count change
        if (newBoundaryVertices.size() != _boundaryVertices.size()) {
            return true;
        }

        // Check boundary vertices significant changes (sample-based for performance)
        if (!newBoundaryVertices.empty() && !_boundaryVertices.empty()) {
            // Sample a few vertices instead of checking all for performance
            size_t sampleCount = std::min(size_t(4), newBoundaryVertices.size());
            size_t step = newBoundaryVertices.size() / sampleCount;
            if (step < 1) step = 1;

            for (size_t i = 0; i < newBoundaryVertices.size(); i += step) {
                VROVector3f diff = newBoundaryVertices[i] - _boundaryVertices[i];
                if (diff.magnitude() > CENTER_THRESHOLD) {
                    return true;
                }
            }
        }

        return false;
    }

    // Check if update should be throttled
    bool shouldThrottleUpdate() const {
        // Minimum time between updates (milliseconds)
        static const int MIN_UPDATE_INTERVAL_MS = 100; // 10 updates per second max

        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - _lastUpdateTime).count();

        return elapsed < MIN_UPDATE_INTERVAL_MS;
    }

    // Mark that an update occurred
    void recordUpdate(bool wasSignificant) {
        _lastUpdateTime = std::chrono::steady_clock::now();
        _updateCount++;
        if (wasSignificant) {
            _significantChangeCount++;
        }
    }

    // Get update statistics for diagnostics
    uint32_t getUpdateCount() const { return _updateCount; }
    uint32_t getSignificantChangeCount() const { return _significantChangeCount; }
    float getSignificantChangeRatio() const {
        return _updateCount > 0 ? (float)_significantChangeCount / _updateCount : 0.0f;
    }

    // Get time since last update (milliseconds) - useful for debugging update frequency
    int64_t getTimeSinceLastUpdate() const {
        auto now = std::chrono::steady_clock::now();
        return std::chrono::duration_cast<std::chrono::milliseconds>(now - _lastUpdateTime).count();
    }

private:
    
    /*
     The approximate alignment of the detected plane.
     */
    VROARPlaneAlignment _alignment;
    
    /*
     The center point of the detected plane. Relative to the parent
     anchor position.
     */
    VROVector3f _center;

    /*
     The width and length of the detected plane.
     */
    VROVector3f _extent;

    /*
     A vector of points representing the vertex boundaries of this plane, if any.
     */
    std::vector<VROVector3f> _boundaryVertices;

    /*
     Full mesh geometry (iOS 11.3+ only).
     Detailed tessellated mesh from ARSCNPlaneGeometry.
     Empty on Android as ARCore only provides boundary polygon.
     */
    std::vector<VROVector3f> _meshVertices;
    std::vector<VROVector2f> _textureCoordinates;
    std::vector<int> _triangleIndices;

    /*
     Plane classification (iOS 12+, ARCore semantic labels).
     */
    VROARPlaneClassification _classification = VROARPlaneClassification::None;

    /*
     Update tracking and throttling.
     */
    std::chrono::steady_clock::time_point _lastUpdateTime;
    uint32_t _updateCount;
    uint32_t _significantChangeCount;
};

#endif /* VROARPlaneAnchor_h */
