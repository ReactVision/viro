# CHANGELOG

## v2.53.0 — 06 March 2026

### Breaking Changes

- **`ViroARSceneNavigator` — `provider` replaces `cloudAnchorProvider` and `geospatialAnchorProvider`**

  The two separate props are merged into a single `provider` prop that controls
  both the cloud anchor and geospatial anchor backends simultaneously.

  **Before:**
  ```tsx
  <ViroARSceneNavigator
    cloudAnchorProvider="reactvision"
    geospatialAnchorProvider="reactvision"
    initialScene={{ scene: MyARScene }}
  />
  ```

  **After:**
  ```tsx
  // provider defaults to "reactvision" — prop can be omitted entirely
  <ViroARSceneNavigator
    initialScene={{ scene: MyARScene }}
  />

  // Or to override:
  <ViroARSceneNavigator
    provider="arcore"
    initialScene={{ scene: MyARScene }}
  />
  ```

  `ViroCloudAnchorProvider` and `ViroGeospatialAnchorProvider` types are now
  deprecated aliases for the new `ViroProvider` type. Remove them from props;
  use `provider` instead. The old types still compile with a deprecation warning
  to ease migration.

- **Expo plugin (`withViro`) — `provider` replaces `cloudAnchorProvider` and `geospatialAnchorProvider`**

  The two separate Expo plugin options are merged into a single `provider` option in
  `app.json`.  The old options are deprecated but still accepted as overrides.

  **Before:**
  ```json
  ["@reactvision/react-viro", {
    "cloudAnchorProvider": "reactvision",
    "geospatialAnchorProvider": "reactvision",
    "rvApiKey": "...",
    "rvProjectId": "..."
  }]
  ```

  **After:**
  ```json
  ["@reactvision/react-viro", {
    "provider": "reactvision",
    "rvApiKey": "...",
    "rvProjectId": "..."
  }]
  ```

  Setting `provider: "arcore"` continues to inject ARCore pods on iOS and force dynamic
  linkage, exactly as `cloudAnchorProvider: "arcore"` did before.
  Setting `provider: "reactvision"` injects location permissions on both platforms
  (previously only triggered when `geospatialAnchorProvider: "reactvision"` was explicit).

- **ViroARPlaneSelector — new architecture (scene-event-driven)**

  The component no longer self-discovers planes through pre-allocated
  `ViroARPlane` detector slots.  You must forward the parent
  `ViroARScene` anchor events to it via a ref:

  ```tsx
  const selectorRef = useRef<ViroARPlaneSelector>(null);

  <ViroARScene
    anchorDetectionTypes={["PlanesHorizontal", "PlanesVertical"]}
    onAnchorFound={(a)   => selectorRef.current?.handleAnchorFound(a)}
    onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(a)}
    onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}
  >
    <ViroARPlaneSelector ref={selectorRef} alignment="Both" onPlaneSelected={...}>
      <MyContent />
    </ViroARPlaneSelector>
  </ViroARScene>
  ```

  The old self-contained usage (no ref, no anchor wiring) no longer works.

### Added

- **`gpsToArWorld(devicePose, lat, lng, alt)` utility** — converts a GPS coordinate to an
  AR world-space `[x, y, z]` offset from the device's current geospatial pose. Uses
  Mercator projection + compass heading. Available in `@reactvision/react-viro`.
- **`latLngToMercator(lat, lng)` utility** — WGS84 Mercator projection returning metres.
  Building block for `gpsToArWorld` and custom geo math.

- **ReactVision — Cloud Anchor Provider**

  The `"reactvision"` provider routes `hostCloudAnchor` / `resolveCloudAnchor`
  through the ReactVision platform — no Google Cloud configuration or API key
  required.  The existing `hostCloudAnchor`, `resolveCloudAnchor`, and
  `onCloudAnchorStateChange` API is unchanged.

- **ReactVision — Cloud Anchor Management API**

  8 new methods on `arSceneNavigator` for full CRUD and analytics on cloud anchors
  (available when `provider="reactvision"`, the default):

  | Method | Description |
  |--------|-------------|
  | `rvGetCloudAnchor(anchorId)` | Fetch a single anchor record |
  | `rvListCloudAnchors(limit, offset)` | Paginated list of all project anchors |
  | `rvUpdateCloudAnchor(id, name, desc, isPublic)` | Rename / re-describe an anchor |
  | `rvDeleteCloudAnchor(anchorId)` | Permanently delete an anchor and its assets |
  | `rvFindNearbyCloudAnchors(lat, lng, radius, limit)` | GPS proximity search |
  | `rvAttachAssetToCloudAnchor(id, url, size, name, type, userId)` | Attach a hosted file |
  | `rvRemoveAssetFromCloudAnchor(anchorId, assetId)` | Remove an attached asset |
  | `rvTrackCloudAnchorResolution(...)` | Record resolve analytics manually |

  All calls are handled entirely inside the compiled native binary — no
  API keys or endpoint URLs are present in the JS bundle.

- **ReactVision — Geospatial Anchor Provider + Management API**

  GPS-tagged anchors are available through the ReactVision platform.
  5 new management methods on `arSceneNavigator`:

  | Method | Description |
  |--------|-------------|
  | `rvListGeospatialAnchors(limit, offset)` | Paginated list |
  | `rvGetGeospatialAnchor(anchorId)` | Fetch a single geospatial anchor |
  | `rvFindNearbyGeospatialAnchors(lat, lng, radius, limit)` | GPS proximity search |
  | `rvUpdateGeospatialAnchor(id, sceneAssetId, sceneId, name)` | Update metadata |
  | `rvDeleteGeospatialAnchor(anchorId)` | Permanently delete |

- **New `ViroProvider` type**

  Canonical union type `"none" | "arcore" | "reactvision"` exported from the
  package. Replaces the old `ViroCloudAnchorProvider` and `ViroGeospatialAnchorProvider`
  (now deprecated aliases).

- **ViroARPlaneSelector — tap-position object placement**

  Objects placed as `children` of `ViroARPlaneSelector` now appear at the
  exact point the user tapped, not at the plane's geometric centre.

  The world-space tap position from `onClickState` is converted to the
  plane's local coordinate space using the full inverse rotation matrix
  (R = Rx·Ry·Rz, X-Y-Z Euler order as used by `VROMatrix4f`) and clamped
  to the plane surface (Y = 0 in local space).  Children retain their own
  Y offset (`position={[0, 0.5, 0]}` etc.) relative to the tap point.

- **ViroARPlaneSelector — `onPlaneSelected` receives tap position**

  ```ts
  onPlaneSelected?: (plane: ViroPlaneUpdatedMap, tapPosition?: [number, number, number]) => void;
  ```

  `tapPosition` is the world-space ray–surface intersection point.

- **ViroARPlaneSelector — `onPlaneRemoved` prop**

  Called when ARKit/ARCore removes a tracked plane.  Receives the
  `anchorId` string.  Selection is automatically cleared if the removed
  plane was selected.

- **ViroARSceneNavigator — `depthEnabled` prop**

  Activates the depth sensor (LiDAR on supported iOS devices, monocular
  depth estimator as fallback; ARCore Depth API on Android 1.18+) without
  enabling occlusion rendering.  Virtual objects are **not** occluded, but
  depth data becomes available for:
  - `performARHitTest` — returns `DepthPoint` results
  - distance measurement use-cases

  When `occlusionMode="depthBased"` is set at the same time,
  `occlusionMode` takes precedence and full depth-based occlusion is used
  instead.

  ```tsx
  <ViroARSceneNavigator depthEnabled={true} ... />
  ```

  | Platform | Requirement |
  |---|---|
  | iOS | LiDAR device or monocular fallback (all devices) |
  | Android | ARCore Depth API — ARCore 1.18+ |

- **ViroARSceneNavigator — `depthDebugEnabled` prop**

  Debug visualisation of the depth texture over the camera feed.  Colours
  represent depth values: magenta = no data, blue = near, red = far.
  Useful for verifying depth coverage before relying on hit-test results.

  ```tsx
  <ViroARSceneNavigator depthEnabled={true} depthDebugEnabled={true} ... />
  ```

  Default: `false`. Both iOS and Android.

- **ViroARSceneNavigator — `preferMonocularDepth` prop (iOS only)**

  When `true`, forces iOS to use the monocular depth estimator even on
  LiDAR-equipped devices.  Useful for testing depth behaviour on older
  hardware or when LiDAR accuracy is not required and power consumption
  is a concern.

  Default: `false` (LiDAR used when available).

- **ViroARPlaneSelector — `hideOverlayOnSelection` prop**

  Controls whether the plane overlay hides once a plane is selected.
  Default `true` — the overlay disappears after selection so only your
  `children` content remains visible.  Pass `false` to keep the overlay
  visible (e.g. to show the plane boundary while the user repositions
  content).  Unselected planes are always hidden after a selection
  regardless of this prop.

- **ViroARPlaneSelector — `material` prop**

  Pass a `ViroMaterials`-registered material name to customise the plane
  overlay surface.  Defaults to the built-in translucent blue.

- **ViroARPlaneSelector — `handleAnchorRemoved` public method**

  New public instance method matching `handleAnchorFound` /
  `handleAnchorUpdated`.  Removes a plane from the visible set and
  clears selection if needed.

- **ARKit/ARCore plane detection — both orientations enabled by default**

  Previously only horizontal planes were detected unless `anchorDetectionTypes`
  was set explicitly.  The default is now horizontal + vertical at all layers:

  | Layer | File |
  |---|---|
  | C++ default | `VROARScene.h` |
  | iOS native default | `VRTARScene.mm` |
  | JS fallback default | `ViroARScene.tsx` |

- **Shader modifiers — custom `sampler2D` uniforms**

  Shader modifier code can now declare and receive `uniform sampler2D` inputs.
  Previously, sampler declarations in modifiers were silently ignored and the
  GPU always read texture unit 0.  Now each named sampler is assigned its own
  texture unit and bound correctly at draw time.

  ```typescript
  ViroMaterials.createMaterials({
    noisyMetal: {
      lightingModel: "PBR",
      shaderModifiers: {
        surface: {
          uniforms: "uniform sampler2D noise_tex;",
          body: `
            float noise = texture(noise_tex, _surface.diffuse_texcoord * 3.0).r;
            _surface.roughness = mix(0.2, 0.9, noise);
            _surface.metalness = mix(0.4, 1.0, noise);
          `
        }
      },
      materialUniforms: [
        { name: "noise_tex", type: "sampler2D", value: require("./textures/noise.png") }
      ]
    }
  });
  ```

  `ViroShaderUniform.type` now accepts `"sampler2D"` and `value` accepts a
  `require()` image reference.

- **Shader modifiers — runtime texture uniform update**

  `ViroMaterials.updateShaderUniform` now accepts `"sampler2D"` as a type,
  allowing any texture bound to a modifier sampler to be swapped at runtime:

  ```typescript
  ViroMaterials.updateShaderUniform("colorGraded", "lut_tex", "sampler2D",
    isDaytime ? require("./lut_day.png") : require("./lut_night.png"));
  ```

- **Shader modifiers — custom varyings between vertex and fragment stages**

  A new `varyings` field on shader modifier entry points lets vertex-stage
  (Geometry) modifiers pass typed data to fragment-stage (Surface / Fragment)
  modifiers.  Declare the same name in both stages; the engine injects `out` /
  `in` declarations automatically:

  ```typescript
  shaderModifiers: {
    geometry: {
      varyings: ["highp float displacement_amount"],
      uniforms: "uniform float time;",
      body: `
        float wave = sin(_geometry.position.x * 4.0 + time) * 0.1;
        _geometry.position.y += wave;
        displacement_amount = abs(wave) / 0.1;
      `
    },
    surface: {
      varyings: ["highp float displacement_amount"],
      body: `_surface.roughness = mix(0.1, 0.9, displacement_amount);`
    }
  }
  ```

- **Shader modifiers — scene depth buffer access**

  Fragment modifier entry points can set `requiresSceneDepth: true` to receive
  `scene_depth_texture` (sampler2D) and `scene_viewport_size` (vec2) automatically.
  Enables soft particles, contact edge glow, depth-based fog, and intersection
  effects.  On older Adreno/Mali GPUs that cannot sample the depth buffer in-pass,
  the engine automatically inserts a blit to a `GL_R32F` color attachment.

  ```typescript
  fragment: {
    requiresSceneDepth: true,
    body: `
      vec2 screenUV = gl_FragCoord.xy / scene_viewport_size;
      float sceneDepth = texture(scene_depth_texture, screenUV).r;
      float softFactor = clamp(abs(sceneDepth - gl_FragCoord.z) / 0.1, 0.0, 1.0);
      _output_color.a *= softFactor;
    `
  }
  ```

- **Shader modifiers — live AR camera texture access**

  Fragment modifier entry points can set `requiresCameraTexture: true` to
  sample the live AR camera feed on any geometry.  Two uniforms are bound
  automatically: `ar_camera_texture` (the camera feed) and `ar_camera_transform`
  (a `mat3` correcting for device orientation and aspect ratio).  The sampler
  type difference between platforms (`samplerExternalOES` on Android, `sampler2D`
  on iOS) is handled invisibly — developer GLSL is identical on both platforms.

  ```typescript
  surface: {
    requiresCameraTexture: true,
    body: `
      vec2 cameraUV = (ar_camera_transform * vec3(_surface.diffuse_texcoord, 1.0)).xy;
      _surface.diffuse_color = texture(ar_camera_texture, cameraUV);
    `
  }
  ```

  Enables magnifying glass, portal, refraction, warp, and camera-feed-on-geometry
  effects.

- **Shader modifiers — deterministic priority ordering**

  `VROShaderModifier` now has a `priority` field (default 0).  Multiple modifiers
  on the same material are injected in ascending priority order.  Engine-internal
  modifiers (AR shadow, occlusion) use priority -100; user modifiers default to 0;
  debug overlays use 100.  Prevents engine modifiers from interfering with
  user-defined effects regardless of attachment order.

- **Updated `ViroShaderModifier` type**

  ```typescript
  export type ViroShaderModifier = {
    uniforms?: string;
    body?: string;
    varyings?: string[];             // pass typed data from vertex to fragment stage
    requiresSceneDepth?: boolean;    // auto-bind scene_depth_texture + scene_viewport_size
    requiresCameraTexture?: boolean; // auto-bind ar_camera_texture + ar_camera_transform
  };

  export type ViroShaderUniform = {
    name: string;
    type: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D";
    value: number | number[] | ReturnType<typeof require>;
  };
  ```

### Fixed

- **GLB/3D models — washed-out / overexposed colours** (`virocore/ViroRenderer/VROMaterialShaderBinding.cpp`, `standard_fsh.glsl`)

  Models loaded from GLB files (and some OBJ/FBX assets) appeared overexposed or had their
  colours washed out.  Root cause: `material_emissive_color` was being added to the fragment
  shader output for every material, including those with no intentional emission.  GLB materials
  often carry a non-zero emission value in their PBR data; added on top of the diffuse+specular
  result it pushed the final colour toward white.  Removed the `material_emissive_color` and
  `material_alpha_cutoff` uniforms from the standard shader binding — these were incorrectly
  applied to all materials instead of only emissive/masked ones.

- **Android — physics body crash on scene close** (`virocore/ViroRenderer/capi/Node_JNI.cpp`)

  Closing a scene that contained physics-enabled nodes crashed with a null
  pointer dereference at `VRONode::setTransformDelegate+56`.  The GL-thread
  lambdas queued by `nativeSetTransformDelegate` and
  `nativeRemoveTransformDelegate` called `node->setTransformDelegate()` without
  first checking whether the `std::weak_ptr<VRONode>` had already expired.
  Added an `if (!node) { return; }` guard in both lambdas so that a node
  destroyed before the lambda runs is silently skipped instead of crashing.

- **Android — New Architecture Metro error** (`viro/android/viro_bridge/…/PerfMonitor.java`)

  "You should not use ReactNativeHost directly in the New Architecture" was
  thrown during dev-menu initialisation.  `PerfMonitor.setView()` called
  `getReactNativeHost().getReactInstanceManager().getDevSupportManager()`,
  which throws under the New Architecture.  Replaced with the New-Arch API:
  `getReactHost().getDevSupportManager()`.

- **iOS — `startVideoRecording` silent failure / `stopVideoRecording` returns `{success: false, errorCode: 0}`** (`virocore/ios/ViroKit/VROViewRecorder.mm`, `VROViewAR.mm`)

  Video recording was completely non-functional after the move to the React
  Native New Architecture.  Several independent bugs combined to produce a
  silent failure with no error callback and an empty URL on stop:

  - `[AVAssetWriter startWriting]` return value was never checked.  A failed
    writer still set `_isRecording = YES`, causing the stop path to hit the
    `kVROViewErrorAlreadyStopped` branch and return `errorCode: 0`.
  - The pixel buffer pool was never validated after `startWriting`.  A nil pool
    produced a null `_videoPixelBuffer` used later without a check.
  - `AVAssetWriter` was created before the video dimensions were validated; a
    zero-size view (not yet laid out) produced an invalid writer.
  - `AVAudioSession` was configured without `mode:AVAudioSessionModeVideoRecording`
    and without `[session setActive:YES]`.  On iOS 17+ ARKit takes control of
    the audio session, silently preventing `AVAudioRecorder` from writing data;
    the resulting empty/unplayable audio file then caused `generateFinalVideoFile`
    to call `handler(NO)` → `completionHandler(NO, nil, nil, kVROViewErrorUnknown)`.
  - `generateFinalVideoFile` hard-failed when the audio file was missing or
    unplayable, with no fallback.

  Fixes applied:
  - Added dimension guard (`kVROViewErrorInitialization`) before writer creation.
  - Added `startWriting` return check with cleanup and `kVROViewErrorInitialization`.
  - Added pixel buffer pool nil check with writer cancellation and error callback.
  - Added nil check for `AVAudioRecorder` after `initWithURL:settings:error:`.
  - Added `-record` return value check with a diagnostic log.
  - Set `mode:AVAudioSessionModeVideoRecording` and `[session setActive:YES]` in
    `VROViewAR` so the audio session is properly activated before recording starts.
  - `generateFinalVideoFile` now falls back to video-only output when the audio
    file is missing or unplayable, instead of failing the entire recording.

- **ViroARPlaneSelector — index-mapping mismatch (root cause of ghost planes)**

  The old implementation pre-allocated 25 `ViroARPlane` slots per alignment
  and mapped them by JS array index.  The C++ constraint matcher assigns
  anchors non-deterministically, so the slot at index `i` did not reliably
  hold the plane `detectedPlanes[i]` referred to.  The rewrite uses one
  `<ViroARPlane anchorId={id}>` per confirmed anchor — no mismatch possible.

- **ViroARPlaneSelector — selected plane disappeared on selection**

  Opacity was computed as `isSelected ? 0 : isVisible ? 1 : 0` — the
  selected plane hid itself immediately after tap.  Fixed to
  `selectedPlaneId === null || isSelected ? 1 : 0`.

- **ViroARPlaneSelector — children duplicated across all plane slots**

  Children were rendered inside every one of the 50 pre-allocated slots.
  Now rendered once, only on the selected plane, wrapped in a `ViroNode`
  at the tap position.

- **ViroARPlaneSelector — `onPlaneDetected` return value ignored**

  Returning `false` from `onPlaneDetected` previously had no effect.
  Now correctly prevents the plane from being added to the visible set.

- **ViroARPlaneSelector — removed planes not cleaned up**

  Disappeared planes were never removed from internal state.  The new
  `handleAnchorRemoved` deletes the entry from the Map and resets
  selection if needed.

- **VROARPlaneAnchor — `hasSignificantChanges` AND→OR threshold logic**

  The previous implementation required *both* the absolute (>1 cm) *and*
  the relative (>5 %) extent thresholds to pass simultaneously.  For large
  planes (floors, walls) the relative check almost never passed once the
  plane was mature, silently dropping most ARKit update notifications.
  Fixed to OR: either threshold alone triggers an update.

- **VROARPlaneAnchor — hard 100 ms update throttle suppressed early detection**

  ARKit sends rapid update bursts in the first seconds of plane detection.
  A fixed 100 ms minimum interval discarded most of them.  Replaced with
  an adaptive throttle: 33 ms (≈30 fps) for the first 20 updates,
  66 ms (≈15 fps) thereafter.

### Changed

- **`createGeospatialAnchor`, `createTerrainAnchor`, `createRooftopAnchor` — supported
  with `provider="reactvision"`.**

  GPS→AR placement uses Mercator projection + compass heading to compute the relative
  AR-frame offset, then creates a native ARKit / ARCore local anchor. No VPS, no ARCore
  Geospatial API, and no ARCore pods are required.

  | Method | ReactVision placement |
  |---|---|
  | `createGeospatialAnchor(lat, lng, alt, quat)` | GPS absolute altitude |
  | `createTerrainAnchor(lat, lng, altAboveTerrain, quat)` | `deviceAlt + altAboveTerrain` |
  | `createRooftopAnchor(lat, lng, altAboveRooftop, quat)` | `deviceAlt + altAboveRooftop` |

  The returned `anchorId` is a native AR anchor tracked by VIO for the session.
  Placement accuracy matches device GPS accuracy (~3–10 m horizontally).

- **ViroARPlaneSelector — `useActualShape` now defaults to `true`**

  Previously the bounding-rect `ViroQuad` fallback was used whenever
  vertices were absent; now the polygon path is always preferred and the
  quad is only used as a fallback before ARKit provides boundary vertices.

### ViroCore Integration

This release integrates the ReactVision native backend into ViroCore:
- Cloud anchor hosting and resolving via the ReactVision platform (Android + iOS)
- Geospatial anchor CRUD, proximity search, and GPS→AR placement
- `ReactVision` provider wired into the AR session layer on both platforms

---

## v2.52.0 - 08 February 2026

### Added
- **Full Shader Support**: Complete implementation of shader modifiers for iOS and Android platforms
- **Shader Overrides**: New `shaderOverrides` prop for real-time shader customization across both platforms
- **Shader Propagation**: Intelligent shader propagation system down the node tree with proper timing
- **Fragment Output Standardization**: Unified fragment shader outputs across platforms
- **Texture Handling in Shaders**: Full texture support in shader overrides
- **Animated Shader Support**: Uniform binding for animated shaders
- **Material Animation Preservation**: Materials with animations are preserved during shader application
- **Lighting Properties in Shaders**: Lighting properties are properly copied and maintained in custom shaders
- **Material Sharing**: Materials now shared efficiently across instances for improved performance
- **Depth-based AR Hit Testing**: Enhanced AR hit test functionality using depth information
- **Monocular Depth Fallback**: Non-LiDAR devices now automatically fallback to monocular depth estimation
- **Throttle Mechanism**: Added performance throttle to prevent system overload

### Fixed
- **iOS Memory Leaks** (Critical): Completely eliminated memory leaks on iOS platform (both viro and virocore)
- **Portal Crashes** (Critical): Fixed crashes when unmounting portals on iOS
- **Material Overflow**: Fixed cloned materials array overflow that caused crashes
- **VRX Asset Loading**: Resolved VRX asset loading issues
- **Monocular Depth Alignment**: Fixed monocular depth frame alignment issues
- **Double Anchor Reference**: Fixed issue with creating duplicate anchor references
- **Gravity Type Crash**: Fixed Android crash caused by incorrect gravity type definition (now correctly typed as 3D vector `[number, number, number]`)
- **hitResultId**: Fixed hitResultId availability issue in AR hit tests
- **Thread Locks**: Refactored implementation to avoid thread locks

### Changed
- **Depth Integration**: Improved depth integration with simplified logic

### Removed
- Debug logs and visualizations from production code
- Spam/noisy logging

### ViroCore Integration
This release includes 21 commits from virocore focused on:
- Native shader support and modifiers
- Memory management improvements
- Depth processing enhancements

## v2.51.0 - 01 February 2026

Previous release baseline for v2.52.0 changes.

## v2.43.6 - 08 October 2025

- **Fixed pod install issues**: Adjusted ViroKit requirements
  - Resolved persisting pod installation failures

## v2.43.5 - 07 October 2025

### iOS Improvements

- **Fixed pod install issues**: Rebuilt ViroCore framework for iOS
  - Resolved pod installation failures
  - Improved compatibility with modern CocoaPods versions
  - Fixed framework architecture issues

### Fabric Architecture Improvements

- **Enhanced Fabric compatibility**: Migrated 30 methods across 8 Java modules to use Fabric's `UIBlock` pattern

  - Fixed `ReactNoCrashBridgeNotAllowedSoftException` errors in production
  - Replaced deprecated `getNativeModule(UIManagerModule.class)` with `UIManagerHelper.getUIManager()`
  - Updated to use `com.facebook.react.fabric.interop.UIBlock` and `UIBlockViewResolver`
  - Modules updated: ARSceneModule, ARSceneNavigatorModule, CameraModule, ControllerModule, NodeModule, SceneModule, SceneNavigatorModule, VRT3DSceneNavigatorModule

- **Improved prop handling**: Added Fabric-aware error recovery system in VRTNodeManager

  - Removed `isAttachedToWindow()` checks that blocked prop updates in Fabric's pre-attachment phase
  - Implemented `safelyApplyProp()` pattern with automatic retry on transient failures
  - Enhanced error logging for better debugging
  - Refactored 28 @ReactProp methods for consistent error handling
  - Reduced boilerplate code by ~250 lines

- **Better resilience**: Automatic prop retry handles GL context initialization timing issues
  - Prevents props from being silently lost during scene transitions
  - Recovers from view state timing issues on low-end devices
  - Improved stability during AR session interruptions

## v2.43.1 - 26 June 2025

- Added support for React Native New Architecture (Fabric)
- Added examples demonstrating how to use ViroReact with automatic architecture detection
- Updated documentation with information about the New Architecture support
- Deprecated legacy architecture support (removed completely)

## v2.42.0 - 7 February 2025

- Compatibility with Expo 52
- Removed Telemetry
- Cleaned codebase

## v2.41.1 - 6 March 2024

- fix(ViroBase): fix onClick not working for &lt;ViroText /&gt; components [`#277`](https://github.com/NativeVision/viro/pull/277)
- fix(react): remove unnecessary debug logging [`#276`](https://github.com/NativeVision/viro/pull/276)
- fix(ViroBase): fix onClick not working for &lt;ViroText /&gt; components (#277) [`#272`](https://github.com/NativeVision/viro/issues/272)

## v2.41.0 - 23 February 2024

- Bump ip from 1.1.8 to 1.1.9 [`#270`](https://github.com/NativeVision/viro/pull/270)
- chore: Update android [`#261`](https://github.com/NativeVision/viro/pull/261)
- chore: release v2.41.0 [`fefff31`](https://github.com/NativeVision/viro/commit/fefff31be858404ef83c81282d2322ff338e8157)

## v2.40.1 - 19 February 2024

- fix: Add import/export of VIRO_VERSION [`#268`](https://github.com/NativeVision/viro/pull/268)
- chore: release v2.40.1 [`44a6900`](https://github.com/NativeVision/viro/commit/44a690053703ae0cfe6aae3b1c2586b18f57e519)

## v2.24.0 - 16 February 2024

- Add Telemetry [`#264`](https://github.com/NativeVision/viro/pull/264)
- fix: fix isARSupportedOnDevice [`#262`](https://github.com/NativeVision/viro/pull/262)

## v2.23.3 - 10 February 2024

- fix: fix isARSupportedOnDevice [`220847d`](https://github.com/NativeVision/viro/commit/220847dcfd15296c4860419f8b388c27e686eb1e)
- chore: version bump 2.23.3 [`31adf38`](https://github.com/NativeVision/viro/commit/31adf38b728de36126c3d9b0a246407fe8753ca6)

## v2.23.2 - 9 February 2024

- Fix screenshot taking and screen recording in AR [`#256`](https://github.com/NativeVision/viro/pull/256)
- docs: update readme installation instructions [`#259`](https://github.com/NativeVision/viro/pull/259)
- feat: added code of conduct [`#255`](https://github.com/NativeVision/viro/pull/255)
- Update ISSUE_TEMPLATE.md [`219fff7`](https://github.com/NativeVision/viro/commit/219fff72d57280d4dc81b40854872d3a33eb8d20)

## v2.23.2-beta - 2 February 2024

- Fix screenshot taking [`844be5a`](https://github.com/NativeVision/viro/commit/844be5a6058494fdecbd4c91a60c847581b49465)

## v2.23.1 - 25 January 2024

## v2.23.1-rc4 - 25 January 2024

- Support kotlin and Expo SDK 50 for Android [`#249`](https://github.com/NativeVision/viro/pull/249)

## v2.23.1-rc1 - 25 January 2024

- Fix Expo plugin issues, dependency issues, and stabilize [`#247`](https://github.com/NativeVision/viro/pull/247)
- v2.23.1-alpha [`#243`](https://github.com/NativeVision/viro/pull/243)
- Update README.md [`#206`](https://github.com/NativeVision/viro/pull/206)
- Bump react-devtools-core from 4.27.7 to 4.28.5 [`#235`](https://github.com/NativeVision/viro/pull/235)
- Bump xml2js and @expo/config-plugins [`#236`](https://github.com/NativeVision/viro/pull/236)
- Bump semver from 5.7.1 to 5.7.2 [`#234`](https://github.com/NativeVision/viro/pull/234)
- Bump @babel/traverse from 7.17.0 to 7.23.2 [`#231`](https://github.com/NativeVision/viro/pull/231)
- Bump hermes-engine and react-native [`#209`](https://github.com/NativeVision/viro/pull/209)
- Fix for 'Tried to register two views with the same name VRTQuad' in ViroSurface [`#180`](https://github.com/NativeVision/viro/pull/180)
- Bump shell-quote and @react-native-community/cli-tools [`#208`](https://github.com/NativeVision/viro/pull/208)
- Bump @sideway/formula from 3.0.0 to 3.0.1 [`#195`](https://github.com/NativeVision/viro/pull/195)
- Bump decode-uri-component from 0.2.0 to 0.2.2 [`#182`](https://github.com/NativeVision/viro/pull/182)
- Bump @xmldom/xmldom from 0.7.5 to 0.7.8 [`#176`](https://github.com/NativeVision/viro/pull/176)
- Bump minimatch from 3.0.4 to 3.1.2 [`#178`](https://github.com/NativeVision/viro/pull/178)
- Bump json5 from 1.0.1 to 1.0.2 [`#191`](https://github.com/NativeVision/viro/pull/191)
- ViroSurface Fix [`#199`](https://github.com/NativeVision/viro/pull/199)
- Bump simple-plist from 1.3.0 to 1.3.1 [`#139`](https://github.com/NativeVision/viro/pull/139)
- Bump async from 2.6.3 to 2.6.4 [`#131`](https://github.com/NativeVision/viro/pull/131)
- Bump plist from 3.0.4 to 3.0.5 [`#115`](https://github.com/NativeVision/viro/pull/115)
- Bump minimist from 1.2.5 to 1.2.6 [`#114`](https://github.com/NativeVision/viro/pull/114)
- Bump ansi-regex from 4.1.0 to 4.1.1 [`#113`](https://github.com/NativeVision/viro/pull/113)
- Update INSTALL_ANDROID.md [`#98`](https://github.com/NativeVision/viro/pull/98)
- Update README.md [`#126`](https://github.com/NativeVision/viro/pull/126)
- Remove unnecessary logging from Viro3DObject [`#132`](https://github.com/NativeVision/viro/pull/132)
- Add VR AndroidManifest injection [`#104`](https://github.com/NativeVision/viro/pull/104)
- Add supporter image for Morrow [`#111`](https://github.com/NativeVision/viro/pull/111)
- Add out-of-the-box expo plugin support [`#88`](https://github.com/NativeVision/viro/pull/88)
- Update INSTALL_IOS.md [`#96`](https://github.com/NativeVision/viro/pull/96)
- Rewrite repo in typescript [`#72`](https://github.com/NativeVision/viro/pull/72)
- Update INSTALL.md [`#80`](https://github.com/NativeVision/viro/pull/80)
- Update README.md [`#85`](https://github.com/NativeVision/viro/pull/85)
- Enable bitcode + chroma threshold [`#78`](https://github.com/NativeVision/viro/pull/78)
- v2.22.0 [`#69`](https://github.com/NativeVision/viro/pull/69)
- Update INSTALL_IOS.md [`#68`](https://github.com/NativeVision/viro/pull/68)
- Update LICENSE [`#67`](https://github.com/NativeVision/viro/pull/67)
- Add out-of-the-box expo plugin support (#88) [`#87`](https://github.com/NativeVision/viro/issues/87)
- Revert "Fix iOS compatibility and ViroVideo (#47)" [`3a4b8e0`](https://github.com/NativeVision/viro/commit/3a4b8e07319fe3ea3f31dd0b77e3b1185fe4fc48)

## v2.21.1 - 8 September 2021

- Fix iOS compatibility and ViroVideo [`#47`](https://github.com/NativeVision/viro/pull/47)

## v2.21.0 - 5 September 2021

- Update package.json [`#46`](https://github.com/NativeVision/viro/pull/46)
- Update [`#42`](https://github.com/NativeVision/viro/pull/42)
- Update INSTALL_ANDROID.md [`#38`](https://github.com/NativeVision/viro/pull/38)
- docs: updates links and also file type change [`#27`](https://github.com/NativeVision/viro/pull/27)
- docs: fixed typo [`#26`](https://github.com/NativeVision/viro/pull/26)
- Updating the discord invite link [`#10`](https://github.com/NativeVision/viro/pull/10)
- Bumping version for release. [`#9`](https://github.com/NativeVision/viro/pull/9)
- Removing references to fbjs. [`#8`](https://github.com/NativeVision/viro/pull/8)
- fix typo in package.json [`#6`](https://github.com/NativeVision/viro/pull/6)
- Adding NPM publish action [`#4`](https://github.com/NativeVision/viro/pull/4)
- - Removed the star from every pod as when doing pod install it drops … [`#1`](https://github.com/NativeVision/viro/pull/1)
- First [`4fb045b`](https://github.com/NativeVision/viro/commit/4fb045b7948533abc8787a10981f74b003a3ea68)
- Remove broken scripts [`2d94c22`](https://github.com/NativeVision/viro/commit/2d94c22e0447a655cffbb3ae415ebc111e4d15bc)
- Updating Readme to give better install instructions and moving examples to their own page(#7) [`bee93cc`](https://github.com/NativeVision/viro/commit/bee93cc7a18666294a14eb13606ef4e2f160202a)
