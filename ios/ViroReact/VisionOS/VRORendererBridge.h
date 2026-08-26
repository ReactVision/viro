// VRORendererBridge.h
// ViroReact — VisionOS
//
// Objective-C wrapper around VRORenderer + VRODriverVisionOS.
// Swift code calls this bridge to drive the Viro 3D scene from inside
// a CompositorServices render loop.
//
// Usage per-frame (inside ViroImmersiveRenderer.renderFrame()):
//
//   1. Call -prepareFrameWithViewIndex:0 colorTexture:... viewTransform:... tangents:...
//      once per frame (left-eye data drives VRORenderer::prepareFrame).
//
//   2. Call -setFrameCommandBuffer: with the frame's command buffer.
//
//   3. For each eye (0 = left, 1 = right):
//        a. Build a MTLRenderPassDescriptor with the eye's color + depth textures.
//        b. Call -renderEyeWithViewIndex:i renderPassDescriptor:... colorTexture:... ...
//
//      The renderer opens and closes the render command encoder itself. Do not
//      create one: Metal allows a single render command encoder per command buffer
//      at a time, and the renderer needs to interleave offscreen passes (bloom,
//      shadows, tone mapping) with the display pass, which means ending and
//      reopening the display encoder mid-eye.
//
//   4. Call -setFrameCommandBuffer:nil, then -endFrame
//
// Scene loading:
//   The bridge starts with a hardcoded red-box test scene.  Connect your React
//   Native scene controller by calling -setNativeSceneController: from ObjC/Swift.

#pragma once

#if __has_include(<CompositorServices/CompositorServices.h>)

#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <simd/simd.h>

NS_ASSUME_NONNULL_BEGIN

@interface VRORendererBridge : NSObject

/// Designated initialiser.  Pass the MTLDevice from the LayerRenderer.
- (instancetype)initWithDevice:(id <MTLDevice>)device NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

/// The bridge currently driving the ImmersiveSpace, or nil if none is open.
///
/// There is exactly one at a time: ViroImmersiveRenderer creates it when the space opens and
/// releases it when the space closes. The React Native side needs a way to reach that instance
/// from a view manager that never sees the Swift renderer, and this is it. Set in
/// -initWithDevice: and cleared on dealloc.
///
/// Declared here rather than in VRORendererBridge+Scene.h because it names no C++ type — this
/// header is imported by Swift, which compiles it as plain Objective-C.
@property (class, nonatomic, readonly, nullable) VRORendererBridge *currentBridge;

/// Closes any render command encoder the renderer still has open, and reports whether there
/// was one.
///
/// CompositorServices aborts the process from cp_drawable_encode_present if the command buffer
/// handed to it still has an encoder open — as __BUG_IN_CLIENT__, with no message naming the
/// cause. The render loop calls this immediately before presenting so that a pass which returns
/// without closing its encoder costs a log line instead of a crash.
- (BOOL)endAnyOpenEncoder;

/// Call once per frame before the per-eye loop, using left-eye data (view index 0).
/// Drives VRORenderer::prepareFrame() — updates physics, animations, and visibility.
/// @param viewIndex    Typically 0 (left eye).
/// @param colorTexture The eye's colour render-target (used only for its dimensions here).
/// @param viewTransform The device-anchor → eye-space transform from CompositorServices.
/// @param tangents     Frustum half-angle tangents (left, right, up, down).
- (void)prepareFrameWithViewIndex:(NSUInteger)viewIndex
                     colorTexture:(id <MTLTexture>)colorTexture
                    viewTransform:(simd_float4x4)viewTransform
                         tangents:(simd_float4)tangents;

/// The command buffer for the frame about to be rendered. Every render command
/// encoder, the display pass included, is opened from it by the renderer. Pass nil
/// after the last eye, before -endFrame.
- (void)setFrameCommandBuffer:(nullable id <MTLCommandBuffer>)commandBuffer;

/// Call once per eye.  Opens the display render pass, invokes VRORenderer::renderEye(),
/// then ends the pass.  The caller must NOT create or end an encoder itself.
/// @param viewIndex    0 = left eye, 1 = right eye.
/// @param renderPass   Descriptor for the eye's colour + depth textures. Store actions
///                     must be .store — CompositorServices needs stored depth for
///                     late-stage reprojection.
/// @param colorTexture The eye's colour render-target (used for dimensions and pixel format).
/// @param depthTexture The eye's depth render-target (used for pixel format).
/// @param viewTransform The device-anchor → eye-space transform from CompositorServices.
/// @param tangents     Frustum half-angle tangents (left, right, up, down).
- (void)renderEyeWithViewIndex:(NSUInteger)viewIndex
          renderPassDescriptor:(MTLRenderPassDescriptor *)renderPass
                  colorTexture:(id <MTLTexture>)colorTexture
                  depthTexture:(id <MTLTexture>)depthTexture
                 viewTransform:(simd_float4x4)viewTransform
                      tangents:(simd_float4)tangents;

/// Call after all eyes have been rendered.  Drives VRORenderer::endFrame().
/*
 Per-frame hand input. Sampled once per frame in the Swift layer so both eyes see the same
 pointer state. A hand the tracker has lost arrives with valid = NO, which stops its ray
 being dispatched at all rather than leaving it hovering wherever it was last seen.

 Origin and forward are in world space; forward is expected normalised.
 */
- (void)updateHandsWithLeftValid:(BOOL)leftValid
                      leftOrigin:(simd_float3)leftOrigin
                     leftForward:(simd_float3)leftForward
                    leftPinching:(BOOL)leftPinching
                      rightValid:(BOOL)rightValid
                     rightOrigin:(simd_float3)rightOrigin
                    rightForward:(simd_float3)rightForward
                   rightPinching:(BOOL)rightPinching;

- (void)endFrame;

/// Turn frame timing on. Off by default because it costs a counter sample buffer and a
/// completion handler per frame. When on, a report is logged every 300 frames giving the
/// distribution of GPU and CPU time against the 90 Hz budget, broken down per render pass
/// where the device supports stage-boundary counter sampling.
///
/// This is how the M4 frame-time budget gets measured: enable it, run on device, read the log.
- (void)setFrameTimingEnabled:(BOOL)enabled;

@end

NS_ASSUME_NONNULL_END

#endif  // CompositorServices available
