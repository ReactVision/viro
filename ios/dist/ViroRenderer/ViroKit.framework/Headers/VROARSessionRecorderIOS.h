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

    /*
     A GPS/heading fix to attach to the next `pose` line recordFrame() writes,
     for map geo-registration downstream. hasGps gates the whole `gps` object
     (latitude/longitude/altitude); without a valid heading (hasHeading false,
     or a heading outside [0, 360)) the heading fields are written as null —
     see writePoseLine().

     headingDegrees must already be the compass bearing of the AR camera's
     forward axis, projected onto the horizontal plane, at the instant of the
     fix (degrees, [0, 360), clockwise from true north) — this class does not
     derive that fusion itself. The caller (VROARSessioniOS, reusing the GPS
     pose it already maintains for ReactVision geospatial anchors) is
     responsible for supplying it, the same division of responsibility
     ReactVisionCCA's setKeyframeLocation()/KeyframeGeoReading uses for the
     analogous per-keyframe input.
     */
    struct VROARRecordingGeoReading {
        bool   hasGps                  = false;
        double latitude                = 0.0;
        double longitude               = 0.0;
        double altitude                = 0.0;
        double hAccuracy               = -1.0; // < 0 == unknown, omitted from the sidecar
        bool   hasHeading              = false;
        double headingDegrees          = 0.0;
        double headingAccuracyDegrees  = -1.0; // < 0 == unknown, omitted from the sidecar
    };

    /*
     Feed a fresh GPS/heading fix. Attached to the next pose line recordFrame()
     writes, then cleared — so a pose only ever carries a reading taken at (as
     close as the caller can manage) that instant, matching session.jsonl's
     "not every pose record needs one". Safe to call from any thread, at
     whatever rate the location/compass source delivers (~1 Hz is fine);
     recordFrame() always runs on the AR/render thread, so this just guards a
     small struct the two threads share. A no-op call (default-constructed
     reading) is harmless — it simply never produces a `gps` field.
     */
    void setLocationReading(const VROARRecordingGeoReading &reading);

private:

    VROARRecordingStatus _status;
    std::string _outputDir;
    double _startTimestamp; // ARFrame.timestamp of the first recorded frame, for relative t

    // --- Video (fed directly from ARFrame.capturedImage; no re-render) ---
    AVAssetWriter *_videoWriter;
    AVAssetWriterInput *_videoWriterInput;
    AVAssetWriterInputPixelBufferAdaptor *_videoAdaptor;
    bool _loggedPixelFormatMismatch;
    // Writer failed; skip video for the rest of the session, keep session.jsonl.
    bool _videoDisabled;
    // Geometry the writer was created with, for reporting append mismatches.
    size_t _videoWidth;
    size_t _videoHeight;
    // Last recorded ARFrame.timestamp; drops duplicates so poses match frames 1:1.
    double _lastFrameTimestamp;

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

    // GPS/heading fix pending attachment to the next pose
    // line. Set from any thread via setLocationReading(), consumed (and
    // cleared) by writePoseLine() on the AR/render thread. A dedicated mutex,
    // not _sidecarMutex: setLocationReading() should never block on whatever
    // the sidecar writer is doing.
    std::mutex _geoMutex;
    VROARRecordingGeoReading _pendingGeo;

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
