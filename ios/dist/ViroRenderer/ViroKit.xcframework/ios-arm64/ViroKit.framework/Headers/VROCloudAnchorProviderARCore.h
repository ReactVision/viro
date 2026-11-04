//
//  VROCloudAnchorProviderARCore.h
//  ViroKit
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

#ifndef VROCloudAnchorProviderARCore_h
#define VROCloudAnchorProviderARCore_h

#import <Foundation/Foundation.h>
#import <ARKit/ARKit.h>
#import <CoreLocation/CoreLocation.h>

#if __has_include(<ARCore/ARCore.h>)
#define ARCORE_AVAILABLE 1
#import <ARCore/ARCore.h>
#else
#define ARCORE_AVAILABLE 0
#endif

// ARCore Geospatial is part of the main ARCore SDK when using CocoaPods
// The geospatial classes (GAREarth, GARGeospatialTransform) are in ARCoreGARSession
#if __has_include(<ARCoreGARSession/ARCoreGARSession.h>)
#define ARCORE_GEOSPATIAL_AVAILABLE 1
#import <ARCoreGARSession/ARCoreGARSession.h>
#elif __has_include(<ARCoreGeospatial/ARCoreGeospatial.h>)
#define ARCORE_GEOSPATIAL_AVAILABLE 1
#import <ARCoreGeospatial/ARCoreGeospatial.h>
#else
#define ARCORE_GEOSPATIAL_AVAILABLE 0
#endif

// ARCore Semantics for Scene Semantics API (ML-based scene understanding)
#if __has_include(<ARCoreSemantics/ARCoreSemantics.h>)
#define ARCORE_SEMANTICS_AVAILABLE 1
#import <ARCoreSemantics/ARCoreSemantics.h>
#else
#define ARCORE_SEMANTICS_AVAILABLE 0
#endif

#include <memory>
#include <string>
#include <functional>
#include <map>
#include "VROGeospatial.h"

class VROARAnchor;
class VROGeospatialAnchor;

/**
 * Wrapper class for ARCore Cloud Anchors and Geospatial API on iOS.
 * This class manages the GARSession and handles hosting/resolving cloud anchors,
 * as well as geospatial features like Earth tracking and geospatial anchors.
 */
API_AVAILABLE(ios(12.0))
@interface VROCloudAnchorProviderARCore : NSObject

/**
 * Initialize the cloud anchor provider.
 * The API key is read from Info.plist (GARAPIKey).
 * @return Initialized provider, or nil if ARCore SDK is not available or API key missing
 */
- (nullable instancetype)init;

/**
 * Check if the ARCore Cloud Anchors SDK is available.
 * This performs a runtime check for weak-linked frameworks,
 * so it will return NO if the ARCore pods are not included in the app.
 */
+ (BOOL)isAvailable;

/**
 * Check if the ARCore Geospatial SDK is available at runtime.
 */
+ (BOOL)isGeospatialAvailable;

/**
 * Check if the ARCore Semantics SDK is available at runtime.
 */
+ (BOOL)isSemanticsAvailable;

/**
 * Host an anchor to the cloud.
 * @param anchor The ARKit anchor to host
 * @param ttlDays Time-to-live in days (1-365)
 * @param onSuccess Callback with the cloud anchor ID on success
 * @param onFailure Callback with error message on failure
 */
- (void)hostAnchor:(ARAnchor *)anchor
           ttlDays:(NSInteger)ttlDays
         onSuccess:(void (^)(NSString *cloudAnchorId, ARAnchor *resolvedAnchor))onSuccess
         onFailure:(void (^)(NSString *error))onFailure;

/**
 * Resolve a cloud anchor by its ID.
 * @param cloudAnchorId The cloud anchor ID to resolve
 * @param onSuccess Callback with the resolved anchor on success
 * @param onFailure Callback with error message on failure
 */
- (void)resolveAnchor:(NSString *)cloudAnchorId
            onSuccess:(void (^)(NSString *cloudAnchorId, ARAnchor *resolvedAnchor))onSuccess
            onFailure:(void (^)(NSString *error))onFailure;

/**
 * Cancel all pending cloud anchor operations.
 */
- (void)cancelAllOperations;

/**
 * Must be called each frame to process cloud anchor updates.
 * @param frame The current ARFrame
 */
- (void)updateWithFrame:(ARFrame *)frame;

// ========================================================================
// Geospatial API
// ========================================================================

/**
 * Check if geospatial mode is available.
 */
+ (BOOL)isGeospatialAvailable;

/**
 * Check if geospatial mode is supported on this device.
 */
- (BOOL)isGeospatialModeSupported;

/**
 * Enable or disable geospatial mode.
 * @param enabled YES to enable geospatial mode
 */
- (void)setGeospatialModeEnabled:(BOOL)enabled;

/**
 * Get the current Earth tracking state.
 */
- (VROEarthTrackingState)getEarthTrackingState;

/**
 * Get the current camera geospatial pose.
 * Returns an invalid pose if geospatial tracking is not available.
 */
- (VROGeospatialPose)getCameraGeospatialPose;

/**
 * Check VPS availability at the specified location.
 * @param latitude Latitude in degrees
 * @param longitude Longitude in degrees
 * @param callback Callback with the availability status
 */
- (void)checkVPSAvailability:(double)latitude
                   longitude:(double)longitude
                    callback:(void (^)(VROVPSAvailability))callback;

/**
 * Create a WGS84 geospatial anchor.
 * @param latitude Latitude in degrees
 * @param longitude Longitude in degrees
 * @param altitude Altitude in meters above WGS84 ellipsoid
 * @param quaternion Orientation quaternion in EUS frame
 * @param onSuccess Success callback with the created anchor
 * @param onFailure Failure callback with error message
 */
- (void)createGeospatialAnchor:(double)latitude
                     longitude:(double)longitude
                      altitude:(double)altitude
                    quaternion:(simd_quatf)quaternion
                     onSuccess:(void (^)(std::shared_ptr<VROGeospatialAnchor>))onSuccess
                     onFailure:(void (^)(NSString *error))onFailure;

/**
 * Create a terrain anchor.
 * @param latitude Latitude in degrees
 * @param longitude Longitude in degrees
 * @param altitudeAboveTerrain Altitude in meters above terrain
 * @param quaternion Orientation quaternion in EUS frame
 * @param onSuccess Success callback with the created anchor
 * @param onFailure Failure callback with error message
 */
- (void)createTerrainAnchor:(double)latitude
                  longitude:(double)longitude
        altitudeAboveTerrain:(double)altitudeAboveTerrain
                 quaternion:(simd_quatf)quaternion
                  onSuccess:(void (^)(std::shared_ptr<VROGeospatialAnchor>))onSuccess
                  onFailure:(void (^)(NSString *error))onFailure;

/**
 * Create a rooftop anchor.
 * @param latitude Latitude in degrees
 * @param longitude Longitude in degrees
 * @param altitudeAboveRooftop Altitude in meters above rooftop
 * @param quaternion Orientation quaternion in EUS frame
 * @param onSuccess Success callback with the created anchor
 * @param onFailure Failure callback with error message
 */
- (void)createRooftopAnchor:(double)latitude
                  longitude:(double)longitude
       altitudeAboveRooftop:(double)altitudeAboveRooftop
                 quaternion:(simd_quatf)quaternion
                  onSuccess:(void (^)(std::shared_ptr<VROGeospatialAnchor>))onSuccess
                  onFailure:(void (^)(NSString *error))onFailure;

/**
 * Remove a geospatial anchor.
 * @param anchorId The ID of the anchor to remove
 */
- (void)removeGeospatialAnchor:(NSString *)anchorId;

// ========================================================================
// Scene Semantics API
// ========================================================================

/**
 * Check if scene semantics mode is supported on this device.
 * Requires ARCore SDK with Semantics support and compatible device.
 */
- (BOOL)isSemanticModeSupported;

/**
 * Enable or disable scene semantics mode.
 * @param enabled YES to enable semantics, NO to disable
 */
- (void)setSemanticModeEnabled:(BOOL)enabled;

/**
 * Get the semantic image from the current frame.
 * Returns nil if semantics is not enabled or data not yet available.
 * The pixel buffer contains single-channel 8-bit data where each pixel
 * is a semantic label (0-11).
 */
- (CVPixelBufferRef _Nullable)getSemanticImage;

/**
 * Get the semantic confidence image from the current frame.
 * Returns nil if not available.
 * The pixel buffer contains single-channel 8-bit confidence values (0-255).
 */
- (CVPixelBufferRef _Nullable)getSemanticConfidenceImage;

/**
 * Get the fraction of pixels with the specified semantic label.
 * @param label The semantic label ID (0-11)
 * @return Fraction in range [0.0, 1.0], or 0.0 if not available
 */
- (float)getSemanticLabelFraction:(NSInteger)label;

@end

#endif /* VROCloudAnchorProviderARCore_h */
