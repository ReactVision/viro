// VRORendererBridge.h
// ViroReact — VisionOS
//
// Objective-C wrapper around VRORenderer + VRODriverVisionOS.
// Swift code calls this bridge to drive the Viro 3D scene from inside
// a CompositorServices render loop.
//
// Usage per-frame (inside ViroImmersiveRenderer.renderFrame()):
//
//   1. Call -prepareFrameWithViewIndex:0 drawable:drawable commandBuffer:cb
//      once per frame (passes the left-eye matrices to VRORenderer::prepareFrame).
//
//   2. For each eye (0 = left, 1 = right):
//        a. Create a MTLRenderCommandEncoder for that eye.
//        b. Call -renderEyeWithViewIndex:i
//                 encoder:encoder
//                 drawable:drawable
//                 commandBuffer:cb
//        c. Call [encoder endEncoding]
//
//   3. Call -endFrame
//
// Scene loading:
//   The bridge starts with an empty scene.  Connect your React Native scene
//   controller by calling -setNativeSceneController: from ObjC/Swift.

#pragma once

#if __has_include(<CompositorServices/CompositorServices.h>)

#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <CompositorServices/CompositorServices.h>

NS_ASSUME_NONNULL_BEGIN

@interface VRORendererBridge : NSObject

/// Designated initialiser.  Pass the MTLDevice from the LayerRenderer.
- (instancetype)initWithDevice:(id <MTLDevice>)device NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

/// Call once per frame, before the per-eye loop, using the left-eye drawable view (index 0).
/// This drives VRORenderer::prepareFrame(), which updates physics, animations, and visibility.
- (void)prepareFrameWithViewIndex:(NSUInteger)viewIndex
                         drawable:(LayerRenderer.Drawable *)drawable
                    commandBuffer:(id <MTLCommandBuffer>)commandBuffer;

/// Call once per eye.  Activates the encoder on the driver, invokes
/// VRORenderer::renderEye(), then clears the encoder from the driver.
/// The caller is responsible for calling [encoder endEncoding] after this returns.
- (void)renderEyeWithViewIndex:(NSUInteger)viewIndex
                       encoder:(id <MTLRenderCommandEncoder>)encoder
                      drawable:(LayerRenderer.Drawable *)drawable
                 commandBuffer:(id <MTLCommandBuffer>)commandBuffer;

/// Call after all eyes have been rendered.  Drives VRORenderer::endFrame().
- (void)endFrame;

@end

NS_ASSUME_NONNULL_END

#endif  // CompositorServices available
