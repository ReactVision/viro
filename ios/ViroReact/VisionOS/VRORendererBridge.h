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
//   2. For each eye (0 = left, 1 = right):
//        a. Create MTLRenderPassDescriptor with the eye's color + depth textures.
//        b. Create a MTLRenderCommandEncoder from that descriptor.
//        c. Call -renderEyeWithViewIndex:i encoder:... colorTexture:... viewTransform:... tangents:...
//        d. Call [encoder endEncoding].
//
//   3. Call -endFrame
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

/// Call once per eye.  Sets the encoder on the driver, invokes VRORenderer::renderEye(),
/// then clears the encoder.  The caller is responsible for calling [encoder endEncoding].
/// @param viewIndex    0 = left eye, 1 = right eye.
/// @param encoder      Active MTLRenderCommandEncoder targeting the eye's textures.
/// @param colorTexture The eye's colour render-target (used for dimensions and pixel format).
/// @param depthTexture The eye's depth render-target (used for pixel format).
/// @param viewTransform The device-anchor → eye-space transform from CompositorServices.
/// @param tangents     Frustum half-angle tangents (left, right, up, down).
- (void)renderEyeWithViewIndex:(NSUInteger)viewIndex
                       encoder:(id <MTLRenderCommandEncoder>)encoder
                  colorTexture:(id <MTLTexture>)colorTexture
                  depthTexture:(id <MTLTexture>)depthTexture
                 viewTransform:(simd_float4x4)viewTransform
                      tangents:(simd_float4)tangents;

/// Call after all eyes have been rendered.  Drives VRORenderer::endFrame().
- (void)endFrame;

@end

NS_ASSUME_NONNULL_END

#endif  // CompositorServices available
