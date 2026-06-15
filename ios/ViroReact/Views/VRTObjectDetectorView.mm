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
// Implementation
// ---------------------------------------------------------------------------

@implementation VRTObjectDetectorView {
    // Capture session — owns its own session independent of ViroCameraTexture.
    AVCaptureSession            *_session;
    AVCaptureVideoDataOutput    *_videoOutput;
    dispatch_queue_t             _inferenceQueue;

    // Throttle: track the last time inference ran.
    CFTimeInterval               _lastInferenceTime;

    // Guards one-shot onReadyViro emission.
    BOOL                         _readyFired;

    // Whether the session is running and the model is loaded.
    BOOL                         _modelLoaded;

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
        _lastInferenceTime   = 0;
        _readyFired          = NO;
        _modelLoaded         = NO;

        _inferenceQueue = dispatch_queue_create("com.reactvision.objectdetector", DISPATCH_QUEUE_SERIAL);
    }
    return self;
}

- (void)dealloc {
    [self _stopSession];
}

#pragma mark - React lifecycle

- (void)didMoveToWindow {
    [super didMoveToWindow];
    if (self.window) {
        [self _startSession];
    } else {
        [self _stopSession];
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

    _session     = session;
    _videoOutput = output;

    [_session startRunning];

    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self->_readyFired) {
            self->_readyFired = YES;
            if (self->_onReadyViro) {
                self->_onReadyViro(@{});
            }
        }
    });
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
        modelPath = [[NSBundle mainBundle] pathForResource:_model ofType:@"onnx"];
    }

    if (!modelPath || ![[NSFileManager defaultManager] fileExistsAtPath:modelPath]) {
        if (error) {
            *error = [NSError errorWithDomain:@"VRTObjectDetector"
                                         code:1
                                     userInfo:@{NSLocalizedDescriptionKey:
                                                    [NSString stringWithFormat:@"ONNX model not found: %@", _model]}];
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

- (NSArray<NSDictionary *> *)_runInferenceOnPixelBuffer:(CVPixelBufferRef)pixelBuffer {
#if !VIRO_ONNXRUNTIME_AVAILABLE
    return @[];
#else
    if (!_ortSession) return @[];

    // 1. Preprocess: BGRA -> Float32 NCHW 640x640
    float *inputData = [self _preprocessPixelBuffer:pixelBuffer];
    if (!inputData) return @[];

    // 2. Build ORT input tensor
    NSError *ortError = nil;
    const int64_t inputShape[] = {1, 3, kModelInputSize, kModelInputSize};
    NSArray<NSNumber *> *shapeArray = @[@1, @3, @(kModelInputSize), @(kModelInputSize)];

    NSMutableData *inputNSData = [NSMutableData dataWithBytes:inputData
                                                       length:sizeof(float) * 3 * kModelInputSize * kModelInputSize];
    free(inputData);

    ORTValue *inputTensor = [ORTValue tensorWithData:inputNSData
                                        elementType:ORTTensorElementDataTypeFloat
                                              shape:shapeArray
                                              error:&ortError];
    if (!inputTensor || ortError) return @[];

    // 3. Run inference
    NSArray<NSString *> *inputNames  = @[@"images"];
    NSArray<NSString *> *outputNames = @[@"output0"];
    NSDictionary<NSString *, ORTValue *> *inputMap = @{@"images": inputTensor};

    NSDictionary<NSString *, ORTValue *> *outputMap =
        [_ortSession runWithInputs:inputMap
                       outputNames:[NSSet setWithArray:outputNames]
                       runOptions:nil
                             error:&ortError];

    if (!outputMap || ortError) return @[];

    ORTValue *output0 = outputMap[@"output0"];
    if (!output0) return @[];

    // 4. Extract raw float data from output tensor
    // Expected shape: [1, 300, 38]
    NSData *outputData = [output0 tensorDataWithError:&ortError];
    if (!outputData || ortError) return @[];

    const float *outPtr = (const float *)outputData.bytes;
    const NSInteger totalFloats = outputData.length / sizeof(float);
    if (totalFloats < kNumProposals * kProposalDim) return @[];

    // 5. Parse detections
    NSMutableArray<NSDictionary *> *detections = [NSMutableArray array];
    const float scale = 1.0f / (float)kModelInputSize;

    for (int i = 0; i < kNumProposals; i++) {
        const float *proposal = outPtr + i * kProposalDim;

        float conf = proposal[kConfOffset];
        if (conf < _confidenceThreshold) continue;

        float x1 = proposal[kBBoxOffset + 0] * scale;
        float y1 = proposal[kBBoxOffset + 1] * scale;
        float x2 = proposal[kBBoxOffset + 2] * scale;
        float y2 = proposal[kBBoxOffset + 3] * scale;

        // Clamp to [0, 1]
        x1 = MAX(0.0f, MIN(1.0f, x1));
        y1 = MAX(0.0f, MIN(1.0f, y1));
        x2 = MAX(0.0f, MIN(1.0f, x2));
        y2 = MAX(0.0f, MIN(1.0f, y2));

        float width  = x2 - x1;
        float height = y2 - y1;
        if (width <= 0.0f || height <= 0.0f) continue;

        int classId = (int)proposal[kClsOffset];
        NSString *label = [NSString stringWithFormat:@"%d", classId];

        NSDictionary *bbox = @{
            @"x":      @(x1),
            @"y":      @(y1),
            @"width":  @(width),
            @"height": @(height)
        };

        [detections addObject:@{
            @"label":       label,
            @"confidence":  @(conf),
            @"boundingBox": bbox
        }];
    }

    return [detections copy];
#endif // VIRO_ONNXRUNTIME_AVAILABLE
}

@end
