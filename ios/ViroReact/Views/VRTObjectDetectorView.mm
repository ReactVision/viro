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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

static const NSInteger kDefaultMaxFPS        = 15;
static const float     kDefaultConfidence    = 0.4f;
static const float     kDefaultIou           = 0.45f;
// Model input size expected by YOLOE (640×640 square).
static const int       kModelInputSize       = 640;

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
    // Try CoreML first (bundle name without extension), then ONNX (absolute path).
    // TODO (Phase 0): replace stub with actual CoreML / ONNX Runtime load call.
    //
    // CoreML path:
    //   NSString *bundlePath = [[NSBundle mainBundle] pathForResource:_model ofType:@"mlpackage"];
    //   NSURL *modelURL = [NSURL fileURLWithPath:bundlePath];
    //   _mlModel = [MLModel modelWithContentsOfURL:modelURL error:error];
    //   return _mlModel != nil;
    //
    // ONNX Runtime path:
    //   _ortSession = [ORTSession sessionWithModelPath:_model error:error];
    //   return _ortSession != nil;

    // Stub: always succeeds so the camera pipeline can be validated independently.
    return YES;
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

#pragma mark - Inference

- (NSArray<NSDictionary *> *)_runInferenceOnPixelBuffer:(CVPixelBufferRef)pixelBuffer {
    // TODO (Phase 0): Replace stub with actual YOLOE inference.
    //
    // Pipeline:
    //   1. Lock pixel buffer and get raw BGRA bytes.
    //   2. Resize to kModelInputSize × kModelInputSize (letterbox, preserve aspect).
    //   3. Convert BGRA → RGB, normalize to [0,1] float32.
    //   4. Run CoreML / ONNX Runtime inference.
    //   5. Post-process: decode anchors, apply confidence filter, run NMS.
    //   6. Map bounding boxes back to original image coordinates (normalized [0,1]).
    //   7. Return array of detection dicts.
    //
    // Each detection dict shape:
    //   @{
    //     @"label":      @"chair",
    //     @"confidence": @(0.87),
    //     @"boundingBox": @{
    //       @"x": @(0.1), @"y": @(0.2),
    //       @"width": @(0.3), @"height": @(0.4)
    //     }
    //   }

    // Stub: return empty array until model is wired in.
    return @[];
}

@end
