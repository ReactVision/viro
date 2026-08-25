//
//  VRORendererBridge+Scene.h
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  The scene-handoff half of VRORendererBridge, kept apart from the main header because it
//  names C++ types. VRORendererBridge.h is imported by ViroReactUI's Swift, and Swift builds it
//  as a Clang module in plain Objective-C mode, where <memory> and VROSceneController do not
//  parse. Only the Objective-C++ side of ViroReact — the view managers — needs what is here.
//

#pragma once

#if __has_include(<CompositorServices/CompositorServices.h>)

#import "VRORendererBridge.h"

#include <memory>

class VROSceneController;

NS_ASSUME_NONNULL_BEGIN

@interface VRORendererBridge (Scene)

/// Hands a scene built by React Native to the renderer, replacing whatever it was showing.
///
/// The bridge starts on a small hardcoded scene so the ImmersiveSpace is never empty while the
/// JS side is still mounting — and so the renderer stays independently testable without React.
/// The first call here takes over from it.
///
/// Passing nullptr is not a way to clear the scene; the renderer always needs one.
- (void)setNativeSceneController:(std::shared_ptr<VROSceneController>)sceneController;

@end

NS_ASSUME_NONNULL_END

#endif  // __has_include(<CompositorServices/CompositorServices.h>)
