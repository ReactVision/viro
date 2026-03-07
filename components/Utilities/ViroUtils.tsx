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
export function polarToCartesian(polarcoords: number[]) {
  var cartesianCoords = [];
  var radius = polarcoords[0];
  var theta = polarcoords[1];
  var phi = polarcoords[2];

  var x =
    Math.abs(radius * Math.cos((phi * Math.PI) / 180)) *
    Math.sin((theta * Math.PI) / 180);
  var y = radius * Math.sin((phi * Math.PI) / 180);
  var z = -(
    Math.abs(radius * Math.cos((phi * Math.PI) / 180)) *
    Math.cos((theta * Math.PI) / 180)
  );
  cartesianCoords.push(x);
  cartesianCoords.push(y);
  cartesianCoords.push(z);
  return cartesianCoords;
}

/**
 * Convert the given polar coords of the form [r, theta, phi] to cartesian
 * coordinates following the proper mathematical notation (from the zeros of
 * each axis)
 *
 * r - radius of the line
 * theta - the xz-plane angle starting from x = 0 degrees
 * phi - the yz-plane angle starting from y = 0 degrees
 */
export function polarToCartesianActual(polarcoords: number[]) {
  var cartesianCoords = [];
  var radius = polarcoords[0];
  var theta = polarcoords[1]; //in degrees
  var phi = polarcoords[2]; // in degrees

  var x =
    Math.abs(radius * Math.sin((phi * Math.PI) / 180)) *
    Math.cos((theta * Math.PI) / 180);
  var y = radius * Math.cos((phi * Math.PI) / 180);
  var z =
    Math.abs(radius * Math.sin((phi * Math.PI) / 180)) *
    Math.sin((theta * Math.PI) / 180);
  cartesianCoords.push(x);
  cartesianCoords.push(y);
  cartesianCoords.push(z);
  return cartesianCoords;
}

import { Platform, NativeModules } from "react-native";
import type { ViroGeospatialPose } from "../Types/ViroEvents";

// ---------------------------------------------------------------------------
// Geospatial utilities — GPS ↔ AR world-space conversion
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6378137; // WGS84 equatorial radius in metres

/**
 * Convert a lat/lng pair to Web Mercator coordinates (metres).
 * Returns [x (Easting), y (Northing)].
 */
export function latLngToMercator(
  lat: number,
  lng: number,
): [number, number] {
  const x = EARTH_RADIUS_M * (lng * Math.PI) / 180;
  const y =
    EARTH_RADIUS_M *
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

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
export function gpsToArWorld(
  devicePose: ViroGeospatialPose,
  anchorLat: number,
  anchorLng: number,
  anchorAlt: number,
): [number, number, number] {
  const [devX, devY] = latLngToMercator(devicePose.latitude, devicePose.longitude);
  const [ancX, ancY] = latLngToMercator(anchorLat, anchorLng);

  // Delta in metres: East (X) and North (Y)
  const deltaE = ancX - devX;
  const deltaN = ancY - devY;
  const deltaAlt = anchorAlt - devicePose.altitude;

  // Bearing from device to anchor (clockwise from North, radians)
  const bearing = Math.atan2(deltaE, deltaN);
  const distance = Math.sqrt(deltaE * deltaE + deltaN * deltaN);

  // Device compass heading: degrees CW from North → radians
  const headingRad = (devicePose.heading * Math.PI) / 180;

  // Relative bearing in device frame
  const relBearing = bearing - headingRad;

  // AR frame: +X = right, -Z = forward
  return [
    distance * Math.sin(relBearing), // arX
    deltaAlt,                         // arY (altitude difference)
    -distance * Math.cos(relBearing), // arZ
  ];
}

export interface ViroiOSArSupportResponse {
  isARSupported: boolean;
}

export type ViroAndroidArSupportResponse =
  /**
   * The device is <b>supported</b> by ARCore.
   */
  | "SUPPORTED"
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

export function isARSupportedOnDevice() {
  return new Promise<ViroARSupportResponse>((resolve, reject) => {
    if (Platform.OS == "ios") {
      NativeModules.VRTARUtils.isARSupported(
        (error: Error, result: ViroiOSArSupportResponse) => {
          if (error) reject(error);
          if (result) resolve(result);
          reject("AR Support Unknown.");
        }
      );
    } else {
      NativeModules.VRTARSceneNavigatorModule.isARSupportedOnDevice(
        (result: ViroAndroidArSupportResponse) => {
          if (result == "SUPPORTED") resolve({ isARSupported: true });
          if (result) reject(new Error(result));
          reject("AR Support Unknown.");
        }
      );
    }
  });
}
