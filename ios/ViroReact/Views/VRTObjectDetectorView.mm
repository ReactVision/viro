//
//  VRTObjectDetectorView.mm
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
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

#import "VRTObjectDetectorView.h"
#import <CoreVideo/CoreVideo.h>
#import <Accelerate/Accelerate.h>
#import <ARKit/ARKit.h>
#include <stdatomic.h>

// Notification posted by VRTARSceneNavigator on every AR frame.
static NSString * const kVROARFrameNotification = @"VROARDetectorFrame";

// Notification posted when a VRTObjectDetectorView stops using the inference provider.
// ViroONNX observes this to release ORT sessions and return memory to the OS.
NSString * const VRODetectorSessionReleasedNotification = @"VRODetectorSessionReleased";

#if VIRO_ONNXRUNTIME_AVAILABLE
#import <onnxruntime/ort_session.h>
#import <onnxruntime/ort_env.h>
#import <onnxruntime/ort_value.h>
#endif

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

static const NSInteger kDefaultMaxFPS        = 15;
static const float     kDefaultConfidence    = 0.4f;
static const float     kDefaultIou           = 0.45f;
// Model input size expected by YOLOE (640x640 square).
static const int       kModelInputSize       = 640;
// YOLOE output: [1, 300, 38]  — 300 proposals, 38 values each.
static const int       kNumProposals         = 300;
static const int       kProposalDim          = 38;
// Layout within each proposal: [x1, y1, x2, y2, conf, cls, mask_coef x32]
static const int       kBBoxOffset           = 0;  // x1 y1 x2 y2
static const int       kConfOffset           = 4;
static const int       kClsOffset            = 5;

// ---------------------------------------------------------------------------
// Global inference provider slot
// ---------------------------------------------------------------------------

static VRTInferenceBlock gInferenceProvider = nil;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

@implementation VRTObjectDetectorView {
    // --- Standalone camera mode ---
    AVCaptureSession            *_session;
    AVCaptureVideoDataOutput    *_videoOutput;
    AVCaptureVideoPreviewLayer  *_previewLayer;

    // --- AR session mode ---

    // --- Shared ---
    dispatch_queue_t             _inferenceQueue;
    CFTimeInterval               _lastInferenceTime;
    BOOL                         _readyFired;
    BOOL                         _modelLoaded;
    // Set to NO when the view unmounts — stops in-flight blocks from firing callbacks.
    BOOL                         _active;
    // C11 atomic flag: true while an inference block is in flight.
    // No QoS association — avoids the priority-inversion checker warning that
    // dispatch_semaphore_t associated with a lower-QoS queue would trigger.
    atomic_bool                  _inferenceRunning;

    // ONNX Runtime objects (present only when VIRO_ONNXRUNTIME_AVAILABLE is defined).
#if VIRO_ONNXRUNTIME_AVAILABLE
    ORTEnv                      *_ortEnv;
    ORTSession                  *_ortSession;
#endif
}

#pragma mark - Lifecycle

- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    if (self) {
        _model               = @"yoloe-26s";
        _mode                = @"prompt-free";
        _categories          = @[];
        _confidenceThreshold = kDefaultConfidence;
        _iouThreshold        = kDefaultIou;
        _maxFPS              = kDefaultMaxFPS;
        _cameraPosition      = @"back";
        _useARSession        = NO;
        _projectToWorld      = YES;
        _lastInferenceTime   = 0;
        _readyFired          = NO;
        _modelLoaded         = NO;
        _active              = NO;

        // QOS_CLASS_UTILITY: runs below ARKit/renderer but gets real CPU time.
        // Background was too low — iOS would barely schedule it and the
        // priority-inversion checker would flag semaphore waits on the main thread.
        _inferenceQueue = dispatch_queue_create(
            "com.reactvision.objectdetector",
            dispatch_queue_attr_make_with_qos_class(DISPATCH_QUEUE_SERIAL,
                                                    QOS_CLASS_UTILITY, 0));
        atomic_init(&_inferenceRunning, false);
    }
    return self;
}

- (void)dealloc {
    if (_useARSession) {
        [[NSNotificationCenter defaultCenter] removeObserver:self
                                                        name:kVROARFrameNotification
                                                      object:nil];
    }
    [self _stopSession];
}

#pragma mark - React lifecycle

- (void)didMoveToWindow {
    [super didMoveToWindow];
    if (self.window) {
        if (_useARSession) {
            [self _startARMode];
        } else {
            [self _startSession];
        }
    } else {
        if (_useARSession) {
            _active = NO;
            [[NSNotificationCenter defaultCenter] removeObserver:self
                                                            name:kVROARFrameNotification
                                                          object:nil];
            _readyFired  = NO;
            _modelLoaded = NO;
            // ORT sessions kept resident — see _stopSession comment.
        } else {
            [self _stopSession];
        }
    }
}

#pragma mark - Prop setters
// Each setter that changes camera/model config tears down and restarts the session
// so changes take effect immediately without a component remount.

- (void)setModel:(NSString *)model {
    _model = model;
    _modelLoaded = NO;
    [self _restartIfRunning];
}

- (void)setMode:(NSString *)mode {
    _mode = mode;
    [self _restartIfRunning];
}

- (void)setCategories:(NSArray<NSString *> *)categories {
    _categories = categories;
}

- (void)setConfidenceThreshold:(float)confidenceThreshold {
    _confidenceThreshold = confidenceThreshold;
}

- (void)setIouThreshold:(float)iouThreshold {
    _iouThreshold = iouThreshold;
}

- (void)setMaxFPS:(NSInteger)maxFPS {
    _maxFPS = maxFPS;
}

- (void)setCameraPosition:(NSString *)cameraPosition {
    if ([_cameraPosition isEqualToString:cameraPosition]) return;
    _cameraPosition = cameraPosition;
    [self _restartIfRunning];
}

#pragma mark - AR session mode

- (void)_startARMode {
    NSLog(@"[ViroObjDet] _startARMode — subscribing to AR frames");
    _active = YES;
    __weak VRTObjectDetectorView *weakSelf = self;
    dispatch_async(_inferenceQueue, ^{
        NSError *error = nil;
        VRTObjectDetectorView *s = weakSelf;
        if (!s || !s->_active) return;
        if ([s _loadModel:&error]) {
            dispatch_async(dispatch_get_main_queue(), ^{
                VRTObjectDetectorView *ss = weakSelf;
                if (!ss || !ss->_active) return;
                ss->_modelLoaded = YES;
                if (!ss->_readyFired) {
                    ss->_readyFired = YES;
                    if (ss->_onReadyViro) ss->_onReadyViro(@{});
                }
            });
        } else {
            NSString *msg = error.localizedDescription ?: @"Failed to load model (AR mode)";
            dispatch_async(dispatch_get_main_queue(), ^{
                VRTObjectDetectorView *ss = weakSelf;
                if (ss && ss->_onErrorViro) ss->_onErrorViro(@{@"error": msg});
            });
        }
    });
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(_onARFrame:)
                                                 name:kVROARFrameNotification
                                               object:nil];
}

- (void)_onARFrame:(NSNotification *)note {
    static dispatch_once_t firstNotif;
    dispatch_once(&firstNotif, ^{
        NSLog(@"[ViroObjDet] _onARFrame first call — active=%d modelLoaded=%d",
              self->_active, self->_modelLoaded);
    });
    if (!_active || !_modelLoaded) return;

    ARSession *arSession = note.userInfo[@"session"];
    ARFrame   *snapshot  = arSession.currentFrame;
    if (!snapshot) return;

    CFTimeInterval now = CACurrentMediaTime();
    CFTimeInterval minInterval = 1.0 / (double)(_maxFPS > 0 ? _maxFPS : kDefaultMaxFPS);
    if ((now - _lastInferenceTime) < minInterval) return;
    _lastInferenceTime = now;

    // Retain ONLY the pixel buffer — not the ARFrame.
    // Retaining ARFrame prevents ARKit from reusing camera frames → camera freeze.
    // Non-blocking check: skip frame if previous inference is still in flight.
    // atomic_bool has no QoS association — avoids priority-inversion checker warnings.
    bool expected = false;
    if (!atomic_compare_exchange_strong(&_inferenceRunning, &expected, true)) {
        // Already running — skip this frame.
        static dispatch_once_t skipOnce;
        dispatch_once(&skipOnce, ^{ NSLog(@"[ViroObjDet] inference already running, skipping frame"); });
        return;
    }

    NSLog(@"[ViroObjDet] dispatching inference block to queue");
    CVPixelBufferRef yuv = snapshot.capturedImage;
    CVPixelBufferRetain(yuv);

    __weak VRTObjectDetectorView *weakSelf = self;
    dispatch_async(_inferenceQueue, ^{
        VRTObjectDetectorView *s = weakSelf; // must assign to strong before any dereference
        NSLog(@"[ViroObjDet] inference block running on queue — active=%d provider=%s",
              s ? (int)s->_active : -1,
              gInferenceProvider ? "SET" : "NIL");

        if (!s || !s->_active) {
            CVPixelBufferRelease(yuv);
            if (s) atomic_store(&s->_inferenceRunning, false);
            return;
        }

        float *nchw = [s _preprocessARPixelBuffer:yuv];
        CVPixelBufferRelease(yuv);
        NSLog(@"[ViroObjDet] preprocessing done: nchw=%s", nchw ? "OK" : "NULL");

        if (!nchw) {
            atomic_store(&s->_inferenceRunning, false);
            return;
        }

        NSLog(@"[ViroObjDet] calling runInference");
        NSArray *rawDetections = [s _runInferenceWithNCHW:nchw];
        NSLog(@"[ViroObjDet] inference returned %d detections", (int)rawDetections.count);

        atomic_store(&s->_inferenceRunning, false);

        dispatch_async(dispatch_get_main_queue(), ^{
            VRTObjectDetectorView *ss = weakSelf;
            if (!ss || !ss->_active || !ss->_onDetectionViro) return;

            NSArray *detections = rawDetections;
            if (rawDetections.count > 0) {
                ARFrame *fresh = arSession.currentFrame;
                if (fresh) detections = [ss _addWorldPositions:rawDetections toFrame:fresh];
            }
            ss->_onDetectionViro(@{@"detections": detections});
        });
    });
}

// Converts a YCbCr biplanar-420 pixel buffer directly to Float32 NCHW [1,3,640,640].
// Pure CPU / Accelerate — no Metal, no CIContext, no intermediate buffer.
// Uses nearest-neighbour scale + BT.601 full-range YCbCr→RGB.
- (float *)_preprocessARPixelBuffer:(CVPixelBufferRef)yuv {
    if (!yuv) return nil;

    CVPixelBufferLockBaseAddress(yuv, kCVPixelBufferLock_ReadOnly);

    const size_t srcW  = CVPixelBufferGetWidth(yuv);
    const size_t srcH  = CVPixelBufferGetHeight(yuv);

    const uint8_t *yPlane     = (const uint8_t *)CVPixelBufferGetBaseAddressOfPlane(yuv, 0);
    const size_t   yStride    = CVPixelBufferGetBytesPerRowOfPlane(yuv, 0);
    const uint8_t *cbcrPlane  = (const uint8_t *)CVPixelBufferGetBaseAddressOfPlane(yuv, 1);
    const size_t   cbcrStride = CVPixelBufferGetBytesPerRowOfPlane(yuv, 1);

    const int   N   = kModelInputSize;          // 640
    const int   N2  = N * N;
    float *nchw = (float *)malloc(sizeof(float) * 3 * N2);
    if (!nchw) {
        CVPixelBufferUnlockBaseAddress(yuv, kCVPixelBufferLock_ReadOnly);
        return nil;
    }

    float *rPlane = nchw + 0 * N2;
    float *gPlane = nchw + 1 * N2;
    float *bPlane = nchw + 2 * N2;

    const float inv255   = 1.0f / 255.0f;
    const size_t cbcrW   = srcW / 2;
    const size_t cbcrH   = srcH / 2;
    // 90° CCW rotation: portrait pixel (px, py) samples landscape buffer at:
    //   sx = (1 - py/(N-1)) * (srcW-1)   — landscape right → portrait top
    //   sy = (px/(N-1))     * (srcH-1)   — landscape top   → portrait left
    // iPhone back camera delivers landscape where scene-up = landscape-right,
    // so CCW corrects it to portrait. After this, YOLOE box coords are in portrait space.

    for (int py = 0; py < N; py++) {
        float portraitYNorm = (float)py / (float)(N - 1);

        for (int px = 0; px < N; px++) {
            float portraitXNorm = (float)px / (float)(N - 1);

            int sx = (int)((1.0f - portraitYNorm) * (float)(srcW - 1));
            int sy = (int)(portraitXNorm           * (float)(srcH - 1));
            if (sx >= (int)srcW) sx = (int)srcW - 1;
            if (sy >= (int)srcH) sy = (int)srcH - 1;
            int chromaX = sx / 2;
            int chromaY = sy / 2;
            if (chromaX >= (int)cbcrW) chromaX = (int)cbcrW - 1;
            if (chromaY >= (int)cbcrH) chromaY = (int)cbcrH - 1;

            int yv = yPlane   [sy * yStride    + sx];
            int cb = cbcrPlane[chromaY * cbcrStride + chromaX * 2 + 0] - 128;
            int cr = cbcrPlane[chromaY * cbcrStride + chromaX * 2 + 1] - 128;

            // BT.601 full-range
            int r = yv + (int)(1.402f   * cr);
            int g = yv - (int)(0.34414f * cb) - (int)(0.71414f * cr);
            int b = yv + (int)(1.772f   * cb);

            r = r < 0 ? 0 : (r > 255 ? 255 : r);
            g = g < 0 ? 0 : (g > 255 ? 255 : g);
            b = b < 0 ? 0 : (b > 255 ? 255 : b);

            const int i  = py * N + px;
            rPlane[i] = (float)r * inv255;
            gPlane[i] = (float)g * inv255;
            bPlane[i] = (float)b * inv255;
        }
    }

    CVPixelBufferUnlockBaseAddress(yuv, kCVPixelBufferLock_ReadOnly);
    return nchw;
}

// Enriches each detection with screenBoundingBox (always) and worldPosition (if _projectToWorld).
//
// After the 90° CW rotation fix in _preprocessARPixelBuffer:, YOLOE bounding box coords
// are in portrait normalized space [0,1]. screenBoundingBox is computed via a direct 2D
// mapping (resizeAspectFill geometry) — no hitTest or 3D projection needed.
//
// worldPosition uses ARKit hitTest with landscape-converted center coords:
//   landscape_x = 1 - cy_portrait,  landscape_y = cx_portrait  (inverse of 90° CCW)
- (NSArray<NSDictionary *> *)_addWorldPositions:(NSArray<NSDictionary *> *)dets
                                        toFrame:(ARFrame *)frame {
    if (!dets.count) return dets;

    CGSize vp = [UIScreen mainScreen].bounds.size;

    // Camera frame dimensions (always landscape from ARKit).
    CVPixelBufferRef bufRef = frame.capturedImage;
    float srcWf = (float)CVPixelBufferGetWidth(bufRef);   // landscape width  = portrait height
    float srcHf = (float)CVPixelBufferGetHeight(bufRef);  // landscape height = portrait width

    // resizeAspectFill mapping (landscape ARKit frame → portrait device screen):
    //   fillScale = screenH / srcW   (fill portrait height using landscape width)
    //   contentW  = srcH * fillScale (portrait content width, may exceed screenW)
    //   cropX     = (contentW - screenW) / 2
    float fillScale = (float)vp.height / srcWf;
    float contentW  = srcHf * fillScale;
    float cropX     = (contentW - (float)vp.width) * 0.5f;

    static dispatch_once_t diagOnce;
    dispatch_once(&diagOnce, ^{
        NSLog(@"[ViroObjDet] AR mapping: frame=%.0fx%.0f vp=%.0fx%.0f contentW=%.0f cropX=%.0f",
              srcWf, srcHf, vp.width, vp.height, contentW, cropX);
    });

    NSMutableArray *out = [NSMutableArray arrayWithCapacity:dets.count];
    for (NSDictionary *det in dets) {
        NSMutableDictionary *d = [det mutableCopy];
        NSDictionary *bbox = det[@"boundingBox"];

        float bx = [bbox[@"x"]      floatValue];
        float by = [bbox[@"y"]      floatValue];
        float bw = [bbox[@"width"]  floatValue];
        float bh = [bbox[@"height"] floatValue];
        // cx, cy: portrait normalized center coords [0,1] (output of YOLOE after rotation fix)
        float cx = bx + bw * 0.5f;
        float cy = by + bh * 0.5f;

        // --- 2D screenBoundingBox: direct portrait space → screen pixels ---
        float screenCX = cx * contentW - cropX;
        float screenCY = cy * (float)vp.height;
        float sw = bw * contentW;
        float sh = bh * (float)vp.height;
        d[@"screenBoundingBox"] = @{
            @"x":      @(screenCX - sw * 0.5f),
            @"y":      @(screenCY - sh * 0.5f),
            @"width":  @(sw),
            @"height": @(sh)
        };

        // --- worldPosition via ARKit hitTest (optional) ---
        // Convert portrait (cx, cy) to landscape normalized coords (inverse of 90° CW rotation):
        //   landscape_x = 1 - cy_portrait
        //   landscape_y = cx_portrait
        if (_projectToWorld) {
            float hitX = 1.0f - cy;
            float hitY = cx;
            ARHitTestResultType types =
                ARHitTestResultTypeEstimatedHorizontalPlane |
                ARHitTestResultTypeExistingPlaneUsingExtent |
                ARHitTestResultTypeFeaturePoint;
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
            NSArray<ARHitTestResult *> *hits = [frame hitTest:CGPointMake(hitX, hitY) types:types];
#pragma clang diagnostic pop
            if (hits.count > 0) {
                simd_float4x4 ht = hits[0].worldTransform;
                simd_float3 wpos = {ht.columns[3].x, ht.columns[3].y, ht.columns[3].z};
                d[@"worldPosition"] = @{@"x": @(wpos.x), @"y": @(wpos.y), @"z": @(wpos.z)};
            }
        }

        NSLog(@"[ViroObjDet] det '%@' portrait(%.2f,%.2f) screen(%.0f,%.0f) sz(%.0f×%.0f)",
              det[@"label"], cx, cy, screenCX, screenCY, sw, sh);

        [out addObject:[d copy]];
    }
    return [out copy];
}

#pragma mark - Session management

- (void)_startSession {
    if (_session) return;

    dispatch_async(_inferenceQueue, ^{
        [self _loadModelAndStartCapture];
    });
}

- (void)_stopSession {
    if (!_session) return;
    [_session stopRunning];
    _session = nil;
    _videoOutput = nil;
    _modelLoaded = NO;
    _readyFired = NO;
    dispatch_async(dispatch_get_main_queue(), ^{
        [self->_previewLayer removeFromSuperlayer];
        self->_previewLayer = nil;
    });
    // Note: we intentionally do NOT clear the ORT sessions here.
    // The 2GB ORT session stays resident in memory so that subsequent entries
    // (including the AR mode) don't trigger a reload spike that would cause the
    // OS to kill the app. Memory is freed when the app terminates.
    NSLog(@"[ViroObjDet] _stopSession — keeping ORT sessions resident");
}

- (void)_restartIfRunning {
    if (!_session) return;
    [self _stopSession];
    [self _startSession];
}

- (void)_loadModelAndStartCapture {
    // --- 1. Load model ---
    NSError *modelError = nil;
    BOOL loaded = [self _loadModel:&modelError];
    if (!loaded) {
        NSString *msg = modelError.localizedDescription ?: @"Failed to load YOLOE model";
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onErrorViro) {
                self->_onErrorViro(@{@"error": msg});
            }
        });
        return;
    }
    _modelLoaded = YES;

    // --- 2. Configure AVCaptureSession ---
    AVCaptureSession *session = [[AVCaptureSession alloc] init];
    session.sessionPreset = AVCaptureSessionPreset640x480;

    AVCaptureDevicePosition position = [_cameraPosition isEqualToString:@"front"]
        ? AVCaptureDevicePositionFront
        : AVCaptureDevicePositionBack;

    AVCaptureDevice *device = [AVCaptureDevice defaultDeviceWithDeviceType:AVCaptureDeviceTypeBuiltInWideAngleCamera
                                                                 mediaType:AVMediaTypeVideo
                                                                  position:position];
    if (!device) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onErrorViro) {
                self->_onErrorViro(@{@"error": @"Camera device not available"});
            }
        });
        return;
    }

    NSError *inputError = nil;
    AVCaptureDeviceInput *input = [AVCaptureDeviceInput deviceInputWithDevice:device error:&inputError];
    if (!input) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self->_onErrorViro) {
                self->_onErrorViro(@{@"error": inputError.localizedDescription ?: @"Camera input error"});
            }
        });
        return;
    }

    AVCaptureVideoDataOutput *output = [[AVCaptureVideoDataOutput alloc] init];
    output.videoSettings = @{
        (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA)
    };
    output.alwaysDiscardsLateVideoFrames = YES;
    [output setSampleBufferDelegate:self queue:_inferenceQueue];

    if ([session canAddInput:input])   [session addInput:input];
    if ([session canAddOutput:output]) [session addOutput:output];

    // Rotate the pixel buffer to portrait before delivery — without this the buffer
    // arrives in landscape (640×480) regardless of device orientation, causing a 90°
    // mismatch between detection boxes and what the preview layer displays.
    for (AVCaptureConnection *conn in output.connections) {
        if (conn.isVideoOrientationSupported) {
            conn.videoOrientation = AVCaptureVideoOrientationPortrait;
        }
    }

    _session     = session;
    _videoOutput = output;

    [_session startRunning];

    dispatch_async(dispatch_get_main_queue(), ^{
        AVCaptureVideoPreviewLayer *preview = [AVCaptureVideoPreviewLayer layerWithSession:session];
        preview.videoGravity = AVLayerVideoGravityResizeAspectFill;
        preview.frame = self.bounds;
        // Keep preview orientation consistent with the rotated data output buffer.
        if (preview.connection.isVideoOrientationSupported) {
            preview.connection.videoOrientation = AVCaptureVideoOrientationPortrait;
        }
        [self.layer insertSublayer:preview atIndex:0];
        self->_previewLayer = preview;

        if (!self->_readyFired) {
            self->_readyFired = YES;
            if (self->_onReadyViro) {
                self->_onReadyViro(@{});
            }
        }
    });
}

- (void)layoutSubviews {
    [super layoutSubviews];
    _previewLayer.frame = self.bounds;
}

#pragma mark - Provider registration

+ (void)registerInferenceProvider:(VRTInferenceBlock)provider {
    gInferenceProvider = [provider copy];
}

#pragma mark - Model loading

- (BOOL)_loadModel:(NSError **)error {
#if VIRO_ONNXRUNTIME_AVAILABLE
    // Resolve the model file path.
    NSString *modelPath = nil;

    if ([_model hasPrefix:@"file://"] || [_model hasPrefix:@"/"]) {
        modelPath = [_model hasPrefix:@"file://"]
            ? [_model substringFromIndex:7]
            : _model;
    } else {
        // Try bundle root, then common asset subdirectories.
        modelPath = [[NSBundle mainBundle] pathForResource:_model ofType:@"onnx"]
            ?: [[NSBundle mainBundle] pathForResource:_model ofType:@"onnx" inDirectory:@"assets/models"]
            ?: [[NSBundle mainBundle] pathForResource:_model ofType:@"onnx" inDirectory:@"models"];
    }

    if (!modelPath || ![[NSFileManager defaultManager] fileExistsAtPath:modelPath]) {
        if (error) {
            *error = [NSError errorWithDomain:@"VRTObjectDetector"
                                         code:1
                                     userInfo:@{NSLocalizedDescriptionKey:
                                                    [NSString stringWithFormat:@"ONNX model not found: %@. Make sure the .onnx file is added to the Xcode target's Copy Bundle Resources.", _model]}];
        }
        return NO;
    }

    NSError *ortError = nil;
    _ortEnv = [[ORTEnv alloc] initWithLoggingLevel:ORTLoggingLevelWarning error:&ortError];
    if (!_ortEnv || ortError) { if (error) *error = ortError; return NO; }

    ORTSessionOptions *options = [[ORTSessionOptions alloc] initWithError:&ortError];
    if (!options || ortError) { if (error) *error = ortError; return NO; }

    _ortSession = [[ORTSession alloc] initWithEnv:_ortEnv
                                        modelPath:modelPath
                                   sessionOptions:options
                                            error:&ortError];
    if (!_ortSession || ortError) { if (error) *error = ortError; return NO; }

    return YES;
#else
    // ONNX Runtime not linked — camera pipeline runs, inference returns empty.
    return YES;
#endif
}

#pragma mark - AVCaptureVideoDataOutputSampleBufferDelegate

- (void)captureOutput:(AVCaptureOutput *)output
didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer
       fromConnection:(AVCaptureConnection *)connection {

    // Throttle to maxFPS.
    CFTimeInterval now = CACurrentMediaTime();
    CFTimeInterval minInterval = 1.0 / (double)(_maxFPS > 0 ? _maxFPS : kDefaultMaxFPS);
    if ((now - _lastInferenceTime) < minInterval) return;
    _lastInferenceTime = now;

    if (!_modelLoaded) return;

    // Extract pixel buffer and run inference.
    CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (!pixelBuffer) return;

    NSArray<NSDictionary *> *detections = [self _runInferenceOnPixelBuffer:pixelBuffer];

    dispatch_async(dispatch_get_main_queue(), ^{
        if (self->_onDetectionViro) {
            self->_onDetectionViro(@{@"detections": detections});
        }
    });
}

#pragma mark - Preprocessing

// Resize BGRA CVPixelBuffer to 640x640 using vImage, then convert to
// Float32 NCHW [1, 3, 640, 640] normalised to [0, 1].
// Returns nil on failure; caller is responsible for freeing the returned buffer.
- (float *)_preprocessPixelBuffer:(CVPixelBufferRef)pixelBuffer {
    CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

    size_t srcWidth  = CVPixelBufferGetWidth(pixelBuffer);
    size_t srcHeight = CVPixelBufferGetHeight(pixelBuffer);
    size_t srcRowBytes = CVPixelBufferGetBytesPerRow(pixelBuffer);
    void  *srcBaseAddr = CVPixelBufferGetBaseAddress(pixelBuffer);

    // --- Resize BGRA to 640x640 using vImage bilinear ---
    vImage_Buffer srcBuf = {
        .data     = srcBaseAddr,
        .height   = srcHeight,
        .width    = srcWidth,
        .rowBytes = srcRowBytes
    };

    const size_t dstSize = kModelInputSize * kModelInputSize * 4; // BGRA
    uint8_t *resizedBGRA = (uint8_t *)malloc(dstSize);
    if (!resizedBGRA) {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
        return nil;
    }

    vImage_Buffer dstBuf = {
        .data     = resizedBGRA,
        .height   = (vImagePixelCount)kModelInputSize,
        .width    = (vImagePixelCount)kModelInputSize,
        .rowBytes = (size_t)kModelInputSize * 4
    };

    vImage_Error vErr = vImageScale_ARGB8888(&srcBuf, &dstBuf, NULL, kvImageHighQualityResampling);
    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

    if (vErr != kvImageNoError) {
        free(resizedBGRA);
        return nil;
    }

    // --- Convert BGRA uint8 -> Float32 NCHW [1, 3, H, W] normalised to [0,1] ---
    // BGRA channel order: B=0, G=1, R=2, A=3
    const int numPixels = kModelInputSize * kModelInputSize;
    float *nchwBuffer = (float *)malloc(sizeof(float) * 3 * numPixels);
    if (!nchwBuffer) {
        free(resizedBGRA);
        return nil;
    }

    float *rPlane = nchwBuffer + 0 * numPixels;
    float *gPlane = nchwBuffer + 1 * numPixels;
    float *bPlane = nchwBuffer + 2 * numPixels;

    const float inv255 = 1.0f / 255.0f;
    for (int i = 0; i < numPixels; i++) {
        uint8_t b = resizedBGRA[i * 4 + 0];
        uint8_t g = resizedBGRA[i * 4 + 1];
        uint8_t r = resizedBGRA[i * 4 + 2];
        // A channel ignored
        rPlane[i] = (float)r * inv255;
        gPlane[i] = (float)g * inv255;
        bPlane[i] = (float)b * inv255;
    }

    free(resizedBGRA);
    return nchwBuffer; // caller must free()
}

#pragma mark - Inference

// Thin wrapper: preprocess BGRA pixel buffer → run inference.
- (NSArray<NSDictionary *> *)_runInferenceOnPixelBuffer:(CVPixelBufferRef)pixelBuffer {
    float *nchwData = [self _preprocessPixelBuffer:pixelBuffer];
    if (!nchwData) return @[];
    return [self _runInferenceWithNCHW:nchwData];
}

// Core inference method shared by standalone and AR modes.
// Takes ownership of `nchwData` and free()s it before returning.
- (NSArray<NSDictionary *> *)_runInferenceWithNCHW:(float *)nchwData {
    // Priority 1: externally registered provider (react-viro-onnx).
    if (gInferenceProvider) {
        NSString *modelPath = _model;
        if (![modelPath hasPrefix:@"/"] && ![modelPath hasPrefix:@"file://"]) {
            modelPath = [[NSBundle mainBundle] pathForResource:_model ofType:@"onnx"]
                ?: [[NSBundle mainBundle] pathForResource:_model ofType:@"onnx" inDirectory:@"assets/models"]
                ?: [[NSBundle mainBundle] pathForResource:_model ofType:@"onnx" inDirectory:@"models"]
                ?: _model;
        }
        NSArray *result = gInferenceProvider(modelPath, nchwData, kModelInputSize, _confidenceThreshold);
        free(nchwData);
        return [self _mapLabels:result];
    }

#if !VIRO_ONNXRUNTIME_AVAILABLE
    free(nchwData);
    return @[];
#else
    if (!_ortSession) { free(nchwData); return @[]; }

    NSError *ortError = nil;
    NSArray<NSNumber *> *shapeArray = @[@1, @3, @(kModelInputSize), @(kModelInputSize)];
    NSMutableData *inputNSData = [NSMutableData dataWithBytes:nchwData
                                                       length:sizeof(float) * 3 * kModelInputSize * kModelInputSize];
    free(nchwData);

    ORTValue *inputTensor = [ORTValue tensorWithData:inputNSData
                                        elementType:ORTTensorElementDataTypeFloat
                                              shape:shapeArray
                                              error:&ortError];
    if (!inputTensor || ortError) return @[];

    NSDictionary<NSString *, ORTValue *> *outputMap =
        [_ortSession runWithInputs:@{@"images": inputTensor}
                       outputNames:[NSSet setWithObject:@"output0"]
                        runOptions:nil
                             error:&ortError];
    if (!outputMap || ortError) return @[];

    ORTValue *output0 = outputMap[@"output0"];
    if (!output0) return @[];

    NSData *outputData = [output0 tensorDataWithError:&ortError];
    if (!outputData || ortError) return @[];

    const float *outPtr     = (const float *)outputData.bytes;
    const NSInteger nFloats = outputData.length / sizeof(float);
    if (nFloats < kNumProposals * kProposalDim) return @[];

    NSMutableArray<NSDictionary *> *detections = [NSMutableArray array];
    const float scale = 1.0f / (float)kModelInputSize;

    for (int i = 0; i < kNumProposals; i++) {
        const float *p = outPtr + i * kProposalDim;
        float conf = p[kConfOffset];
        if (conf < _confidenceThreshold) continue;

        float x1 = MAX(0.f, MIN(1.f, p[kBBoxOffset+0] * scale));
        float y1 = MAX(0.f, MIN(1.f, p[kBBoxOffset+1] * scale));
        float x2 = MAX(0.f, MIN(1.f, p[kBBoxOffset+2] * scale));
        float y2 = MAX(0.f, MIN(1.f, p[kBBoxOffset+3] * scale));
        float w = x2 - x1, h = y2 - y1;
        if (w <= 0.f || h <= 0.f) continue;

        int classId = (int)p[kClsOffset];
        NSString *label = (classId >= 0 && classId < (int)_categories.count)
            ? _categories[classId]
            : [NSString stringWithFormat:@"%d", classId];

        [detections addObject:@{
            @"label":       label,
            @"confidence":  @(conf),
            @"boundingBox": @{@"x": @(x1), @"y": @(y1), @"width": @(w), @"height": @(h)}
        }];
    }
    return [detections copy];
#endif
}

// Maps numeric labels to category names — only when the label is a bare integer.
// If ViroONNX already returned a named label (e.g. "person" from model metadata),
// this is a no-op so the real name is preserved.
- (NSArray<NSDictionary *> *)_mapLabels:(NSArray<NSDictionary *> *)results {
    if (!_categories.count || !results.count) return results;
    NSMutableArray *out = [NSMutableArray arrayWithCapacity:results.count];
    for (NSDictionary *det in results) {
        NSString *label = det[@"label"];
        // Skip remapping if the label is not purely numeric (already a class name).
        BOOL isNumeric = label.length > 0 &&
            [[NSCharacterSet decimalDigitCharacterSet]
                isSupersetOfSet:[NSCharacterSet characterSetWithCharactersInString:label]];
        if (!isNumeric) { [out addObject:det]; continue; }

        int classId = label.intValue;
        if (classId >= 0 && classId < (int)_categories.count) {
            NSMutableDictionary *m = [det mutableCopy];
            m[@"label"] = _categories[classId];
            [out addObject:m];
        } else {
            [out addObject:det];
        }
    }
    return [out copy];
}

// When mode="text", keep only detections whose label appears in _categories.
// This gives text-mode filtering on top of the prompt-free LVIS model:
// ViroONNX returns LVIS class names; we keep only the ones the user requested.
- (NSArray<NSDictionary *> *)_filterByCategories:(NSArray<NSDictionary *> *)results {
    if (![_mode isEqualToString:@"text"] || !_categories.count || !results.count) {
        return results;
    }
    NSSet<NSString *> *wanted = [NSSet setWithArray:_categories];
    NSMutableArray *out = [NSMutableArray array];
    for (NSDictionary *det in results) {
        if ([wanted containsObject:det[@"label"]]) [out addObject:det];
    }
    return [out copy];
}

@end
