//
//  VROARScene.h
//  ViroKit
//
//  Created by Andy Chu on 6/13/17.
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

#ifndef VROARScene_h
#define VROARScene_h

#include <vector>
#include <functional>
#include "VROARSession.h"
#include "VROScene.h"
#include "VROAtomic.h"
#include "VROARCamera.h"
#include "VROARWorldMesh.h"

class VROARAnchor;
class VROARDeclarativeSession;
class VROARImperativeSession;
class VROFixedParticleEmitter;
class VROVPSAnchorNode;

class VROARSceneDelegate {
public:
    virtual void onTrackingUpdated(VROARTrackingState state, VROARTrackingStateReason reason) = 0;
    virtual void onAmbientLightUpdate(float ambientLightIntensity, VROVector3f ambientLightColor) = 0;
    virtual void onWorldMeshUpdated(const VROWorldMeshStats& stats) {}

    /*
     Called once when depth data (LiDAR or monocular) first becomes available for the
     session, i.e. hit tests can now return DepthPoints. Optional.
     */
    virtual void onDepthReady() {}
};

class VROARScene : public VROScene {
public:
    VROARScene() :
        _currentTrackingState(VROARTrackingState::Unavailable),
        _currentTrackingStateReason(VROARTrackingStateReason::None),
        _displayPointCloud(false),
        _pointCloudSurfaceScale(VROVector3f(.01, .01, 1)),
        _pointCloudMaxPoints(500) {
            _ambientLightIntensity = 1000;
            _ambientLightColor = { 1.0, 1.0, 1.0 };
            _pointCloudNode = std::make_shared<VRONode>();
            _pointCloudEmitter = nullptr;
            _detectionTypes = { VROAnchorDetection::PlanesHorizontal, VROAnchorDetection::PlanesVertical };
        };
    virtual ~VROARScene();
    
    void initDeclarativeSession();
    void initImperativeSession();
    std::shared_ptr<VROARSessionDelegate> getSessionDelegate();
    
    void setARSession(std::shared_ptr<VROARSession> arSession);
    /*
     Run task once an AR session is attached, or now if one already is. A cloud
     anchor or scan request on a scene's first frame otherwise races the
     session's creation and was dropped. Renderer thread, like setARSession.
     */
    void runWhenARSessionReady(std::function<void(std::shared_ptr<VROARSession>)> task);
    void setDriver(std::shared_ptr<VRODriver> driver);

    /*
     Add AR nodes. These are directly added to the root node.
     */
    void addNode(std::shared_ptr<VRONode> node);

    /*
     The set of anchor detection types we want to enable for this scene.
     */
    void setAnchorDetectionTypes(std::set<VROAnchorDetection> detectionTypes);

    /*
     Set true to display/render the point cloud particles.
     */
    void displayPointCloud(bool display);

    /*
     Update our point cloud particles with the latest positional data received from the last
     ar frame.
     */
    void updatePointCloud();

    /*
     Reset the point cloud surface to the default.
     */
    void resetPointCloudSurface();

    /*
     Set the surface to use for the individual point cloud particles.
     */
    void setPointCloudSurface(std::shared_ptr<VROSurface> surface);

    /*
     Set the scale of the individual point cloud particles.
     */
    void setPointCloudSurfaceScale(VROVector3f scale);

    /*
     Sets the max number of point cloud points to display/render at any one time.
     */
    void setPointCloudMaxPoints(int maxPoints);
    
    void setDelegate(std::shared_ptr<VROARSceneDelegate> delegate);
    void setTrackingState(VROARTrackingState state, VROARTrackingStateReason reason, bool force);

    /*
     Notify the delegate that depth data is now available. Fires the delegate's
     onDepthReady() exactly once per scene; subsequent calls are no-ops.
     */
    void notifyDepthReady();

    /*
     Get the ambient light estimate of the scene.
     */
    float getAmbientLightIntensity() const {
        return _ambientLightIntensity;
    }
    VROVector3f getAmbientLightColor() const {
        return _ambientLightColor;
    }
    
    /*
     Update the ambient light estimate of the scene. Intensity is reported in
     lumens and color is reported in linear space.
     */
    void updateAmbientLight(float intensity, VROVector3f color);
    
    void willAppear();
    void willDisappear();

    std::shared_ptr<VROARSession> getARSession() {
        return _arSession.lock();
    }
    std::shared_ptr<VROARDeclarativeSession> getDeclarativeSession() {
        return _declarativeSession;
    }
    std::shared_ptr<VROARImperativeSession> getImperativeSession() {
        return _imperativeSession;
    }

    void updateParticles(const VRORenderContext &context);

    /*
     World mesh configuration and control.
     */
    void setWorldMeshEnabled(bool enabled);
    bool isWorldMeshEnabled() const;
    void setWorldMeshConfig(const VROWorldMeshConfig& config);

    /* The config in force, so a caller can change one field without restating the rest. */
    const VROWorldMeshConfig &getWorldMeshConfig() const { return _worldMeshConfig; }
    VROWorldMeshStats getWorldMeshStats() const;
    std::shared_ptr<VROARWorldMesh> getWorldMesh() const { return _worldMesh; }

    /*
     Override computePhysics to add world mesh debug drawing.
     */
    void computePhysics(const VRORenderContext &context);

    /*
     Draw the world mesh wireframe for debugging.
     */
    void debugDrawWorldMesh(const VRORenderContext &context);

    /*
     The VPS location's mesh: an RVWM snapshot in the VPS map's frame (ViroScan's
     mesh.rvwm), for occlusion and physics against the real place. Independent of
     the live world mesh: it needs neither setWorldMeshEnabled() nor depth
     hardware, and the live mesh's updates do not replace it.

     It stays hidden and out of the physics world until the session's VPS fuser
     converges (VROARSession::rvGetVPSWorldFromMap()). From then on it follows
     the fuser's map-to-world transform every frame, so each correction moves it
     together with content placed in the map's frame.

     Replaces any mesh set before. Returns false for bytes that are not an RVWM
     snapshot. Callable from any thread; the scene graph and the physics world
     change on the render thread.
     */
    bool setVPSMapMesh(const std::vector<uint8_t> &rvwm, bool occlusion, bool physics);
    void clearVPSMapMesh();

    /*
     Nodes whose children are in the VPS map's frame (VROVPSAnchorNode). Each
     frame they take the same map-to-world transform as the map mesh, and stay
     hidden while the fuser has not converged. Callable from any thread.
     */
    void addVPSAnchorNode(std::shared_ptr<VROVPSAnchorNode> node);
    void removeVPSAnchorNode(std::shared_ptr<VROVPSAnchorNode> node);

    /*
     One camera image for a VPS visual query (finding the location from the
     image when there is no GPS): the luma plane of the latest AR frame,
     sensor-native orientation, scaled so its longest side is at most maxSide,
     with the intrinsics scaled to match. Callable from any thread; the frame
     is copied on the render thread and the callback runs on a background
     thread. ok is false when no frame with intrinsics arrives within about a
     second.

     T_world_cam is the camera's sensor pose for that same frame
     (VROARCamera::getImageTransform(), GL camera axes): a pose solved from
     the image on a server is turned into a VPS fix with it
     (VROARSession::rvReportVPSServerFix()).
     */
    typedef std::function<void(bool ok, std::vector<uint8_t> gray, int width, int height,
                               float fx, float fy, float cx, float cy,
                               const VROMatrix4f &T_world_cam)> VPSQueryFrameCallback;
    void captureVPSQueryFrame(int maxSide, VPSQueryFrameCallback callback);

private:
    
    /*
     The anchors that we should detect in this scene. This is the *ground truth* setting for
     this variable. It is stored here so that it can be pushed into the VROARSession when that
     is injected into the scene.
     */
    std::set<VROAnchorDetection> _detectionTypes;
    
    std::weak_ptr<VROARSession> _arSession;
    std::vector<std::function<void(std::shared_ptr<VROARSession>)>> _sessionReadyTasks;
    std::weak_ptr<VRODriver> _driver;
    std::shared_ptr<VROARDeclarativeSession> _declarativeSession;
    std::shared_ptr<VROARImperativeSession> _imperativeSession;

    std::shared_ptr<VRONode> _pointCloudNode;
    std::shared_ptr<VROFixedParticleEmitter> _pointCloudEmitter;
    std::weak_ptr<VROARSceneDelegate> _delegate;
    bool _depthReadyNotified = false;

    /*
     Ambient light estimation. The intensity is in lumens and the color is in linear space.
     */
    VROAtomic<float> _ambientLightIntensity;
    VROAtomic<VROVector3f> _ambientLightColor;

    /*
     Tracking states that have been read from AR cameras. Usually, this flips between Unavailable
     and Normal as the activity enters paused and resumed states, or between Limited and Normal
     amid changing environmental conditions.
     */
    VROARTrackingState _currentTrackingState;
    VROARTrackingStateReason _currentTrackingStateReason;

    /*
     Point cloud properties.
     */
    bool _displayPointCloud;
    std::shared_ptr<VROSurface> _pointCloudSurface = nullptr;
    VROVector3f _pointCloudSurfaceScale;
    int _pointCloudMaxPoints;

    /*
     Creates an instance of VROFixedParticleEmitter representing the point cloud, if possible.
     */
    void initPointCloudEmitter();

    /*
     World mesh for depth-based physics collision.
     */
    std::shared_ptr<VROARWorldMesh> _worldMesh;
    VROWorldMeshConfig _worldMeshConfig;
    bool _worldMeshEnabled = false;

    /*
     Updates the world mesh from the current AR frame.
     */
    void updateWorldMesh();

    /*
     VPS map mesh (see setVPSMapMesh()). Render thread only. The physics body is
     kinematic: its motion state takes the map-to-world transform each frame.
     */
    std::shared_ptr<VRONode> _vpsMapMeshNode;
    std::shared_ptr<VROPhysicsShape> _vpsMapMeshShape;
    std::shared_ptr<btDefaultMotionState> _vpsMapMeshMotion;
    std::shared_ptr<btRigidBody> _vpsMapMeshBody;
    bool _vpsMapMeshInWorld = false;
    // Bumped by every set/clear, so a physics shape still building in the
    // background for a replaced mesh is dropped when it lands.
    uint64_t _vpsMapMeshGen = 0;
    // Collisions with it report the live world mesh's default tag, so apps
    // handle both the same way. Owned here; the rigid body points at it.
    std::string _vpsMapMeshTag = VROWorldMeshConfig().collisionTag;

    // Registered VPS anchor nodes. Render thread only.
    std::vector<std::weak_ptr<VROVPSAnchorNode>> _vpsAnchorNodes;

    // Pending captureVPSQueryFrame() requests. Render thread only.
    struct VPSQueryFrameRequest {
        int maxSide;
        int framesLeft;
        VPSQueryFrameCallback callback;
    };
    std::vector<VPSQueryFrameRequest> _vpsQueryFrameRequests;
    void serviceVPSQueryFrameRequests();

    void installVPSMapMesh(std::shared_ptr<VROARDepthMesh> mesh, bool occlusion, bool physics);
    void clearVPSMapMeshNow();
    void updateVPSPlacement();
    void updateVPSMapMesh(bool placed, const VROMatrix4f &T_world_map);
    void updateVPSAnchorNodes(bool placed, const VROMatrix4f &T_world_map);
};

#endif /* VROARScene_h */
