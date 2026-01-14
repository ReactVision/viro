//
//  VROMonocularDepthEstimator.h
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

#ifndef VROMonocularDepthEstimator_h
#define VROMonocularDepthEstimator_h

#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 140000

#include <memory>
#include <mutex>
#include <vector>
#include <atomic>
#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreML/CoreML.h>
#import <Vision/Vision.h>
#include "VROTexture.h"
#include "VROMatrix4f.h"

class VROARFrame;
class VRODriver;

/**
 * Delegate protocol for receiving depth estimation events.
 */
class VROMonocularDepthEstimatorDelegate {
public:
    virtual ~VROMonocularDepthEstimatorDelegate() {}

    /**
     * Called when the depth model has been loaded and is ready for inference.
     */
    virtual void onDepthModelReady() = 0;

    /**
     * Called when depth model loading fails.
     * @param error Description of the error.
     */
    virtual void onDepthModelLoadError(const std::string &error) = 0;
};

/**
 * VROMonocularDepthEstimator provides depth estimation for iOS devices without LiDAR
 * using Apple's Depth Pro or similar monocular depth estimation models.
 *
 * This class follows the same async inference pattern as VROVisionEngine:
 * - Camera frames are captured on the render thread
 * - Inference runs asynchronously on a dedicated dispatch queue
 * - Results are cached and accessed via getDepthTexture()
 *
 * Threading Model:
 * - update() is called from the render thread
 * - CoreML inference runs on _depthQueue (serial dispatch queue)
 * - getDepthTexture() can be called from any thread (mutex-protected)
 *
 * Usage:
 *   auto estimator = std::make_shared<VROMonocularDepthEstimator>(driver);
 *   estimator->initWithModel(@"/path/to/DepthPro.mlmodelc");
 *   // Each frame:
 *   estimator->update(arFrame);
 *   auto depthTexture = estimator->getDepthTexture();
 */
class API_AVAILABLE(ios(14.0)) VROMonocularDepthEstimator :
    public std::enable_shared_from_this<VROMonocularDepthEstimator> {

public:
    /**
     * Create a new monocular depth estimator.
     * @param driver The graphics driver for texture creation.
     */
    VROMonocularDepthEstimator(std::shared_ptr<VRODriver> driver);
    virtual ~VROMonocularDepthEstimator();

    #pragma mark - Initialization

    /**
     * Initialize the estimator with a compiled CoreML model.
     * @param modelPath Path to the .mlmodelc directory.
     * @return true if initialization succeeded, false otherwise.
     */
    bool initWithModel(NSString *modelPath);

    /**
     * Check if the estimator is initialized and ready for inference.
     * @return true if ready, false otherwise.
     */
    bool isAvailable() const;

    /**
     * Check if monocular depth estimation is supported on this device.
     * Requires iOS 14.0+ and Neural Engine or GPU compute support.
     * @return true if supported, false otherwise.
     */
    static bool isSupported();

    #pragma mark - Frame Processing

    /**
     * Process a new AR frame for depth estimation.
     * This method captures the camera image and dispatches inference
     * to the depth queue. It returns immediately without blocking.
     *
     * @param frame The current AR frame containing the camera image.
     */
    void update(const VROARFrame *frame);

    #pragma mark - Depth Output

    /**
     * Get the latest estimated depth texture.
     * Returns nullptr if no depth has been estimated yet.
     *
     * The texture format is R32F with depth values in meters.
     * Resolution matches the model output (typically 256x192 or 512x384).
     *
     * @return The depth texture, or nullptr if unavailable.
     */
    std::shared_ptr<VROTexture> getDepthTexture();

    /**
     * Get the depth texture coordinate transform.
     * This transform maps from screen UV coordinates to depth texture UV coordinates,
     * accounting for different resolutions and orientations.
     *
     * @return The transform matrix.
     */
    VROMatrix4f getDepthTextureTransform() const;

    /**
     * Get the dimensions of the depth output.
     * @param outWidth Pointer to store width (may be nullptr).
     * @param outHeight Pointer to store height (may be nullptr).
     */
    void getDepthDimensions(int *outWidth, int *outHeight) const;

    #pragma mark - Configuration

    /**
     * Set the scale factor for converting model output to metric depth.
     * Some models output relative/disparity depth that needs scaling.
     * Default is 1.0 (assumes model outputs metric depth in meters).
     *
     * @param scale The scale factor to multiply depth values by.
     */
    void setScaleFactor(float scale);

    /**
     * Enable or disable temporal filtering for depth stability.
     * When enabled, depth values are smoothed across frames using
     * an exponential moving average, reducing flickering.
     * Default is true.
     *
     * @param enabled Whether to enable temporal filtering.
     */
    void setTemporalFilteringEnabled(bool enabled);

    /**
     * Set the temporal filter strength (alpha value).
     * Lower values = more smoothing, higher values = faster response.
     * Range: 0.0 to 1.0. Default is 0.3.
     *
     * @param alpha The filter strength.
     */
    void setTemporalFilterAlpha(float alpha);

    /**
     * Set the target inference FPS for rate limiting.
     * Inference will be skipped if called faster than this rate.
     * Set to 0 to disable rate limiting. Default is 15 FPS.
     *
     * @param fps Target frames per second for inference.
     */
    void setTargetFPS(int fps);

    /**
     * Set the delegate for receiving depth estimation events.
     * @param delegate The delegate to receive events (weak reference).
     */
    void setDelegate(std::weak_ptr<VROMonocularDepthEstimatorDelegate> delegate);

    #pragma mark - Diagnostics

    /**
     * Get the current inference FPS (actual, not target).
     * @return The measured inference rate.
     */
    float getCurrentFPS() const;

    /**
     * Get the average inference latency in milliseconds.
     * @return The average time from frame input to depth output.
     */
    float getAverageLatencyMs() const;

    /**
     * Get the CPU-side depth buffer data for direct sampling.
     * Returns nullptr if no depth data is available.
     * The buffer contains depth values in meters, stored row-major.
     * Thread-safe.
     */
    const float* getDepthBufferData() const;

    /**
     * Get the width of the depth buffer.
     */
    int getDepthBufferWidth() const { return _depthWidth; }

    /**
     * Get the height of the depth buffer.
     */
    int getDepthBufferHeight() const { return _depthHeight; }

private:
    // Graphics driver
    std::weak_ptr<VRODriver> _driver;

    // CoreML components
    MLModel *_model;
    VNCoreMLModel *_coreMLModel;
    VNCoreMLRequest *_visionRequest;
    bool _modelLoaded;

    // Threading
    dispatch_queue_t _depthQueue;
    mutable std::mutex _imageMutex;
    mutable std::mutex _depthMutex;

    // Frame management (pattern from VROVisionEngine)
    CVPixelBufferRef _processingImage;
    CVPixelBufferRef _nextImage;
    VROMatrix4f _nextTransform;
    CGImagePropertyOrientation _nextOrientation;
    std::atomic<bool> _isProcessing;

    // Depth output
    std::shared_ptr<VROTexture> _currentDepthTexture;
    std::vector<float> _depthBuffer;
    std::vector<float> _previousDepthBuffer;
    int _depthWidth;
    int _depthHeight;
    VROMatrix4f _depthTextureTransform;

    // Configuration
    float _depthScaleFactor;
    bool _temporalFilteringEnabled;
    float _temporalFilterAlpha;
    int _targetFPS;
    double _lastInferenceTime;

    // Diagnostics
    float _currentFPS;
    float _averageLatencyMs;
    int _frameCount;
    double _fpsAccumulator;
    double _latencyAccumulator;

    // Delegate
    std::weak_ptr<VROMonocularDepthEstimatorDelegate> _delegate;

    #pragma mark - Internal Methods

    /**
     * Process the next queued image (called on depth queue).
     */
    void nextImage();

    /**
     * Run CoreML inference on an image (called on depth queue).
     */
    void runInference(CVPixelBufferRef image, VROMatrix4f transform,
                      CGImagePropertyOrientation orientation);

    /**
     * Process the depth output from CoreML (called on depth queue).
     */
    void processDepthOutput(VNCoreMLFeatureValueObservation *result,
                           VROMatrix4f transform);

    /**
     * Apply temporal filtering to depth buffer.
     */
    void applyTemporalFilter(float *depthData, int width, int height);

    /**
     * Update the GPU texture with new depth data.
     */
    void updateDepthTexture(const float *depthData, int width, int height);

    /**
     * Compute the depth texture transform for the current orientation.
     */
    VROMatrix4f computeDepthTextureTransform(VROMatrix4f imageTransform,
                                             int imageWidth, int imageHeight,
                                             int depthWidth, int depthHeight);

    /**
     * Update FPS and latency statistics.
     */
    void updateDiagnostics(double inferenceTimeMs);
};

#endif // __IPHONE_OS_VERSION_MAX_ALLOWED >= 140000
#endif // VROMonocularDepthEstimator_h
