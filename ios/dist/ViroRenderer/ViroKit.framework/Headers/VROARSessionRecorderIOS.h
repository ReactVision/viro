//
//  VROARSessionRecorderIOS.h
//  ViroKit
//
//  Records an AR session to local storage: video.mp4 (the camera passthrough
//  feed, muxed directly from ARKit's own pixel buffers) + session.jsonl
//  (header/imu/pose/anchor records). See
//  ViroWorkspace/plans/viro-ar-recording-playback-plan.md §2 for the format
//  and the rationale (raw IMU is a tap independent of ARKit; fused pose is
//  ground truth, not fed back into anything; extrinsics default to identity).
//
//  Owned by VROARSessioniOS, which calls recordFrame() from updateFrame() —
//  this class does no ARKit session management of its own, it only observes.
//
//  Availability note: matches VROARSessioniOS.h's guard. ARKit's camera
//  session has no Simulator equivalent, so this can only be exercised on a
//  physical device.
//
//  Copyright © 2026 ReactVision. All rights reserved.
//

#ifndef VROARSessionRecorderIOS_h
#define VROARSessionRecorderIOS_h

#include "Availability.h"
#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 110000

#include "VROARSession.h"
#include <functional>
#include <fstream>
#include <mutex>
#include <string>

#import <ARKit/ARKit.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreMotion/CoreMotion.h>

enum class VROCameraOrientation; // VROCameraTexture.h

class API_AVAILABLE(ios(12.0)) VROARSessionRecorderIOS {
public:

    VROARSessionRecorderIOS();
    ~VROARSessionRecorderIOS();

    /*
     Start recording into config.outputDir. Calls onSuccess once video.mp4 is
     open for writing and the IMU taps are running, onFailure with a message
     otherwise (bad directory, AVAssetWriter setup failure, etc). Both are
     invoked synchronously, on the calling thread.
     */
    bool start(const VROARRecordingConfig &config,
               std::function<void()> onSuccess,
               std::function<void(std::string error)> onFailure);

    /*
     Stop recording: stop the IMU taps, finish the AVAssetWriter, close the
     sidecar. Safe to call when not recording (no-op).
     */
    void stop();

    VROARRecordingStatus getStatus() const;

    /*
     Called once per frame by VROARSessioniOS::updateFrame(), after ARKit has
     delivered a new ARFrame. No-op if not currently recording. orientation is
     needed only for the video's presentation — the pose/intrinsics we write
     are always in ARKit's own (unrotated) camera-image space, matching what
     a consumer needs to reproject.
     */
    void recordFrame(ARFrame *frame);

private:

    VROARRecordingStatus _status;
    std::string _outputDir;
    double _startTimestamp; // ARFrame.timestamp of the first recorded frame, for relative t

    // --- Video (fed directly from ARFrame.capturedImage; no re-render) ---
    AVAssetWriter *_videoWriter;
    AVAssetWriterInput *_videoWriterInput;
    AVAssetWriterInputPixelBufferAdaptor *_videoAdaptor;
    bool _loggedPixelFormatMismatch;

    // --- Raw IMU tap (independent of ARKit; CMMotionManager's raw, un-fused
    // accelerometer/gyro APIs, not the fused CMDeviceMotion path) ---
    CMMotionManager *_motionManager;
    NSOperationQueue *_imuQueue;

    // --- session.jsonl ---
    std::ofstream _sidecar;
    std::mutex _sidecarMutex; // video/IMU/pose callbacks land on different threads
    bool _wroteHeader;

    void writeHeaderIfNeeded(ARFrame *frame);
    void writeImuLine(double tSec, double ax, double ay, double az, double gx, double gy, double gz);
    void writePoseLine(ARFrame *frame);
    void closeSidecar();
};

#endif /* __IPHONE_OS_VERSION_MAX_ALLOWED >= 110000 */
#endif /* VROARSessionRecorderIOS_h */
