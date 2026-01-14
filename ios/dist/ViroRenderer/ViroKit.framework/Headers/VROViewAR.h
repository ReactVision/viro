//
//  VROViewAR.h
//  ViroRenderer
//
//  Created by Raj Advani on 5/31/17.
//  Copyright © 2017 Viro Media. All rights reserved.
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

#import <Foundation/Foundation.h>
#import <GLKit/GLKit.h>
#import "VROView.h"
#import "VROARSession.h"
#import "VROARHitTestResult.h"

class VROARSessionDelegate;
class VRORendererConfiguration;
class VROViewport;
enum class VROCameraPosition;

@protocol VRODebugDrawDelegate
@required
- (void)drawRect;
@end

@interface VROGlassView : UIView
@property (readwrite, nonatomic, assign) NSObject<VRODebugDrawDelegate> *debugDrawDelegate;
- (id)initWithFrame:(CGRect)frame delegate:(NSObject<VRODebugDrawDelegate> *)delegate;
@end

@interface VROViewAR : GLKView <VROView, UIGestureRecognizerDelegate>

@property (readwrite, nonatomic) BOOL suspended;
@property (readwrite, nonatomic) VROViewRecorder *viewRecorder;

/*
 The camera used for AR (front or back).
 */
@property (readonly, nonatomic) VROCameraPosition cameraPosition;

- (instancetype)initWithFrame:(CGRect)frame
                       config:(VRORendererConfiguration)config
                      context:(EAGLContext *)context
               worldAlignment:(VROWorldAlignment)worldAlignment;

- (instancetype)initWithFrame:(CGRect)frame
                       config:(VRORendererConfiguration)config
                      context:(EAGLContext *)context
               worldAlignment:(VROWorldAlignment)worldAlignment
                 trackingType:(VROTrackingType)trackingType;

- (void)setARSessionDelegate:(std::shared_ptr<VROARSessionDelegate>)delegate;

/*
 Manually overrides renderer's viewport parameters with a different width and
 height, instead of using the dimensions of the underlying GLView. Note that
 this only affects dimenions used for the rendering pipeline.
 */
- (void)setRenderedFrameViewPort:(VROViewport)viewport;

/*
 Should be invoked before this object gets deallocated, to clean up GL
 resources on the rendering thread before the underlying EAGLContext used
 by this view is destroyed. This is required to prevent deadlocks in
 CVOpenGLTextureCache, which hangs on dealloc if the EAGLContext it's using
 is already gone.
 */
- (void)deleteGL;

/*
 Sets the paused state of the underlying CADisplayLink
 */
- (void)setPaused:(BOOL)paused;

/*
 Performs an AR hit test with the given ray assuming origin is the camera
 */
- (std::vector<std::shared_ptr<VROARHitTestResult>>)performARHitTest:(VROVector3f)ray;

/*
 Performs an AR hit test with the given 2D point on the screen
 */
- (std::vector<std::shared_ptr<VROARHitTestResult>>)performARHitTestWithPoint:(int)x y:(int)y;

/*
 Returns the ARSession
 */
- (std::shared_ptr<VROARSession>)getARSession;

/*
 Returns true if AR is supported by this device.
 */
+ (BOOL)isARSupported;

/*
 Set a view for drawing debug information using CoreGraphics.
 */
- (void)setDebugDrawDelegate:(NSObject<VRODebugDrawDelegate> *)debugDrawDelegate;

/*
 Enable or disable depth debug visualization. When enabled, the depth texture
 from ARKit will be rendered as a color overlay on the camera feed:
 - Red = close objects (0-1 meters)
 - Yellow = medium distance (1-3 meters)
 - Green = medium-far (3-5 meters)
 - Cyan = far (5-10 meters)
 - Blue = very far (10+ meters)
 - Black = no depth data

 @param enabled Whether to enable depth debug visualization
 @param opacity The opacity of the depth overlay (0.0 = camera only, 1.0 = depth only)
 */
- (void)setDepthDebugEnabled:(BOOL)enabled opacity:(float)opacity;

#pragma mark - Monocular Depth Estimation

/*
 Enable or disable monocular depth estimation for devices without LiDAR.
 When enabled, the system will use a neural network to estimate depth from
 the camera image. This provides depth-based occlusion on older devices.

 Note: The depth model must be bundled with the app as DepthPro.mlmodelc.

 @param enabled Whether to enable monocular depth estimation
 */
- (void)setMonocularDepthEnabled:(BOOL)enabled;

/*
 Check if monocular depth estimation is supported on this device.
 Requires iOS 14.0+ and sufficient GPU/Neural Engine capabilities.

 @return YES if supported, NO otherwise
 */
- (BOOL)isMonocularDepthSupported;

/*
 Check if the monocular depth model is available (bundled in framework or app).

 @return YES if the model is available, NO otherwise
 */
- (BOOL)isMonocularDepthModelAvailable;

/*
 When enabled, monocular depth estimation will be used even on devices with LiDAR.
 This allows using the neural network-based depth on all devices for:
 - Consistency across device types
 - Testing/comparison purposes
 - Getting depth estimates beyond LiDAR's ~5m range

 Default is NO (LiDAR is preferred when available).

 @param prefer Whether to prefer monocular depth over LiDAR
 */
- (void)setPreferMonocularDepth:(BOOL)prefer;

/*
 Check if monocular depth is preferred over LiDAR.

 @return YES if monocular depth is preferred, NO otherwise
 */
- (BOOL)isPreferMonocularDepth;

@end
