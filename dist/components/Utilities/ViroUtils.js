"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.polarToCartesian = polarToCartesian;
exports.polarToCartesianActual = polarToCartesianActual;
exports.isARSupportedOnDevice = isARSupportedOnDevice;
/**
 * Convert the given polar coords of the form [r, theta, phi] to cartesian
 * coordinates based on the default user location of (0, 0, 0) w/ viewing vector
 * of (0, 0, -1) and up vector of (0, 1, 0).
 *
 * r - radius of the line
 * theta - angle to the right of the viewing vector
 * phi - angle up from the viewing vector
 */
function polarToCartesian(polarcoords) {
    var cartesianCoords = [];
    var radius = polarcoords[0];
    var theta = polarcoords[1];
    var phi = polarcoords[2];
    var x = Math.abs(radius * Math.cos((phi * Math.PI) / 180)) *
        Math.sin((theta * Math.PI) / 180);
    var y = radius * Math.sin((phi * Math.PI) / 180);
    var z = -(Math.abs(radius * Math.cos((phi * Math.PI) / 180)) *
        Math.cos((theta * Math.PI) / 180));
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
function polarToCartesianActual(polarcoords) {
    var cartesianCoords = [];
    var radius = polarcoords[0];
    var theta = polarcoords[1]; //in degrees
    var phi = polarcoords[2]; // in degrees
    var x = Math.abs(radius * Math.sin((phi * Math.PI) / 180)) *
        Math.cos((theta * Math.PI) / 180);
    var y = radius * Math.cos((phi * Math.PI) / 180);
    var z = Math.abs(radius * Math.sin((phi * Math.PI) / 180)) *
        Math.sin((theta * Math.PI) / 180);
    cartesianCoords.push(x);
    cartesianCoords.push(y);
    cartesianCoords.push(z);
    return cartesianCoords;
}
const react_native_1 = require("react-native");
function isARSupportedOnDevice() {
    return new Promise((resolve, reject) => {
        if (react_native_1.Platform.OS == "ios") {
            react_native_1.NativeModules.VRTARUtils.isARSupported((error, result) => {
                if (error)
                    reject(error);
                if (result)
                    resolve(result);
                reject("AR Support Unknown.");
            });
        }
        else {
            react_native_1.NativeModules.VRTARSceneNavigatorModule.isARSupportedOnDevice((result) => {
                if (result == "SUPPORTED")
                    resolve({ isARSupported: true });
                if (result)
                    reject(new Error(result));
                reject("AR Support Unknown.");
            });
        }
    });
}
