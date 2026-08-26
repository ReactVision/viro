//
//  VROGeospatial.h
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

#ifndef VROGeospatial_h
#define VROGeospatial_h

#include <string>
#include "VROQuaternion.h"

/*
 * Represents the Earth tracking state from the Geospatial API.
 */
enum class VROEarthTrackingState {
    Enabled,    // Earth is being tracked with VPS/GPS fusion
    Paused,     // Tracking is paused (e.g., app backgrounded)
    Stopped,    // No tracking available
    // WS-D: appended, not inserted — Android's JNI bridge maps this enum to Java
    // by raw ordinal (ARScene.java), so existing positions must not shift.
    Localizing  // GPS fix acquired but not yet within the accuracy threshold
};

// WS-D: horizontal accuracy (meters) below which a GPS-only geospatial pose is
// considered localized rather than still converging. Placeholder default —
// will become app-configurable via the JS bridge (WS-D follow-up task).
constexpr double kVROGeospatialAccuracyThresholdMeters = 15.0;

/*
 * Represents the availability of Visual Positioning System (VPS) at a location.
 */
enum class VROVPSAvailability {
    Available,              // VPS is available at this location
    Unavailable,            // VPS is not available at this location
    ErrorNetwork,           // Network error while checking
    ErrorResourceExhausted, // API quota exceeded
    Unknown                 // Unknown state
};

/*
 * Represents the type of geospatial anchor.
 */
enum class VROGeospatialAnchorType {
    WGS84,      // Absolute position on WGS84 ellipsoid
    Terrain,    // Relative to terrain surface
    Rooftop     // Relative to building rooftop
};

/*
 * Represents the resolve state for async geospatial anchors (terrain/rooftop).
 */
enum class VROGeospatialAnchorResolveState {
    Success,
    TaskInProgress,
    ErrorInternal,
    ErrorNotAuthorized,
    ErrorResourceExhausted,
    ErrorUnsupportedLocation
};

/*
 * Geospatial pose representing camera or anchor position in Earth coordinates.
 * Uses the WGS84 coordinate system (same as GPS).
 */
struct VROGeospatialPose {
    // Geographic coordinates
    double latitude;        // Degrees (-90 to 90)
    double longitude;       // Degrees (-180 to 180)
    double altitude;        // Meters above WGS84 ellipsoid

    // Orientation in East-Up-South (EUS) coordinate system
    VROQuaternion quaternion;

    // Heading (compass bearing) in degrees, 0 = North, clockwise
    double heading;

    // Accuracy metrics
    double horizontalAccuracy;      // Meters
    double verticalAccuracy;        // Meters
    double headingAccuracy;         // Degrees (95% confidence)
    double orientationYawAccuracy;  // Degrees (95% confidence)

    // Timestamp in milliseconds
    double timestamp;

    VROGeospatialPose() :
        latitude(0),
        longitude(0),
        altitude(0),
        heading(0),
        horizontalAccuracy(0),
        verticalAccuracy(0),
        headingAccuracy(0),
        orientationYawAccuracy(0),
        timestamp(0) {}

    VROGeospatialPose(double lat, double lng, double alt,
                      VROQuaternion quat, double hdg,
                      double hAcc, double vAcc, double hdgAcc, double yawAcc,
                      double ts) :
        latitude(lat),
        longitude(lng),
        altitude(alt),
        quaternion(quat),
        heading(hdg),
        horizontalAccuracy(hAcc),
        verticalAccuracy(vAcc),
        headingAccuracy(hdgAcc),
        orientationYawAccuracy(yawAcc),
        timestamp(ts) {}

    bool isValid() const {
        return latitude != 0 || longitude != 0;
    }
};

/*
 * Delegate for receiving geospatial tracking updates.
 */
class VROGeospatialDelegate {
public:
    virtual ~VROGeospatialDelegate() {}

    /*
     * Called when Earth tracking state changes.
     */
    virtual void onEarthTrackingStateChanged(VROEarthTrackingState state) = 0;

    /*
     * Called when camera geospatial pose is updated.
     */
    virtual void onGeospatialPoseUpdated(const VROGeospatialPose &pose) = 0;

    /*
     * Called when a geospatial anchor is created or resolved.
     */
    virtual void onGeospatialAnchorCreated(const std::string &anchorId,
                                           VROGeospatialAnchorType type,
                                           VROGeospatialAnchorResolveState state) = 0;
};

/*
 * Helper functions for converting enum values to strings.
 */
inline std::string VROEarthTrackingStateToString(VROEarthTrackingState state) {
    switch (state) {
        case VROEarthTrackingState::Enabled: return "ENABLED";
        case VROEarthTrackingState::Paused: return "PAUSED";
        case VROEarthTrackingState::Stopped: return "STOPPED";
        case VROEarthTrackingState::Localizing: return "LOCALIZING";
    }
    return "UNKNOWN";
}

inline std::string VROVPSAvailabilityToString(VROVPSAvailability availability) {
    switch (availability) {
        case VROVPSAvailability::Available: return "AVAILABLE";
        case VROVPSAvailability::Unavailable: return "UNAVAILABLE";
        case VROVPSAvailability::ErrorNetwork: return "ERROR_NETWORK";
        case VROVPSAvailability::ErrorResourceExhausted: return "ERROR_RESOURCE_EXHAUSTED";
        case VROVPSAvailability::Unknown: return "UNKNOWN";
    }
    return "UNKNOWN";
}

inline std::string VROGeospatialAnchorTypeToString(VROGeospatialAnchorType type) {
    switch (type) {
        case VROGeospatialAnchorType::WGS84: return "WGS84";
        case VROGeospatialAnchorType::Terrain: return "TERRAIN";
        case VROGeospatialAnchorType::Rooftop: return "ROOFTOP";
    }
    return "UNKNOWN";
}

inline std::string VROGeospatialAnchorResolveStateToString(VROGeospatialAnchorResolveState state) {
    switch (state) {
        case VROGeospatialAnchorResolveState::Success: return "SUCCESS";
        case VROGeospatialAnchorResolveState::TaskInProgress: return "TASK_IN_PROGRESS";
        case VROGeospatialAnchorResolveState::ErrorInternal: return "ERROR_INTERNAL";
        case VROGeospatialAnchorResolveState::ErrorNotAuthorized: return "ERROR_NOT_AUTHORIZED";
        case VROGeospatialAnchorResolveState::ErrorResourceExhausted: return "ERROR_RESOURCE_EXHAUSTED";
        case VROGeospatialAnchorResolveState::ErrorUnsupportedLocation: return "ERROR_UNSUPPORTED_LOCATION";
    }
    return "UNKNOWN";
}

#endif /* VROGeospatial_h */
