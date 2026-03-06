//
//  VROARFrame.h
//  ViroKit
//
//  Created by Raj Advani on 6/6/17.
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

#ifndef VROARFrame_h
#define VROARFrame_h

#include "VROARPointCloud.h"
#include "VROMatrix4f.h"
#include "VROSemantics.h"

#include <memory>
#include <vector>
#include <set>
#include "VROVector3f.h"

class VROARCamera;
class VROARAnchor;
class VROARHitTestResult;
class VROARDepthMesh;
class VROTexture;
enum class VROARHitTestResultType;
enum class VROCameraOrientation;

/*
 The continual output of a VROARSession. These frames contain the current camera
 video image, camera parameters, and updated anchors.
 */
class VROARFrame {
public:
    
    VROARFrame() {}
    virtual ~VROARFrame() {}
    
    /*
     Get the timestamp, in seconds.
     */
    virtual double getTimestamp() const = 0;
    
    /*
     Contains information about the camera position, orientation, and imaging
     parameters for this frame.
     */
    virtual const std::shared_ptr<VROARCamera> &getCamera() const = 0;
    
    /*
     Get the orientation of this frame.
     */
    virtual VROCameraOrientation getOrientation() const = 0;
    
    /*
     Perform a hit test on the given point in the viewport. The coordinate 
     system is viewport pixels (e.g. the coordinate system in which
     VROViewport is defined).
     */
    virtual std::vector<std::shared_ptr<VROARHitTestResult>> hitTest(int x, int y, std::set<VROARHitTestResultType> types) = 0;

    /*
     Perform a hit test along the ray from origin to destination, in world coordinates
     */
    virtual std::vector<std::shared_ptr<VROARHitTestResult>> hitTestRay(VROVector3f *origin,
                                                                     VROVector3f *destination ,
                                                                     std::set<VROARHitTestResultType> types) = 0;
    /*
     Returns the affine transform to move from viewport space to camera
     image space. Camera image space is the texture coordinate space of
     the camera's image, ranging from (0,0) at the upper left to (1,1) on
     the lower right. Viewport space is the coordinate space of the current
     viewport, taking into account the current orientation.
     
     To render the camera image, either this transform should be applied to
     the camera background's texture coordinates, or the *inverse* of this
     transform should be applied to the camera background's vertices.
     This ensures the camera image maps correctly to the current viewport and
     orientation.
     */
    virtual VROMatrix4f getViewportToCameraImageTransform() const = 0;
    
    /*
     Return the estimated intensity of ambient light in the physical scene.
     */
    virtual float getAmbientLightIntensity() const = 0;

    /*
     Return the estimated color of ambient light in the physical scene, in linear RGB space.
     */
    virtual VROVector3f getAmbientLightColor() const = 0;

    /*
     Get all the anchors representing tracked positions and objects in the
     scene.
     */
    virtual const std::vector<std::shared_ptr<VROARAnchor>> &getAnchors() const = 0;

    /*
     Retrieves the point cloud from this frame.
     */
    virtual std::shared_ptr<VROARPointCloud> getPointCloud() = 0;

    /*
     Returns a tightly-packed (stride == width), row-major Y (luma) plane of the
     camera image.  width and height are set to the plane dimensions.
     The pointer is valid for the lifetime of this frame object; caller must NOT free it.
     Returns false if the luma plane is unavailable (platform unsupported, frame not ready).
     */
    virtual bool getCameraImageY(const uint8_t** data, int* width, int* height) {
        (void)data; (void)width; (void)height;
        return false;
    }

    /*
     Get the depth texture for this frame, if available.
     Returns nullptr if depth is not supported or not enabled.
     The texture contains depth values in meters as 16-bit unsigned integers
     (millimeters on ARCore, meters on ARKit).
     */
    virtual std::shared_ptr<VROTexture> getDepthTexture() { return nullptr; }

    /*
     Get the confidence texture for depth values, if available.
     Returns nullptr if not supported. Values range from 0-255 where
     higher values indicate higher confidence.
     */
    virtual std::shared_ptr<VROTexture> getDepthConfidenceTexture() { return nullptr; }

    /*
     Check if depth data is available for this frame.
     */
    virtual bool hasDepthData() const { return false; }

    /*
     Get the width of the depth image in pixels.
     */
    virtual int getDepthImageWidth() const { return 0; }

    /*
     Get the height of the depth image in pixels.
     */
    virtual int getDepthImageHeight() const { return 0; }

    /**
     * Generate a triangulated mesh from depth data for physics collision.
     * The mesh vertices are in world space coordinates.
     *
     * @param stride Sample every Nth pixel (1=full resolution, 4=recommended for performance)
     * @param minConfidence Skip pixels with confidence below this threshold (0.0-1.0)
     * @param maxDepth Skip pixels with depth beyond this distance in meters
     * @return Shared pointer to depth mesh, or nullptr if depth data is unavailable
     */
    virtual std::shared_ptr<VROARDepthMesh> generateDepthMesh(
        int stride = 4,
        float minConfidence = 0.3f,
        float maxDepth = 5.0f) {
        return nullptr;
    }

    /*
     Returns the transform matrix to convert from camera texture coordinates
     to depth texture coordinates. The depth map may have a different
     orientation/resolution than the camera image, so this transform is needed
     to correctly sample the depth texture.

     By default returns identity (assumes depth texture UVs match camera UVs).
     */
    virtual VROMatrix4f getDepthTextureTransform() const {
        return VROMatrix4f::identity();
    }

    // ========================================================================
    // Scene Semantics API
    // ========================================================================

    /*
     * Check if semantic data is available for this frame.
     * Returns true if semantic segmentation data can be retrieved.
     */
    virtual bool hasSemanticData() const { return false; }

    /*
     * Get the semantic image for this frame.
     * Each pixel contains a label ID (0-11) corresponding to VROSemanticLabel.
     * Returns an empty/invalid image if semantics is not enabled or data not yet available.
     */
    virtual VROSemanticImage getSemanticImage() { return VROSemanticImage(); }

    /*
     * Get the semantic confidence image for this frame.
     * Each pixel contains a confidence value (0-255) for the semantic label.
     * Higher values indicate higher confidence in the classification.
     * Returns an empty/invalid image if not available.
     */
    virtual VROSemanticConfidenceImage getSemanticConfidenceImage() {
        return VROSemanticConfidenceImage();
    }

    /*
     * Get the fraction of pixels with the specified semantic label.
     * Returns a value in [0.0, 1.0] representing the percentage of pixels
     * classified with the given label, or 0.0 if not available.
     */
    virtual float getSemanticLabelFraction(VROSemanticLabel label) { return 0.0f; }

    /*
     * Get fractions for all semantic labels in the current frame.
     * Returns a map of label to fraction (0.0-1.0).
     */
    virtual VROSemanticFractions getSemanticFractions() {
        VROSemanticFractions fractions;
        for (int i = 0; i < VRO_SEMANTIC_LABEL_COUNT; i++) {
            VROSemanticLabel label = static_cast<VROSemanticLabel>(i);
            fractions[label] = getSemanticLabelFraction(label);
        }
        return fractions;
    }

    /*
     * Get the width of the semantic image in pixels.
     */
    virtual int getSemanticImageWidth() const { return 0; }

    /*
     * Get the height of the semantic image in pixels.
     */
    virtual int getSemanticImageHeight() const { return 0; }
};

#endif /* VROARFrame_h */
