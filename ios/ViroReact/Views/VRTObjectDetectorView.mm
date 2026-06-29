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
static const NSInteger kDefaultMaxDetections = 20;
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
// Center-square crop (AR path)
//
// The AR camera frame is a very wide landscape (e.g. 3840x2160 / 16:9). Squishing
// or letterboxing that whole FOV into the square model input leaves objects tiny
// (a 360px-wide letterbox content gives ~2x-smaller objects than a center crop),
// so the detector misses them — whereas the standalone path uses a narrow 4:3 feed
// where objects fill the frame and detect fine.
//
// Instead we crop the centre square (side = min(srcW, srcH)) and feed that to the
// model: objects keep their aspect ratio AND stay large (the central scene fills
// the 640x640 input). The centre square is also roughly what the portrait screen
// shows under aspectFill, so detections line up with the visible region. Both the
// preprocessor and the coordinate mapper recompute this identically from the frame
// dimensions, so they stay in sync without threading state.
// ---------------------------------------------------------------------------

typedef struct {
    float side;     // side length of the centre square crop (px, in source space)
    float cropX0;   // left edge of the crop in the source frame (px)
    float cropY0;   // top  edge of the crop in the source frame (px)
} VROCenterCrop;

static inline VROCenterCrop VROCenterCropCompute(size_t srcW, size_t srcH) {
    const float side = (float)MIN(srcW, srcH);
    VROCenterCrop c;
    c.side   = side;
    c.cropX0 = ((float)srcW - side) * 0.5f;
    c.cropY0 = ((float)srcH - side) * 0.5f;
    return c;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

@implementation VRTObjectDetectorView {
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

    // Reused NCHW buffer (3·640·640 floats), allocated once. Only the inference queue
    // touches it, and the atomic guard ensures a single inference at a time, so reusing
    // it across frames is safe and avoids a ~4.7 MB malloc/free per frame.
    float                       *_nchwBuffer;

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
        _maxDetections       = kDefaultMaxDetections;
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
        _nchwBuffer = NULL;
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:kVROARFrameNotification
                                                  object:nil];
    if (_nchwBuffer) { free(_nchwBuffer); _nchwBuffer = NULL; }
}

#pragma mark - React lifecycle

- (void)didMoveToWindow {
    [super didMoveToWindow];
    if (self.window) {
        [self _startARMode];
    } else {
        [self _stopARMode];
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

- (void)setMaxDetections:(NSInteger)maxDetections {
    _maxDetections = maxDetections;
}

#pragma mark - AR session mode

- (void)_stopARMode {
    _active = NO;
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:kVROARFrameNotification
                                                  object:nil];
    _readyFired  = NO;
    _modelLoaded = NO;
    // ORT sessions kept resident — reloading the ~2GB session on every remount would
    // spike memory and risk an OS kill. Memory is reclaimed when the app terminates.
}

- (void)_startARMode {
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
        return;
    }

    CVPixelBufferRef yuv = snapshot.capturedImage;
    CVPixelBufferRetain(yuv);

    __weak VRTObjectDetectorView *weakSelf = self;
    dispatch_async(_inferenceQueue, ^{
        VRTObjectDetectorView *s = weakSelf; // must assign to strong before any dereference
        if (!s || !s->_active) {
            CVPixelBufferRelease(yuv);
            if (s) atomic_store(&s->_inferenceRunning, false);
            return;
        }

        float *nchw = [s _preprocessARPixelBuffer:yuv];
        CVPixelBufferRelease(yuv);

        if (!nchw) {
            atomic_store(&s->_inferenceRunning, false);
            return;
        }

        NSArray *rawDetections = [s _runInferenceWithNCHW:nchw];

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
    // Reuse the buffer across frames (fixed size). Allocated lazily on the inference
    // queue; freed in dealloc. Safe because only one inference runs at a time.
    if (!_nchwBuffer) {
        _nchwBuffer = (float *)malloc(sizeof(float) * 3 * N2);
        if (!_nchwBuffer) {
            CVPixelBufferUnlockBaseAddress(yuv, kCVPixelBufferLock_ReadOnly);
            return nil;
        }
    }
    float *nchw = _nchwBuffer;

    float *rPlane = nchw + 0 * N2;
    float *gPlane = nchw + 1 * N2;
    float *bPlane = nchw + 2 * N2;

    const float inv255   = 1.0f / 255.0f;
    const size_t cbcrW   = srcW / 2;
    const size_t cbcrH   = srcH / 2;

    // Center-square crop: sample only the central side×side region of the source, so
    // objects stay large and undistorted in the 640×640 input (see VROCenterCrop note).
    const VROCenterCrop crop = VROCenterCropCompute(srcW, srcH);

    // 90° CCW rotation within the crop: model pixel (px,py), normalized (nx,ny), samples
    //   sx = cropX0 + (1 - ny) * (side-1)   — landscape right → portrait top
    //   sy = cropY0 + nx       * (side-1)   — landscape top   → portrait left
    // iPhone back camera delivers landscape where scene-up = landscape-right, so CCW
    // corrects it to portrait. Box coords come back normalized within the crop.
    for (int py = 0; py < N; py++) {
        const float ny = (float)py / (float)(N - 1);

        for (int px = 0; px < N; px++) {
            const int i = py * N + px;
            const float nx = (float)px / (float)(N - 1);

            int sx = (int)(crop.cropX0 + (1.0f - ny) * (crop.side - 1.0f));
            int sy = (int)(crop.cropY0 + nx          * (crop.side - 1.0f));
            if (sx < 0) sx = 0; else if (sx >= (int)srcW) sx = (int)srcW - 1;
            if (sy < 0) sy = 0; else if (sy >= (int)srcH) sy = (int)srcH - 1;
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

    // Map detection boxes to screen pixels using ARKit's own displayTransform.
    //
    // The previous hand-rolled "aspectFill of the full capturedImage" assumption did
    // NOT match what ARKit actually renders: ARKit crops capturedImage to its camera
    // projection FOV, which is generally narrower than a plain aspectFill of the full
    // sensor frame. That mismatch made boxes land offset from the visible objects.
    //
    // displayTransformForOrientation:viewportSize: converts normalized capturedImage
    // coords (landscape, native orientation, top-left origin) to normalized view coords
    // for the current orientation+viewport, accounting for the exact crop ARKit uses.
    CGAffineTransform displayTransform =
        [frame displayTransformForOrientation:UIInterfaceOrientationPortrait
                                 viewportSize:vp];

    // Box coords are normalized within the centre-square crop [0,1]. Invert the crop
    // (recomputed identically to _preprocessARPixelBuffer:) to recover the
    // capturedImage-normalized coords ARKit's displayTransform expects.
    CVPixelBufferRef cap = frame.capturedImage;
    const size_t srcW = CVPixelBufferGetWidth(cap);
    const size_t srcH = CVPixelBufferGetHeight(cap);
    const VROCenterCrop crop = VROCenterCropCompute(srcW, srcH);
    // crop-normalized (nx, ny) → capturedImage-normalized (landscape), inverse of the
    // 90° CCW rotation:  sx = cropX0 + (1-ny)*side,  sy = cropY0 + nx*side.
    CGPoint (^imgCoord)(float, float) = ^CGPoint(float nx, float ny) {
        float sx = crop.cropX0 + (1.0f - ny) * (crop.side - 1.0f);
        float sy = crop.cropY0 + nx          * (crop.side - 1.0f);
        return CGPointMake(sx / (float)(srcW - 1), sy / (float)(srcH - 1));
    };

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

        // --- 2D screenBoundingBox via letterbox-inverse + ARKit displayTransform ---
        // Transform all four corners (the rotation makes a pure scale insufficient) and
        // take the axis-aligned bounding rect in view space.
        const float pxs[4] = { bx, bx + bw, bx,      bx + bw };
        const float pys[4] = { by, by,      by + bh, by + bh };
        CGFloat minX = CGFLOAT_MAX, minY = CGFLOAT_MAX, maxX = -CGFLOAT_MAX, maxY = -CGFLOAT_MAX;
        for (int k = 0; k < 4; k++) {
            CGPoint imgPt  = imgCoord(pxs[k], pys[k]);
            CGPoint viewPt = CGPointApplyAffineTransform(imgPt, displayTransform);
            CGFloat spx = viewPt.x * vp.width;
            CGFloat spy = viewPt.y * vp.height;
            minX = MIN(minX, spx); maxX = MAX(maxX, spx);
            minY = MIN(minY, spy); maxY = MAX(maxY, spy);
        }
        d[@"screenBoundingBox"] = @{
            @"x":      @(minX),
            @"y":      @(minY),
            @"width":  @(maxX - minX),
            @"height": @(maxY - minY)
        };

        // --- worldPosition via ARKit hitTest (optional) ---
        // hitTest takes capturedImage-normalized coords — invert the letterbox on the
        // box centre the same way as the corners above.
        if (_projectToWorld) {
            CGPoint hit = imgCoord(cx, cy);
            float hitX = hit.x;
            float hitY = hit.y;
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

        [out addObject:[d copy]];
    }
    return [out copy];
}

#pragma mark - Session management

// Model/mode prop changes restart the AR pipeline so they take effect without a remount.
- (void)_restartIfRunning {
    if (!self.window) return;
    [self _stopARMode];
    [self _startARMode];
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

#pragma mark - Inference

// Core inference method (AR path).
// `nchwData` is the view-owned reusable buffer (see _nchwBuffer); it is NOT freed here.
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
        // _mapLabels: numeric id → category name; _filterByCategories: when mode="text",
        // keep only requested categories (no-op in prompt-free mode); _capToMax: keep
        // the top-N (results are confidence-sorted by the provider).
        return [self _capToMax:[self _filterByCategories:[self _mapLabels:result]]];
    }

#if !VIRO_ONNXRUNTIME_AVAILABLE
    return @[];
#else
    if (!_ortSession) { return @[]; }

    NSError *ortError = nil;
    NSArray<NSNumber *> *shapeArray = @[@1, @3, @(kModelInputSize), @(kModelInputSize)];
    NSMutableData *inputNSData = [NSMutableData dataWithBytes:nchwData
                                                       length:sizeof(float) * 3 * kModelInputSize * kModelInputSize];

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
    return [self _capToMax:[detections copy]];
#endif
}

// Keeps the first _maxDetections entries (provider returns them confidence-sorted).
- (NSArray<NSDictionary *> *)_capToMax:(NSArray<NSDictionary *> *)results {
    if (_maxDetections > 0 && (NSInteger)results.count > _maxDetections) {
        return [results subarrayWithRange:NSMakeRange(0, (NSUInteger)_maxDetections)];
    }
    return results;
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
    // Word-token matching (case-insensitive). The prompt-free model emits open-vocab
    // labels like "cell phone" / "dining table" / "laptop computer" that rarely equal
    // the requested category strings verbatim. Matching on shared whole words lets
    // "phone"↔"cell phone" and "table"↔"dining table" match, while avoiding substring
    // false positives ("pen" does NOT match "pencil").
    NSCharacterSet *sep = [NSCharacterSet whitespaceAndNewlineCharacterSet];
    NSMutableSet<NSString *> *wantedTokens = [NSMutableSet set];
    for (NSString *cat in _categories) {
        for (NSString *w in [cat.lowercaseString componentsSeparatedByCharactersInSet:sep]) {
            if (w.length) [wantedTokens addObject:w];
        }
    }
    NSMutableArray *out = [NSMutableArray array];
    for (NSDictionary *det in results) {
        NSString *label = [det[@"label"] lowercaseString];
        for (NSString *w in [label componentsSeparatedByCharactersInSet:sep]) {
            if (w.length && [wantedTokens containsObject:w]) {
                [out addObject:det];
                break;
            }
        }
    }
    return [out copy];
}

@end
