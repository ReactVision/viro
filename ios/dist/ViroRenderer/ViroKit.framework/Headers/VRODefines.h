//
//  VRODefines.h
//  ViroRenderer
//
//  Created by Raj Advani on 11/1/16.
//  Copyright © 2016 Viro Media. All rights reserved.
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

#ifndef VRODefines_h
#define VRODefines_h

// ── Platform detection ────────────────────────────────────────────────────────
//
// Supports five compilation environments:
//   ObjC / ObjC++ on Apple  (iOS, visionOS, macOS)
//   Plain C++ on Apple      (same target, non-.mm files)
//   WebAssembly (Emscripten)
//   Android (NDK)

#if defined(__OBJC__) || defined(__APPLE__)

#include <TargetConditionals.h>

#if TARGET_OS_VISION
  #define VRO_PLATFORM_ANDROID 0
  #define VRO_PLATFORM_IOS     0
  #define VRO_PLATFORM_VISION  1
  #define VRO_PLATFORM_WASM    0
  #define VRO_PLATFORM_MACOS   0

#elif TARGET_IPHONE_SIMULATOR || TARGET_OS_IPHONE
  #define VRO_PLATFORM_ANDROID 0
  #define VRO_PLATFORM_IOS     1
  #define VRO_PLATFORM_VISION  0
  #define VRO_PLATFORM_WASM    0
  #define VRO_PLATFORM_MACOS   0

#else
  // macOS (or any other Apple platform)
  #define VRO_PLATFORM_ANDROID 0
  #define VRO_PLATFORM_IOS     0
  #define VRO_PLATFORM_VISION  0
  #define VRO_PLATFORM_WASM    0
  #define VRO_PLATFORM_MACOS   1
#endif

#elif defined(WASM_PLATFORM)
  #define VRO_PLATFORM_ANDROID 0
  #define VRO_PLATFORM_IOS     0
  #define VRO_PLATFORM_VISION  0
  #define VRO_PLATFORM_WASM    1
  #define VRO_PLATFORM_MACOS   0

  #define VRO_C_INCLUDE "VROWasmCAPI.h"

#else
  // Android / NDK
  #define VRO_PLATFORM_ANDROID 1
  #define VRO_PLATFORM_IOS     0
  #define VRO_PLATFORM_VISION  0
  #define VRO_PLATFORM_WASM    0
  #define VRO_PLATFORM_MACOS   0

  #define VRO_C_INCLUDE "VROAndroidCAPI.h"
#endif

// ── VRO_METAL ─────────────────────────────────────────────────────────────────
//
// Default to 0.  The ViroKitVisionOS (and ViroKit iOS Metal) Xcode targets pass
// -DVRO_METAL=1 via GCC_PREPROCESSOR_DEFINITIONS.  Using #ifndef lets that
// build-system flag take effect instead of being clobbered by this header.
#ifndef VRO_METAL
  #define VRO_METAL 0
#endif

// ── VRO_POSEMOJI ─────────────────────────────────────────────────────────────
#define VRO_POSEMOJI 1

#endif /* VRODefines_h */
