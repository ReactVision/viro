//
//  VROARHitTestResultiOS.h
//  ViroKit
//
//  Copyright © 2026 Viro Media. All rights reserved.
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

#ifndef VROARHitTestResultiOS_h
#define VROARHitTestResultiOS_h

#include "VROARHitTestResult.h"
#include <memory>

#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 110000
#import <Foundation/Foundation.h>
#import <ARKit/ARKit.h>

class VROARSessioniOS;

/**
 * iOS-specific hit test result that wraps ARKit's ARHitTestResult
 * and provides anchor creation functionality.
 */
class API_AVAILABLE(ios(11.0)) VROARHitTestResultiOS :
    public VROARHitTestResult,
    public std::enable_shared_from_this<VROARHitTestResultiOS> {

public:
    /**
     * Create an iOS hit test result.
     *
     * @param type The type of hit result.
     * @param anchor Associated anchor (may be nullptr).
     * @param distance Distance from camera to hit point.
     * @param worldTransform Transform in world coordinates.
     * @param localTransform Transform in local coordinates.
     * @param nativeResult The native ARHitTestResult from ARKit.
     * @param session Reference to the AR session.
     */
    VROARHitTestResultiOS(VROARHitTestResultType type,
                          std::shared_ptr<VROARAnchor> anchor,
                          float distance,
                          VROMatrix4f worldTransform,
                          VROMatrix4f localTransform,
                          ARHitTestResult *nativeResult,
                          std::shared_ptr<VROARSessioniOS> session);

    virtual ~VROARHitTestResultiOS();

    /**
     * Get the native ARKit hit test result.
     */
    ARHitTestResult *getNativeResult() const {
        return _nativeResult;
    }

    /**
     * Create an AR anchor at the position of this hit result and add it
     * to the AR session for continued tracking.
     *
     * This method creates an ARAnchor using the hit result's world transform,
     * adds it to the ARKit session, wraps it in VROARAnchor, and attaches it
     * to a new VROARNode.
     *
     * If tracking is limited or anchor creation fails, returns nullptr.
     *
     * Thread-safe: Can be called from the application thread.
     *
     * @return New VROARNode with attached anchor, or nullptr on failure.
     */
    std::shared_ptr<VROARNode> createAnchoredNodeAtHitLocation();

private:
    /**
     * The native ARKit hit test result.
     * Owned by this object (strong reference).
     */
    ARHitTestResult *__strong _nativeResult;

    /**
     * Weak reference to the AR session for adding anchors.
     */
    std::weak_ptr<VROARSessioniOS> _session;
};

#endif // __IPHONE_OS_VERSION_MAX_ALLOWED >= 110000
#endif // VROARHitTestResultiOS_h
