//
//  VROGeospatialAnchor.h
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

#ifndef VROGeospatialAnchor_h
#define VROGeospatialAnchor_h

#include "VROARAnchor.h"
#include "VROGeospatial.h"

/*
 * A geospatial anchor is positioned using geographic coordinates (latitude, longitude, altitude)
 * rather than local AR coordinates. The AR system converts these to local coordinates for rendering.
 *
 * Three types of geospatial anchors are supported:
 * - WGS84: Absolute position on the WGS84 ellipsoid
 * - Terrain: Position relative to the terrain surface at that location
 * - Rooftop: Position relative to a building rooftop at that location
 */
class VROGeospatialAnchor : public VROARAnchor {
public:

    VROGeospatialAnchor(VROGeospatialAnchorType type,
                        double latitude,
                        double longitude,
                        double altitude,
                        VROQuaternion quaternion) :
        _type(type),
        _latitude(latitude),
        _longitude(longitude),
        _altitude(altitude),
        _quaternion(quaternion),
        _heading(0),
        _resolveState(VROGeospatialAnchorResolveState::TaskInProgress) {

        // Calculate heading from quaternion (yaw angle in EUS frame)
        _heading = calculateHeadingFromQuaternion(quaternion);
    }

    virtual ~VROGeospatialAnchor() {}

    /*
     * Get the type of geospatial anchor.
     */
    VROGeospatialAnchorType getGeospatialType() const {
        return _type;
    }

    /*
     * Get the latitude in degrees (-90 to 90).
     */
    double getLatitude() const {
        return _latitude;
    }

    /*
     * Get the longitude in degrees (-180 to 180).
     */
    double getLongitude() const {
        return _longitude;
    }

    /*
     * Get the altitude. For WGS84 anchors, this is meters above the WGS84 ellipsoid.
     * For Terrain anchors, this is meters above the terrain surface.
     * For Rooftop anchors, this is meters above the building rooftop.
     */
    double getAltitude() const {
        return _altitude;
    }

    /*
     * Get the orientation quaternion in EUS (East-Up-South) coordinate system.
     */
    VROQuaternion getQuaternion() const {
        return _quaternion;
    }

    /*
     * Get the heading (compass bearing) in degrees. 0 = North, increases clockwise.
     */
    double getHeading() const {
        return _heading;
    }

    /*
     * Get the resolve state for this anchor.
     * For WGS84 anchors, this is always Success after creation.
     * For Terrain/Rooftop anchors, this reflects the async resolution status.
     */
    VROGeospatialAnchorResolveState getResolveState() const {
        return _resolveState;
    }

    /*
     * Set the resolve state. Called by the geospatial provider during async resolution.
     */
    void setResolveState(VROGeospatialAnchorResolveState state) {
        _resolveState = state;
    }

    /*
     * Returns true if this is a geospatial anchor.
     */
    bool isGeospatialAnchor() const {
        return true;
    }

    /*
     * Update the local AR transform from the geospatial coordinates.
     * Called by the geospatial provider when the anchor is resolved or updated.
     */
    void updateFromGeospatialTransform(VROMatrix4f transform) {
        setTransform(transform);
        updateNodeTransform();
    }

private:

    VROGeospatialAnchorType _type;
    double _latitude;
    double _longitude;
    double _altitude;
    VROQuaternion _quaternion;
    double _heading;
    VROGeospatialAnchorResolveState _resolveState;

    /*
     * Calculate heading from quaternion in EUS coordinate frame.
     * The heading is the yaw rotation from North (positive Z in EUS).
     */
    double calculateHeadingFromQuaternion(const VROQuaternion &q) {
        // Extract yaw from quaternion (rotation around Up axis in EUS)
        // yaw = atan2(2*(qw*qy + qx*qz), 1 - 2*(qy*qy + qz*qz))
        double siny_cosp = 2.0 * (q.W * q.Y + q.X * q.Z);
        double cosy_cosp = 1.0 - 2.0 * (q.Y * q.Y + q.Z * q.Z);
        double yaw = atan2(siny_cosp, cosy_cosp);

        // Convert to degrees and adjust for North = 0
        double heading = yaw * 180.0 / M_PI;
        heading = fmod(heading + 360.0, 360.0);

        return heading;
    }
};

#endif /* VROGeospatialAnchor_h */
