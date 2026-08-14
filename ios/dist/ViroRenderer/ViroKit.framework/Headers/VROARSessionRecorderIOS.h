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
#include <vector>

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

    // imu/pose lines are buffered here (not written straight to _sidecar) and
    // sorted by `t` before being flushed at stop() — see flushBufferedLinesSorted().
    // Without this, the format's documented "monotonic timestamp_ns order"
    // guarantee breaks: imu arrives on CMMotionManager's fast dedicated queue
    // while pose is written from recordFrame() on the much busier AR/render
    // callback, so pose lines land in the file tens-to-hundreds of ms later
    // than their own timestamp would place them, even though each stream is
    // individually monotonic.
    struct SidecarLine { int64_t t; std::string text; };
    std::vector<SidecarLine> _bufferedLines;

    // Guards _status and the video writer pointers together, so stop() and
    // recordFrame() can never interleave: stop() takes this lock, flips
    // _status away from Recording, and only then hands _videoWriterInput to
    // markAsFinished — any recordFrame() call that arrives concurrently either
    // finishes its critical section first (this lock) or observes the new
    // status and returns before touching the writer. Without this, a
    // recordFrame() on the AR/render thread could append a sample buffer
    // after markAsFinished was already called from stop()'s thread, which can
    // leave AVAssetWriter unable to ever complete finishWriting — the writer
    // gets released after the old fixed timeout with no moov atom ever
    // written, producing an unplayable video.mp4 (mdat with a placeholder
    // size and no moov — reproduced against a real recording; see
    // ViroWorkspace/docs/AR_SESSION_RECORDING.md).
    std::mutex _stateMutex;

    void writeHeaderIfNeeded(ARFrame *frame);
    void writeImuLine(double tSec, double ax, double ay, double az, double gx, double gy, double gz);
    void writePoseLine(ARFrame *frame);
    void flushBufferedLinesSorted();
    void closeSidecar();
};

#endif /* __IPHONE_OS_VERSION_MAX_ALLOWED >= 110000 */
#endif /* VROARSessionRecorderIOS_h */
