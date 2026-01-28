//
//  VROARHitTestResult.h
//  ViroRenderer
//
//  Created by Raj Advani on 6/12/17.
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

#ifndef VROARHitTestResult_h
#define VROARHitTestResult_h

#include <stdio.h>
#include "VROARAnchor.h"

/*
 Types of hit test results:

 ExistingPlaneUsingExtent: Hit test found a plane for which we have an anchor,
                           and the hit location was within the plane's estimated
                           extent.
 ExistingPlane: Hit test found a plane for which we have an anchor, but our hit
                test did not take into account the estimated extent. The hit point
                may be outside the actual extent of the surface.
 EstimatedHorizontalPlane: Hit test found a plane, but one for which we have no
                           anchor.
 FeaturePoint: Hit test found a point that the AR session believes is part of a
                continuous surface. This surface may not be horizontal.
 DepthPoint: Hit test found a point using depth data. The orientation is perpendicular
             to the 3D surface at the hit location. Requires depth mode to be enabled.
 */
enum class VROARHitTestResultType {
    ExistingPlaneUsingExtent,
    ExistingPlane,
    EstimatedHorizontalPlane,
    FeaturePoint,
    DepthPoint,
};

/*
 Return value of AR hit tests. AR hit tests determine anchors or 
 less defined features the user hits in the camera view.
 */
class VROARHitTestResult {
public:

    VROARHitTestResult(VROARHitTestResultType type, std::shared_ptr<VROARAnchor> anchor, float distance,
                       VROMatrix4f worldTransform, VROMatrix4f localTransform) :
        _type(type), _anchor(anchor), _distance(distance), _worldTransform(worldTransform), _localTransform(localTransform),
        _hasDepthData(false), _depthValue(0.0f), _depthConfidence(-1.0f), _depthSource("none") {
    }
    virtual ~VROARHitTestResult() {}

    /*
     Get the type of hit test result.
     */
    VROARHitTestResultType getType() const { return _type; }

    /*
     Return the anchor associated with the hit test, if any.
     */
    const std::shared_ptr<VROARAnchor> getAnchor() const { return _anchor.lock(); }

    /*
     Get the distance from the camera to the hit test result.
     */
    float getDistance() const { return _distance; }

    /*
     Get the position and orientation of the hit test result surface, in world coordinates.
     */
    VROMatrix4f getWorldTransform() const { return _worldTransform; }

    /*
     Get the position and orientation of the hit test result surface, in the coordinate
     space of the anchor. Undefined if there is no anchor associated with this result.
     */
    VROMatrix4f getLocalTransform() const { return _localTransform; }

    /*
     Returns true if depth data is available for this hit test result.
     */
    bool hasDepthData() const { return _hasDepthData; }

    /*
     Get the depth value at the hit point in meters. Only valid if hasDepthData() returns true.
     */
    float getDepthValue() const { return _depthValue; }

    /*
     Get the depth confidence value (0-1). Returns -1 if confidence data is not available.
     Only valid if hasDepthData() returns true. iOS LiDAR provides confidence, ARCore may not.
     */
    float getDepthConfidence() const { return _depthConfidence; }

    /*
     Get the source of depth data: "lidar", "monocular", "arcore", or "none".
     */
    std::string getDepthSource() const { return _depthSource; }

    /*
     Set depth data for this hit test result.
     */
    void setDepthData(float depthValue, float depthConfidence, std::string depthSource) {
        _hasDepthData = true;
        _depthValue = depthValue;
        _depthConfidence = depthConfidence;
        _depthSource = depthSource;
    }

    /*
     Set the type of hit test result. Used to upgrade results to DepthPoint when depth data is available.
     */
    void setType(VROARHitTestResultType type) {
        _type = type;
    }

protected:

    std::weak_ptr<VROARAnchor> _anchor;

private:

    VROARHitTestResultType _type;
    float _distance;
    VROMatrix4f _worldTransform;
    VROMatrix4f _localTransform;

    // Depth-related fields
    bool _hasDepthData;
    float _depthValue;
    float _depthConfidence;
    std::string _depthSource;

};

#endif /* VROARHitTestResult_h */
