//
//  VROARSession.h
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

#ifndef VROARSession_h
#define VROARSession_h

#include <memory>
#include <set>
#include "VROLog.h"
#include "VROMatrix4f.h"
#include "VROARImageDatabase.h"
#include "VROGeospatial.h"
#include "VROSemantics.h"

class VROARAnchor;
class VROGeospatialAnchor;
class VROARFrame;
class VROTexture;
class VROViewport;
class VROScene;
class VROARNode;
class VRONode;
class VROARSessionDelegate;
class VROARImageTarget;
class VROARObjectTarget;
class VROVisionModel;
enum class VROCameraOrientation; //defined in VROCameraTexture.h

/*
 Determines if the AR session tracks nothinng, tracks orientation only, or
 tracks both orientation and position.
 */
enum class VROTrackingType {
    PrerecordedVideo,   // Tracks nothing, uses pre-recorded video as camera
    Front,              // Tracks orientation, using front-facing camera
    DOF3,               // Tracks orientation, using back-facing camera
    DOF6                // Tracks orientation and position, using back-facing camera
};

/*
 The types of objects the AR session should scan each frame 
 to detect. A VROARAnchor is created for each detected object.
 */
enum class VROAnchorDetection {
    PlanesHorizontal,
    PlanesVertical
};

/*
 The world alignment chosen at the start of the AR Session.
 */
enum class VROWorldAlignment {
    Gravity,
    GravityAndHeading,
    Camera
};

/*
 The video quality that the ARSession should *attempt* to use.
 */
enum class VROVideoQuality {
    Low,
    High
};

/*
 The implementation of image tracking to use.
 */
enum class VROImageTrackingImpl {
    ARCore,
    ARKit,
};

enum class VROCloudAnchorProvider {
    None,
    ARCore,
    ReactVision,  // ReactVision custom backend (ReactVisionCCA)
};

enum class VROGeospatialAnchorProvider {
    None,
    ARCoreGeospatial,
    ReactVision,  // ReactVision custom backend (RVCCAGeospatialProvider)
};

/*
 The occlusion mode determines how virtual content is occluded
 by real-world objects.
 */
enum class VROOcclusionMode {
    Disabled,       // No occlusion - virtual objects always render on top
    DepthBased,     // Use depth data to occlude virtual objects behind real-world surfaces
    PeopleOnly,     // Only occlude virtual objects behind detected people (iOS 13+/Android with ARCore)
    DepthOnly       // Activates depth sensing WITHOUT occlusion rendering (depth data available, no visual occlusion)
};

/*
 Manages the device camera and motion tracking for AR.
 */
class VROARSession {
public:
    
    VROARSession(VROTrackingType trackingType, VROWorldAlignment worldAlignment) :
        _trackingType(trackingType),
        _worldAlignment(worldAlignment) {
#if VRO_PLATFORM_IOS
        _imageTrackingImpl = VROImageTrackingImpl::ARKit;
#elif VRO_PLATFORM_ANDROID
        _imageTrackingImpl = VROImageTrackingImpl::ARCore;
#endif
    }
    virtual ~VROARSession() {}
    
    VROTrackingType getTrackingType() const {
        return _trackingType;
    }
    
    /*
     Change the tracking type used by the AR session. Note this may
     restart the AR session, causing all objects to lose tracking.
     */
    virtual void setTrackingType(VROTrackingType trackingType) = 0;

    VROWorldAlignment getWorldAlignment() const {
        return _worldAlignment;
    }
    
    VROImageTrackingImpl getImageTrackingImpl() const {
        return _imageTrackingImpl;
    }
    
    /*
     The scene associated with this session.
     */
    const std::shared_ptr<VROScene> getScene() const {
        return _scene;
    }
    virtual void setScene(std::shared_ptr<VROScene> scene) {
        _scene = scene;
    }
    
    /*
     The delegate set by the application to respond to events from the
     AR session.
     */
    std::shared_ptr<VROARSessionDelegate> getDelegate() {
        return _delegate.lock();
    }
    virtual void setDelegate(std::shared_ptr<VROARSessionDelegate> delegate) {
        _delegate = delegate;
    }
    
    /*
     Start the session. The session cannot be started until its
     scene, viewport, and orientation have been set.
     */
    virtual void run() = 0;
    
    /*
     Pause the session. No new frames will be created.
     */
    virtual void pause() = 0;

    /*
     Resets the VROARSession depending on the given boolean flags. If no flags
     are set to true, then nothing will happen.
     */
    virtual void resetSession(bool resetTracking, bool removeAnchors) = 0;

    /*
     Returns true if at least one frame has been generated.
     */
    virtual bool isReady() const = 0;
    
    /*
     Set what anchors will be auto-detected by the AR session. Returns true if successful (e.g.
     if the device supports these forms of anchor detection).
     */
    virtual bool setAnchorDetection(std::set<VROAnchorDetection> types) = 0;

    /*
     Set the provider to use for hosting and resolving cloud anchors.
     */
    virtual void setCloudAnchorProvider(VROCloudAnchorProvider provider) = 0;

    /*
     Set the provider to use for geospatial anchors.
     */
    virtual void setGeospatialAnchorProvider(VROGeospatialAnchorProvider provider) {
        _geospatialAnchorProvider = provider;
    }

    VROGeospatialAnchorProvider getGeospatialAnchorProvider() const {
        return _geospatialAnchorProvider;
    }

    /*
     * Set camera's ArFocusMode as AUTO_FOCUS if enabled is true, else set to FIXED_FOCUS
     */
    virtual void setAutofocus(bool enabled) = 0;

    /*
     * Return true if camera's ArFocusMode is set to AUTO_FOCUS;
     */
    virtual bool isCameraAutoFocusEnabled() = 0;

    /*
     Set a number > 0 to enable continuous image tracking (vs static detection).
     (iOS 12+ only)
     */
    virtual void setNumberOfTrackedImages(int numImages) = 0;

    /*
     Enables the user to load in a pre-defined set of AR Image Targets
     */
    virtual void loadARImageDatabase(std::shared_ptr<VROARImageDatabase> arImageDatabase) = 0;

    /*
     Unloads the most recently loaded ARImageDatabase.
     */
    virtual void unloadARImageDatabase() = 0;

    /*
     Adds an image target that should be tracked by this session.
     */
    virtual void addARImageTarget(std::shared_ptr<VROARImageTarget> target) = 0;

    /*
     Removes an image target that should no longer be tracked by this session and the
     corresponding anchor that matched with the target. If the image target has not
     been found yet, then the given anchor should be nullptr
     */
    virtual void removeARImageTarget(std::shared_ptr<VROARImageTarget> target) = 0;

    /*
     Adds an object target that should be tracked by this session.
     */
    virtual void addARObjectTarget(std::shared_ptr<VROARObjectTarget> target) = 0;
    
    /*
     Removes an object target that should no longer be tracked by this session and the
     corresponding anchor that matched with the target.
     */
    virtual void removeARObjectTarget(std::shared_ptr<VROARObjectTarget> target) = 0;

    /*
     Add or remove anchors from the session. These methods are used for
     placing anchors that are *not* auto-detected. The AR session will
     not keep these anchors up to date; that is the responsibility of the
     system that added the anchor.
     */
    virtual void addAnchor(std::shared_ptr<VROARAnchor> anchor) = 0;
    virtual void removeAnchor(std::shared_ptr<VROARAnchor> anchor) = 0;
    
    /*
     Invoke to update the anchor's node with the latest transformation
     data contained in the anchor, alerting delegates in the process.
     */
    virtual void updateAnchor(std::shared_ptr<VROARAnchor> anchor) = 0;

    /*
     Host an anchor on the cloud anchor provider we're using. Hosting an anchor is an
     asynchronous process that will eventually return the hosted anchor to the
     given callback.

     The ttlDays parameter specifies how long the cloud anchor should be stored
     on the cloud anchor service. Valid values range from 1 to 365 days.
     */
    virtual void hostCloudAnchor(std::shared_ptr<VROARAnchor> anchor,
                                 int ttlDays,
                                 std::function<void(std::shared_ptr<VROARAnchor>)> onSuccess,
                                 std::function<void(std::string error)> onFailure) = 0;
    
    /*
     Resolve an anchor with the given cloud identifier. This is an asynchronous process. If found,
     the anchor will be returned in the given callback.
     */
    virtual void resolveCloudAnchor(std::string cloudAnchorId,
                                    std::function<void(std::shared_ptr<VROARAnchor> anchor)> onSuccess,
                                    std::function<void(std::string error)> onFailure) = 0;
    
    /*
     Invoke each rendering frame. Updates the AR session with the latest
     AR data, and returns this in a VROARFrame. The camera background is
     updated at this point as well.
     */
    virtual std::unique_ptr<VROARFrame> &updateFrame() = 0;
    
    /*
     Get the last frame that was generated via updateFrame().
     */
    virtual std::unique_ptr<VROARFrame> &getLastFrame() = 0;
    
    /*
     Get the background texture for this AR session. The contents of this
     texture are updated after each call to updateFrame().
     */
    virtual std::shared_ptr<VROTexture> getCameraBackgroundTexture() = 0;
    
    /*
     Invoke when the viewport changes. The AR engine may adjust its camera
     background and projection matrices in response to a viewport change.
     */
    virtual void setViewport(VROViewport viewport) = 0;
    
    /*
     Invoke when orientation changes, so the AR engine can make the 
     necessary adjustments.
     */
    virtual void setOrientation(VROCameraOrientation orientation) = 0;

    /*
     Sets AR world origin to the given transform.
     */
    virtual void setWorldOrigin(VROMatrix4f relativeTransform) = 0;

    /*
     Sets the video quality to use.
     */
    virtual void setVideoQuality(VROVideoQuality quality) = 0;
    
    /*
     Set an underlying computer vision model to receive the camera image
     each frame.
     */
    virtual void setVisionModel(std::shared_ptr<VROVisionModel> visionModel) = 0;

    /*
     Set the occlusion mode for AR rendering. When enabled, virtual objects
     will be properly occluded by real-world surfaces or people.
     */
    virtual void setOcclusionMode(VROOcclusionMode mode) {
        _occlusionMode = mode;
    }

    /*
     Get the current occlusion mode.
     */
    VROOcclusionMode getOcclusionMode() const {
        return _occlusionMode;
    }

    /*
     Returns true if occlusion is supported on this device.
     */
    virtual bool isOcclusionSupported() const {
        return false;
    }

    /*
     Returns true if the specified occlusion mode is supported on this device.
     */
    virtual bool isOcclusionModeSupported(VROOcclusionMode mode) const {
        return mode == VROOcclusionMode::Disabled;
    }

    // ========================================================================
    // Geospatial API
    // ========================================================================

    /*
     Set the delegate to receive geospatial tracking updates.
     */
    virtual void setGeospatialDelegate(std::shared_ptr<VROGeospatialDelegate> delegate) {
        _geospatialDelegate = delegate;
    }

    std::shared_ptr<VROGeospatialDelegate> getGeospatialDelegate() {
        return _geospatialDelegate.lock();
    }

    /*
     Returns true if geospatial mode is supported on this device.
     */
    virtual bool isGeospatialModeSupported() const {
        return false;
    }

    /*
     Enable or disable geospatial mode. When enabled, the session will track
     the device's position relative to the Earth using GPS and VPS.
     */
    virtual void setGeospatialModeEnabled(bool enabled) {
        // Default implementation does nothing
    }

    /*
     Get the current Earth tracking state.
     */
    virtual VROEarthTrackingState getEarthTrackingState() const {
        return VROEarthTrackingState::Stopped;
    }

    /*
     Get the current camera geospatial pose. Returns an invalid pose if
     geospatial tracking is not available.
     */
    virtual VROGeospatialPose getCameraGeospatialPose() const {
        return VROGeospatialPose();
    }

    /*
     Check VPS availability at the specified location.
     The callback will be called with the availability status.
     */
    virtual void checkVPSAvailability(double latitude, double longitude,
                                      std::function<void(VROVPSAvailability)> callback) {
        if (callback) {
            callback(VROVPSAvailability::Unknown);
        }
    }

    /*
     Create a WGS84 geospatial anchor at the specified location.
     WGS84 anchors are positioned using absolute coordinates on the WGS84 ellipsoid.
     */
    virtual void createGeospatialAnchor(double latitude, double longitude, double altitude,
                                        VROQuaternion quaternion,
                                        std::function<void(std::shared_ptr<VROGeospatialAnchor>)> onSuccess,
                                        std::function<void(std::string error)> onFailure) {
        if (onFailure) {
            onFailure("Geospatial anchors not supported");
        }
    }

    /*
     Create a terrain anchor at the specified location.
     Terrain anchors are positioned relative to the terrain surface.
     The altitude parameter specifies meters above the terrain.
     */
    virtual void createTerrainAnchor(double latitude, double longitude, double altitudeAboveTerrain,
                                     VROQuaternion quaternion,
                                     std::function<void(std::shared_ptr<VROGeospatialAnchor>)> onSuccess,
                                     std::function<void(std::string error)> onFailure) {
        if (onFailure) {
            onFailure("Terrain anchors not supported");
        }
    }

    /*
     Create a rooftop anchor at the specified location.
     Rooftop anchors are positioned relative to a building rooftop.
     The altitude parameter specifies meters above the rooftop.
     */
    virtual void createRooftopAnchor(double latitude, double longitude, double altitudeAboveRooftop,
                                     VROQuaternion quaternion,
                                     std::function<void(std::shared_ptr<VROGeospatialAnchor>)> onSuccess,
                                     std::function<void(std::string error)> onFailure) {
        if (onFailure) {
            onFailure("Rooftop anchors not supported");
        }
    }

    /*
     Remove a geospatial anchor from the session.
     */
    virtual void removeGeospatialAnchor(std::shared_ptr<VROGeospatialAnchor> anchor) {
        // Default implementation does nothing
    }

    // ========================================================================
    // Scene Semantics API
    // ========================================================================

    /*
     * Set the delegate to receive semantic updates each frame.
     */
    virtual void setSemanticsDelegate(std::shared_ptr<VROSemanticsDelegate> delegate) {
        _semanticsDelegate = delegate;
    }

    std::shared_ptr<VROSemanticsDelegate> getSemanticsDelegate() {
        return _semanticsDelegate.lock();
    }

    /*
     * Returns true if semantic mode is supported on this device.
     * Scene semantics requires ARCore 1.40+ and specific device capabilities.
     */
    virtual bool isSemanticModeSupported() const {
        return false;
    }

    /*
     * Enable or disable semantic mode. When enabled, the session will
     * provide semantic segmentation data for each frame.
     *
     * Note: Scene semantics is designed for outdoor scenes only and
     * works best in portrait orientation.
     */
    virtual void setSemanticModeEnabled(bool enabled) {
        _semanticModeEnabled = enabled;
    }

    /*
     * Get whether semantic mode is currently enabled.
     */
    virtual bool isSemanticModeEnabled() const {
        return _semanticModeEnabled;
    }

protected:

    VROTrackingType _trackingType;
    bool _semanticModeEnabled = false;

private:

    VROWorldAlignment _worldAlignment;
    VROImageTrackingImpl _imageTrackingImpl;
    VROOcclusionMode _occlusionMode = VROOcclusionMode::Disabled;
    VROGeospatialAnchorProvider _geospatialAnchorProvider = VROGeospatialAnchorProvider::None;
    std::shared_ptr<VROScene> _scene;
    std::weak_ptr<VROARSessionDelegate> _delegate;
    std::weak_ptr<VROGeospatialDelegate> _geospatialDelegate;
    std::weak_ptr<VROSemanticsDelegate> _semanticsDelegate;

};

class VROARSessionDelegate {
public:
    
    /*
     Invoked whenever an anchor is detected by the AR session, or when an 
     anchor is manually added to the session via addAnchor(). The application
     can choose to add a VROARNode to associate virtual content with this
     anchor by setting a VROARNode on the anchor.
     */
    virtual void anchorWasDetected(std::shared_ptr<VROARAnchor> anchor) = 0;
    
    /*
     Invoked just before and after the anchor's node's properties are updated
     to match the current state of the anchor.
     */
    virtual void anchorWillUpdate(std::shared_ptr<VROARAnchor> anchor) = 0;
    virtual void anchorDidUpdate(std::shared_ptr<VROARAnchor> anchor) = 0;
    
    /*
     Invoked when an anchor is removed from the AR session, along with its
     corresponding node (now detached from the scene).
     */
    virtual void anchorWasRemoved(std::shared_ptr<VROARAnchor> anchor) = 0;
    
};

#endif /* VROARSession_h */
