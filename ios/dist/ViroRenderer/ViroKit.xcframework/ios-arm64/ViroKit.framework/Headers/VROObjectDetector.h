//
//  VROObjectDetector.h
//  ViroRenderer
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

#ifndef VROObjectDetector_h
#define VROObjectDetector_h

#include <string>
#include <vector>
#include <functional>
#include <memory>

/*
 Bounding box in normalized image space [0, 1].
 Origin is top-left corner of the image.
 */
struct VRODetectionBoundingBox {
    float x;       // left edge
    float y;       // top edge
    float width;
    float height;
};

struct VRODetectedObject {
    std::string label;
    float confidence;
    VRODetectionBoundingBox boundingBox;
};

/*
 Inference mode matching YOLOE's three prompting strategies:
 - PromptFree: LRPC head, 4,585 built-in RAM++ categories, no runtime prompt needed.
 - Text:       RepRTA, detect arbitrary categories given a list of text labels.
 - Visual:     SAVPE, detect objects similar to a reference image crop.
 */
enum class VRODetectorMode {
    PromptFree,
    Text,
    Visual,
};

using VRODetectionCallback = std::function<void(const std::vector<VRODetectedObject> &)>;

/*
 Abstract base class for on-device object detectors.

 Platform implementations (iOS: CoreML / ONNX Runtime, Android: ONNX Runtime)
 subclass this and implement loadModel() and detectInBuffer(). The bridge layer
 owns the camera pipeline and calls detectInBuffer() on each sampled frame.
 */
class VROObjectDetector {
public:
    virtual ~VROObjectDetector() {}

    /*
     Load the model from the given path.
     On iOS:     path to a .mlpackage (CoreML) or .onnx file.
     On Android: path to a .onnx file inside the app's assets or files dir.
     Returns true on success.
     */
    virtual bool loadModel(const std::string &modelPath) = 0;

    /*
     Run detection on a raw RGB pixel buffer.
     - pixels:  pointer to contiguous RGB888 data (row-major)
     - width / height: image dimensions in pixels
     Results are delivered asynchronously via the detection callback.
     */
    virtual void detectInBuffer(const uint8_t *pixels, int width, int height) = 0;

    // --- configuration (call before loadModel or between frames) ---

    void setMode(VRODetectorMode mode) {
        _mode = mode;
    }

    /*
     Text categories for Text mode (e.g. {"chair", "person", "laptop"}).
     Ignored in PromptFree and Visual modes.
     */
    void setCategories(const std::vector<std::string> &categories) {
        _categories = categories;
    }

    void setConfidenceThreshold(float threshold) {
        _confidenceThreshold = threshold;
    }

    /*
     NMS IoU threshold used during post-processing.
     */
    void setIouThreshold(float threshold) {
        _iouThreshold = threshold;
    }

    void setCallback(VRODetectionCallback callback) {
        _callback = callback;
    }

    VRODetectorMode getMode() const { return _mode; }
    float getConfidenceThreshold() const { return _confidenceThreshold; }
    float getIouThreshold() const { return _iouThreshold; }
    const std::vector<std::string> &getCategories() const { return _categories; }

protected:
    VRODetectorMode _mode = VRODetectorMode::PromptFree;
    std::vector<std::string> _categories;
    float _confidenceThreshold = 0.4f;
    float _iouThreshold = 0.45f;
    VRODetectionCallback _callback;
};

#endif /* VROObjectDetector_h */
