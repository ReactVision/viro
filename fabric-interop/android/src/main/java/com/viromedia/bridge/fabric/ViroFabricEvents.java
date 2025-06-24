//  Copyright © 2025 ReactVision. All rights reserved.
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

package com.viromedia.bridge.fabric;

/**
 * Event constants for the Viro Fabric interop layer.
 * These events are compatible with the existing ViroEvents but use the Fabric naming convention.
 */
public class ViroFabricEvents {
    // Core interaction events
    public static final String ON_HOVER = "onHoverViro";
    public static final String ON_CLICK = "onClickViro";
    public static final String ON_TOUCH = "onTouchViro";
    public static final String ON_SWIPE = "onSwipeViro";
    public static final String ON_SCROLL = "onScrollViro";
    public static final String ON_DRAG = "onDragViro";
    public static final String ON_FUSE = "onFuseViro";
    public static final String ON_PINCH = "onPinchViro";
    public static final String ON_ROTATE = "onRotateViro";
    
    // Animation events
    public static final String ON_ANIMATION_START = "onAnimationStartViro";
    public static final String ON_ANIMATION_FINISH = "onAnimationFinishViro";
    
    // Loading events
    public static final String ON_LOAD_START = "onLoadStartViro";
    public static final String ON_LOAD_END = "onLoadEndViro";
    public static final String ON_ERROR = "onErrorViro";
    
    // Video events
    public static final String ON_UPDATE_TIME = "onUpdateTimeViro";
    public static final String ON_BUFFER_START = "onBufferStartViro";
    public static final String ON_BUFFER_END = "onBufferEndViro";
    
    // Physics events
    public static final String ON_COLLIDED = "onCollisionViro";
    public static final String ON_TRANSFORM_DELEGATE = "onNativeTransformDelegateViro";
    
    // AR events
    public static final String ON_TRACKING_UPDATED = "onTrackingUpdatedViro";
    public static final String ON_AMBIENT_LIGHT_UPDATE = "onAmbientLightUpdateViro";
    public static final String ON_ANCHOR_FOUND = "onAnchorFoundViro";
    public static final String ON_ANCHOR_UPDATED = "onAnchorUpdatedViro";
    public static final String ON_ANCHOR_REMOVED = "onAnchorRemovedViro";
    public static final String ON_CAMERA_AR_HIT_TEST_VIRO = "onCameraARHitTestViro";
    public static final String ON_AR_POINT_CLOUD_UPDATE = "onARPointCloudUpdateViro";
    public static final String ON_CAMERA_TRANSFORM_UPDATE = "onCameraTransformUpdateViro";
    
    // Portal events
    public static final String ON_PORTAL_ENTER = "onPortalEnterViro";
    public static final String ON_PORTAL_EXIT = "onPortalExitViro";
    
    // Platform events
    public static final String ON_PLATFORM_UPDATE = "onPlatformUpdateViro";
    public static final String ON_CONTROLLER_STATUS = "onControllerStatusViro";
    public static final String ON_EXIT_VIRO = "onExitViro";
    
    // Container-specific events
    public static final String ON_INITIALIZED = "onInitialized";
    public static final String ON_TRACKING_UPDATED_FABRIC = "onTrackingUpdated";
    public static final String ON_CAMERA_TRANSFORM_UPDATE_FABRIC = "onCameraTransformUpdate";
}
