//
//  VROARFrameiOS.h
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

#ifndef VROARFrameiOS_h
#define VROARFrameiOS_h

#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 110000
#include "VROARFrame.h"
#include "VROViewport.h"
#include "VROARDepthMesh.h"
#include <ARKit/ARKit.h>

class VROARSessioniOS;

class API_AVAILABLE(ios(12.0)) VROARFrameiOS : public VROARFrame {
public:
    
    VROARFrameiOS(ARFrame *frame, VROViewport viewport, VROCameraOrientation orientation,
                  std::shared_ptr<VROARSessioniOS> session);
    virtual ~VROARFrameiOS();
    
    CVPixelBufferRef getImage() const;
    CGImagePropertyOrientation getImageOrientation() const;

    /*
     Returns the underlying ARKit ARFrame.
     */
    ARFrame *getARFrame() const { return _frame; }

    double getTimestamp() const;
    VROCameraOrientation getOrientation() const { return _orientation; }
    
    const std::shared_ptr<VROARCamera> &getCamera() const;
    std::vector<std::shared_ptr<VROARHitTestResult>> hitTest(int x, int y, std::set<VROARHitTestResultType> types);
    std::vector<std::shared_ptr<VROARHitTestResult>> hitTestRay(VROVector3f *origin,
                                                                VROVector3f *destination ,
                                                                std::set<VROARHitTestResultType> types) {
      // no-op
      std::vector<std::shared_ptr<VROARHitTestResult>> emptyResults;
      return emptyResults;
    }
    
    VROMatrix4f getViewportToCameraImageTransform() const;
    const std::vector<std::shared_ptr<VROARAnchor>> &getAnchors() const;
    
    float getAmbientLightIntensity() const;
    VROVector3f getAmbientLightColor() const;

    std::shared_ptr<VROARPointCloud> getPointCloud();

    // Depth data support (iOS 14.0+ with LiDAR)
    std::shared_ptr<VROTexture> getDepthTexture() override;
    std::shared_ptr<VROTexture> getDepthConfidenceTexture() override;
    bool hasDepthData() const override;
    int getDepthImageWidth() const override;
    int getDepthImageHeight() const override;

    /*
     Returns true if native LiDAR depth is available from ARKit.
     This is distinct from hasDepthData() which may return true
     for monocular depth estimation when LiDAR is not available.
     */
    bool hasLiDARDepth() const;

    /*
     Returns the transform matrix to convert from camera texture coordinates
     to depth texture coordinates. The depth map from ARKit may have a different
     orientation/resolution than the camera image, so this transform is needed
     to correctly sample the depth texture.
     */
    VROMatrix4f getDepthTextureTransform() const;

    // Scene Semantics support (requires ARCore SDK with Semantics extension)
    float getSemanticLabelFraction(VROSemanticLabel label) override;

    // Depth mesh generation for physics collision
    std::shared_ptr<VROARDepthMesh> generateDepthMesh(
        int stride = 4,
        float minConfidence = 0.3f,
        float maxDepth = 5.0f) override;

private:

    ARFrame *_frame;
    VROViewport _viewport;
    VROCameraOrientation _orientation;
    std::weak_ptr<VROARSessioniOS> _session;
    std::shared_ptr<VROARCamera> _camera;
    std::vector<std::shared_ptr<VROARAnchor>> _anchors;
    std::shared_ptr<VROARPointCloud> _pointCloud;

    // Cached depth textures (mutable to allow lazy initialization in const methods)
    mutable std::shared_ptr<VROTexture> _depthTexture;
    mutable std::shared_ptr<VROTexture> _depthConfidenceTexture;

    /*
     Sample depth texture at normalized UV coordinates (0-1 range).
     Returns depth value in meters, or 0.0 if invalid.
     */
    float sampleDepthTextureAtUV(std::shared_ptr<VROTexture> texture, float u, float v) const;

};

#endif
#endif /* VROARFrameiOS_h */
