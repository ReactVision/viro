/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule polarToCartesian
 */
/**
 * Convert the given polar coords of the form [r, theta, phi] to cartesian
 * coordinates based on the default user location of (0, 0, 0) w/ viewing vector
 * of (0, 0, -1) and up vector of (0, 1, 0).
 *
 * r - radius of the line
 * theta - angle to the right of the viewing vector
 * phi - angle up from the viewing vector
 */
export declare function polarToCartesian(polarcoords: number[]): number[];
/**
 * Convert the given polar coords of the form [r, theta, phi] to cartesian
 * coordinates following the proper mathematical notation (from the zeros of
 * each axis)
 *
 * r - radius of the line
 * theta - the xz-plane angle starting from x = 0 degrees
 * phi - the yz-plane angle starting from y = 0 degrees
 */
export declare function polarToCartesianActual(polarcoords: number[]): number[];
import type { ViroGeospatialPose } from "../Types/ViroEvents";
/**
 * Convert a lat/lng pair to Web Mercator coordinates (metres).
 * Returns [x (Easting), y (Northing)].
 */
export declare function latLngToMercator(lat: number, lng: number): [number, number];
/**
 * Convert a GPS position (lat/lng/alt) to an AR world-space offset from the
 * device's current geospatial pose.
 *
 * Uses a Mercator projection for the horizontal plane and the device compass
 * heading to rotate into the AR coordinate frame:
 *   +X = right,  +Y = up,  -Z = forward (right-hand rule)
 *
 * @param devicePose  Current camera geospatial pose from getCameraGeospatialPose()
 * @param anchorLat   Target latitude in degrees
 * @param anchorLng   Target longitude in degrees
 * @param anchorAlt   Target altitude in metres (WGS84)
 * @returns [arX, arY, arZ] position in metres relative to the device
 */
export declare function gpsToArWorld(devicePose: ViroGeospatialPose, anchorLat: number, anchorLng: number, anchorAlt: number): [number, number, number];
export interface ViroiOSArSupportResponse {
    isARSupported: boolean;
}
export type ViroAndroidArSupportResponse = 
/**
 * The device is <b>supported</b> by ARCore.
 */
"SUPPORTED"
/**
 * The device is <b>unsupported</b> by ARCore.
 */
 | "UNSUPPORTED"
/**
 * ARCore support is <b>unknown</b> for this device.
 */
 | "UNKNOWN"
/**
 * ARCore is still checking for support. This is a temporary state, and the application should
 * check again soon.
 */
 | "TRANSIENT";
export interface ViroARSupportResponse {
    isARSupported: boolean;
}
export declare function isARSupportedOnDevice(): Promise<ViroARSupportResponse>;
