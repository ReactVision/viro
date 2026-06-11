# Platform Extensions — API Reference

ReactVision ViroReact SDK — `feature/platform-extensions`

This document covers the five platform extension features (F2–F5 + Monocular Depth) and the Selfie Camera feature, with both user-facing API reference and technical implementation notes.

> **F1 (VRODynamicMeshNode)** is a C++-only virocore API consumed by the SM64 demo and other native integrations. There is no React Native component for it — see `viro-sm64-example/` for the reference integration.

---

## Table of Contents

1. [ViroGameLoop — F5](#virogameloop--f5)
2. [ViroVirtualJoystick — F2](#virovirtualjoystick--f2)
3. [ViroVirtualButton — F2](#virovirtualbutton--f2)
4. [StreamingAudioManager — F3](#streamingaudiomanager--f3)
5. [ViroARSceneNavigator — Extended Props](#viroarscenenavigator--extended-props)
   - [World Mesh — F4](#world-mesh--f4)
   - [Monocular Depth](#monocular-depth)
   - [Front Camera (Selfie)](#front-camera-selfie)
6. [ViroCameraTexture](#virocameratexture)
7. [Platform Support Matrix](#platform-support-matrix)
8. [Migration & Gotchas](#migration--gotchas)

---

## ViroGameLoop — F5

A headless (zero-size) node that fires per-frame JS callbacks from the native render loop. Mount it anywhere inside a `ViroARScene` or `ViroScene` to start the loop. Unmount it to stop.

### Import

```tsx
import { ViroGameLoop } from "@reactvision/react-viro";
```

### Props

| Prop            | Type                                   | Default | Description                                                                                      |
| --------------- | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `onUpdate`      | `(e: ViroGameLoopUpdateEvent) => void` | —       | Fires every rendered frame.                                                                      |
| `onLateUpdate`  | `(e: ViroGameLoopUpdateEvent) => void` | —       | Fires after physics simulation.                                                                  |
| `fixedHz`       | `number`                               | —       | When set, enables the fixed-step accumulator.                                                    |
| `onFixedUpdate` | `(e: ViroGameLoopFixedEvent) => void`  | —       | Fires at `fixedHz` regardless of render rate. Spiral-of-death protection: max 4 ticks per frame. |

```typescript
type ViroGameLoopUpdateEvent = {
  nativeEvent: { dt: number; elapsed: number };
};

type ViroGameLoopFixedEvent = {
  nativeEvent: { dt: number };
};
```

> **Note:** `dt` and `elapsed` arrive as strings on Android due to New Architecture Fabric constraints and are parsed to `number` by the component wrapper automatically.

### Hooks

```typescript
import { useGameLoop, useLateUpdate, useFixedUpdate } from '@reactvision/react-viro';

useGameLoop((dt: number, elapsed: number) => void): void;
useLateUpdate((dt: number, elapsed: number) => void): void;
useFixedUpdate((dt: number) => void, fixedHz?: number): void;
```

### Utility: bypass reconciler

For high-frequency position/rotation updates, use these helpers to bypass the React reconciler:

```typescript
import { ViroGameLoopUtils } from "@reactvision/react-viro";

ViroGameLoopUtils.setPosition(nodeRef, x, y, z);
ViroGameLoopUtils.setRotation(nodeRef, x, y, z);
ViroGameLoopUtils.setScale(nodeRef, x, y, z);
```

### Example

```tsx
import { ViroARScene, ViroBox, ViroGameLoop } from "@reactvision/react-viro";
import { useRef } from "react";

const boxRef = useRef(null);

<ViroARScene>
  <ViroBox ref={boxRef} position={[0, 0, -1]} scale={[0.1, 0.1, 0.1]} />
  <ViroGameLoop
    fixedHz={30}
    onFixedUpdate={({ nativeEvent: { dt } }) => {
      // deterministic physics step
    }}
    onUpdate={({ nativeEvent: { dt } }) => {
      // interpolate / render
    }}
  />
</ViroARScene>;
```

### Architecture note

`ViroGameLoop` is registered as a native `VROFrameListener`. On iOS it is an `VRTNode` that registers via `VROFrameSynchronizer`; on Android it uses `nativeCreate/nativeDestroy` JNI. The fixed-step accumulator runs entirely in C++ — if the game loop is called at 60fps with `fixedHz=30`, exactly two fixed ticks fire per frame.

---

## ViroVirtualJoystick — F2

A native-rendered on-screen joystick. Writes stick state to a `VROInputState` registry entry with single-digit ms latency (no JS bridge round-trip).

### Import

```tsx
import { ViroVirtualJoystick } from "@reactvision/react-viro";
```

### Props

| Prop            | Type                   | Default                 | Description                                                                                                                    |
| --------------- | ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `controllerId`  | `string`               | **required**            | Identifies the shared controller state. Must match the `controllerId` of any `ViroVirtualButton` you want to share state with. |
| `stickSide`     | `"left" \| "right"`    | `"left"`                | Which analog stick this joystick drives.                                                                                       |
| `radius`        | `number`               | `60`                    | Outer ring radius in dp/points.                                                                                                |
| `tintColor`     | `string \| number`     | `rgba(255,255,255,0.6)` | Color of the ring and knob.                                                                                                    |
| `onStickChange` | `(e) => void`          | —                       | Fires when stick value changes. `e.nativeEvent.x` and `.y` are `number` in `[-1, 1]`.                                          |
| `style`         | `StyleProp<ViewStyle>` | —                       | Must include explicit `width` and `height` — native views have no intrinsic size.                                              |

> **Important:** Always set `style={{ width: N, height: N }}`. Without explicit size the view collapses.

### Example

```tsx
import { ViroVirtualJoystick } from "@reactvision/react-viro";

const ctrl = { x: 0, y: 0 }; // module-level, shared with game loop

<ViroVirtualJoystick
  controllerId="p1"
  stickSide="left"
  radius={60}
  tintColor="rgba(255,255,255,0.7)"
  onStickChange={(e) => {
    ctrl.x = e.nativeEvent.x;
    ctrl.y = e.nativeEvent.y;
  }}
  style={{ width: 120, height: 120 }}
/>;
```

### Architecture note

Touch events never cross the JS bridge. The native view (iOS `UIView`, Android `View`) computes normalized stick deflection and writes directly to a `VROInputState` via `VROVirtualControllerRegistry`. The `onStickChange` callback is a secondary, optional JS notification fired in the same tick.

---

## ViroVirtualButton — F2

A native-rendered circular button. Pairs with `ViroVirtualJoystick` via a shared `controllerId`.

### Import

```tsx
import { ViroVirtualButton } from "@reactvision/react-viro";
```

### Props

| Prop           | Type                   | Default                 | Description                                 |
| -------------- | ---------------------- | ----------------------- | ------------------------------------------- |
| `controllerId` | `string`               | **required**            | Shared controller ID.                       |
| `button`       | `ViroButtonName`       | **required**            | Which button bit to set.                    |
| `size`         | `number`               | `44`                    | Circle diameter in dp/points.               |
| `tintColor`    | `string \| number`     | `rgba(255,255,255,0.6)` | Button fill color.                          |
| `onPressIn`    | `(e) => void`          | —                       | Fires on touch-down.                        |
| `onPressOut`   | `(e) => void`          | —                       | Fires on touch-up or cancel.                |
| `style`        | `StyleProp<ViewStyle>` | —                       | Must include explicit `width` and `height`. |

```typescript
type ViroButtonName =
  | "A"
  | "B"
  | "X"
  | "Y"
  | "Z"
  | "L1"
  | "R1"
  | "L2"
  | "R2"
  | "Start"
  | "Select";
```

### Example

```tsx
<ViroVirtualButton
  controllerId="p1"
  button="A"
  size={48}
  tintColor="#FF6B9D"
  onPressIn={() => console.log("A pressed")}
  onPressOut={() => console.log("A released")}
  style={{ width: 48, height: 48 }}
/>
```

### Reading controller state from C++

```cpp
// virocore — safe from any thread
auto state = VROVirtualControllerRegistry::instance().peek("p1");
if (state) {
  auto snap = state->snapshot();
  float leftX = snap.stickLX;
  float leftY = snap.stickLY;
  bool aPressed = (snap.buttonBits >> VROButtonIndex_A) & 1;
}
```

---

## StreamingAudioManager — F3

Runtime PCM audio streaming. Feed raw float32 PCM chunks from any source (TTS, synthesizer, game engine audio) and play them in real time.

### Import

```typescript
import { StreamingAudioManager } from "@reactvision/react-viro";
```

### API

```typescript
// Create a named player
StreamingAudioManager.create(playerId: string): void;

// Begin streaming — must be called before pushSamples
StreamingAudioManager.beginStreaming(
  playerId: string,
  sampleRate: number,   // e.g. 22050, 44100, 48000
  channels: number      // 1 = mono, 2 = stereo
): void;

// Playback control
StreamingAudioManager.play(playerId: string): void;
StreamingAudioManager.pause(playerId: string): void;
StreamingAudioManager.setVolume(playerId: string, volume: number): void;  // 0.0–1.0
StreamingAudioManager.setMuted(playerId: string, muted: boolean): void;

// Push audio data — base64-encoded float32 PCM, interleaved, little-endian
StreamingAudioManager.pushSamples(playerId: string, base64Samples: string): void;

// Release resources
StreamingAudioManager.destroy(playerId: string): void;
```

### Correct call order

```typescript
// 1. Create
StreamingAudioManager.create("voice");

// 2. Configure stream format
StreamingAudioManager.beginStreaming("voice", 22050, 1);

// 3. Pre-fill buffer BEFORE play
StreamingAudioManager.pushSamples("voice", firstChunkBase64);

// 4. Start playback
StreamingAudioManager.play("voice");

// 5. Continue pushing on each chunk
StreamingAudioManager.pushSamples("voice", nextChunkBase64);

// 6. Clean up
StreamingAudioManager.destroy("voice");
```

> **Critical:** Call `pushSamples` before `play`. If the ring buffer is empty when playback starts, the audio thread will underrun.

### Encoding samples

```typescript
function float32ToBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
```

### Architecture note

- **iOS:** `AVAudioEngine` + `AVAudioSourceNode` render block drains a lock-free SPSC ring buffer (`VROPCMRingBuffer`, default 16 384 samples ≈ 185 ms at 44.1 kHz stereo).
- **Android:** `AudioTrack` with `WRITE_NON_BLOCKING`. Excess samples are silently discarded when the hardware buffer is full.
- The API is non-spatial. For spatialised streaming audio, use `VROSoundGVR` directly from C++.

---

## ViroARSceneNavigator — Extended Props

### World Mesh — F4

Surfaces the real-world geometry as a subscribable, physics-ready mesh.

| Prop                 | Type                                  | Default | Description                                       |
| -------------------- | ------------------------------------- | ------- | ------------------------------------------------- |
| `worldMeshEnabled`   | `boolean`                             | `false` | Enable real-world mesh generation.                |
| `worldMeshConfig`    | `ViroWorldMeshConfig`                 | —       | Fine-grained control over physics and debug draw. |
| `onWorldMeshUpdated` | `(stats: ViroWorldMeshStats) => void` | —       | Fired when the mesh is updated.                   |

```typescript
type ViroWorldMeshConfig = {
  // Physics mesh simplification
  physicsCellSize?: number; // Vertex clustering cell (default: 0.10 m). 0 = disabled.
  physicsMaxTriangles?: number; // Stride decimation limit. 0 = no limit.

  // Debug wireframe
  debugDrawEnabled?: boolean; // default: true
  debugDrawDepthTest?: boolean; // occluded by real surfaces (default: true)
  debugDrawMaxTriangles?: number; // default: 1000
  debugDrawLineThickness?: number; // default: 0.001 m
};

type ViroWorldMeshStats = {
  vertexCount: number;
  triangleCount: number;
  source: "lidar" | "monocular" | "plane";
};
```

**Source priority (automatic, persistent):**

1. `ARMeshAnchor` — iOS 13.4+ LiDAR, native accumulation across frames
2. Depth image — LiDAR or monocular depth, current frame only
3. `ARPlaneAnchor` — all platforms, session-persistent polygon fallback

**Performance guidance:**

- `physicsCellSize=0.10` clusters vertices within 10 cm → gap-free simplified mesh
- `physicsMaxTriangles=200` limits per-update cost when LiDAR produces dense meshes
- Async BVH construction — physics build runs on a background thread; render thread is never blocked

**Physics usage:**

For physics bodies to respond to the world mesh, add `physicsWorld` to your scene:

```tsx
<ViroARScene physicsWorld={{ gravity: [0, -9.81, 0] }}>
  <ViroSphere
    physicsBody={{
      type: "Dynamic",
      mass: 1,
      shape: { type: "Sphere", params: [0.05] },
    }}
    position={[0, 1, -1]}
  />
</ViroARScene>
```

The `VROARWorldMesh` physics body operates independently from JS `physicsBody` props — it uses Bullet directly without requiring `physicsWorld` on the scene. However, JS physics objects DO require it.

### Monocular Depth

Use the device's neural depth estimator (DAv2 or DepthPro) instead of LiDAR for hit tests, occlusion, and world mesh on non-LiDAR devices — or to force monocular even when LiDAR is present.

| Prop                      | Type      | Default | Description                                                                                                                                                       |
| ------------------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preferMonocularDepth`    | `boolean` | `false` | Use neural depth instead of LiDAR.                                                                                                                                |
| `monocularDepthScale`     | `number`  | `1.0`   | Multiply depth values by this factor. Use `< 1.0` if the model overestimates distances (virtual objects visible through real surfaces). Typical range: `0.7–1.3`. |
| `monocularDepthTargetFPS` | `number`  | `5`     | Maximum inference rate. Automatically throttled further by device thermal state (Fair→3fps, Serious→2fps, Critical→stopped).                                      |
| `depthDebugEnabled`       | `boolean` | `false` | Overlay depth colormap on camera feed (Turbo colormap, 0–10 m range).                                                                                             |

**Model selection (automatic priority):**

1. `DepthAnythingV2_metric_indoor.mlmodelc` — DAv2 Hypersim, best indoor accuracy
2. `DepthAnythingV2_metric_outdoor.mlmodelc` — DAv2 KITTI
3. `DepthPro.mlmodelc` — Apple DepthPro
4. `DepthAnythingV2.mlmodelc` — relative depth (requires calibration)

Bundle the model file in your app's iOS target → Copy Bundle Resources.

**Requirements:** iOS 14.0+, A12 Bionic or newer.

### Front Camera (Selfie)

Switch the AR session to use the front-facing camera.

| Prop                 | Type      | Default | Description                                                 |
| -------------------- | --------- | ------- | ----------------------------------------------------------- |
| `frontCameraEnabled` | `boolean` | `false` | Use the front (selfie) camera as the AR session background. |

**Platform behavior:**

- **iOS:** Uses `ARFaceTrackingConfiguration` (TrueDepth camera). Gravity-aligned world coordinate system is preserved — 3D content at fixed world positions is world-locked. Requires iPhone X or newer. Plane detection and LiDAR are unavailable.
- **Android:** Uses ARCore Augmented Faces (`AR_AUGMENTED_FACE_MODE_MESH3D`) with front camera. Falls back to front-camera-only mode if Augmented Faces is not supported by the device.

**What still works with `frontCameraEnabled=true`:**

- All 3D nodes, models, particles, text
- Lighting (`ViroAmbientLight`, `ViroSpotLight`, etc.)
- Physics (`physicsBody`, `physicsWorld`)
- Game loop (`ViroGameLoop`)
- PCM streaming audio

**What does NOT work:**

- Plane detection
- World mesh / LiDAR
- `ViroARPlane`, `ViroARPlaneSelector`
- Image / object tracking

```tsx
<ViroARSceneNavigator
  frontCameraEnabled={true}
  initialScene={{ scene: SelfieCameraScene }}
  style={StyleSheet.absoluteFill}
/>
```

---

## ViroCameraTexture

Binds a live device camera feed to a named material's diffuse texture, allowing any geometry to display a real-time camera view.

> See [`ViroCameraTexture.md`](./ViroCameraTexture.md) for the full reference.

### Quick example

```tsx
import {
  ViroMaterials,
  ViroQuad,
  ViroCameraTexture,
} from "@reactvision/react-viro";

ViroMaterials.createMaterials({
  mirrorMat: { lightingModel: "Constant" },
});

function MirrorScene() {
  const cameraRef = useRef(null);

  return (
    <ViroARScene>
      <ViroCameraTexture
        ref={cameraRef}
        material="mirrorMat"
        cameraPosition="front"
        paused={false}
        onCameraReady={() => console.log("Camera ready")}
      />
      <ViroQuad
        width={0.54}
        height={0.96}
        position={[0, 0, -1]}
        materials={["mirrorMat"]}
      />
    </ViroARScene>
  );
}
```

### Key differences vs `frontCameraEnabled`

|             | `frontCameraEnabled`                | `ViroCameraTexture`                            |
| ----------- | ----------------------------------- | ---------------------------------------------- |
| Camera feed | AR session background (full screen) | Material texture on any geometry               |
| AR tracking | World-locked (gravity)              | Back camera AR still active                    |
| Typical use | Selfie AR, face effects             | Mirror surfaces, picture-in-picture, VR selfie |
| Platform    | iOS + Android                       | iOS + Android                                  |

---

## Platform Support Matrix

| Feature                   | iOS | Android | Notes                                     |
| ------------------------- | --- | ------- | ----------------------------------------- |
| `ViroGameLoop`            | ✅  | ✅      |                                           |
| `ViroVirtualJoystick`     | ✅  | ✅      | JS callbacks not fired on Android pre-5.0 |
| `ViroVirtualButton`       | ✅  | ✅      |                                           |
| `StreamingAudioManager`   | ✅  | ✅      |                                           |
| `worldMeshEnabled`        | ✅  | ✅      | ARMeshAnchor iOS 13.4+ only               |
| `preferMonocularDepth`    | ✅  | ❌      | iOS 14.0+ A12+                            |
| `monocularDepthScale`     | ✅  | ❌      | iOS only                                  |
| `monocularDepthTargetFPS` | ✅  | ❌      | iOS only                                  |
| `depthDebugEnabled`       | ✅  | ❌      | iOS only                                  |
| `frontCameraEnabled`      | ✅  | ✅      | Android requires ARCore-certified device  |
| `ViroCameraTexture`       | ✅  | ✅      |                                           |

---

## Migration & Gotchas

### ViroGameLoop — sharing state with the AR scene

`ViroARSceneNavigator.initialScene.scene` is evaluated **once at mount**. Props passed to it later are ignored. To share state between the React UI (joystick callbacks) and the scene (game loop):

```typescript
// module-level — shared between render calls without React re-renders
const ctrl = { x: 0, y: 0, btn: false };

// Joystick (React UI, outside scene):
<ViroVirtualJoystick
  onStickChange={(e) => { ctrl.x = e.nativeEvent.x; ctrl.y = e.nativeEvent.y; }}
/>

// Game loop (inside ViroARScene):
<ViroGameLoop
  onUpdate={() => {
    // ctrl.x, ctrl.y are always current
  }}
/>
```

### ViroVirtualJoystick / ViroVirtualButton — explicit size required

Both components have no intrinsic size. Always add `style={{ width: N, height: N }}` or they collapse to 0×0 and receive no touch events.

### StreamingAudioManager — push before play

Call `pushSamples` with at least one chunk **before** `play`. If the ring buffer is empty when the audio thread starts consuming, you'll hear a glitch or silence.

### worldMeshEnabled — physicsWorld not required

The world mesh physics body is managed directly by `VROARWorldMesh` in C++ and does not require `physicsWorld` on `ViroARScene`. However, JS `physicsBody` components **do** require `physicsWorld={{ gravity: [0,-9.81,0] }}` on the scene.

### frontCameraEnabled — world tracking limitation

With `frontCameraEnabled=true`, ViroNodes placed at fixed world positions appear world-locked on iOS (gravity alignment) but may appear screen-fixed on Android devices that fall back from Augmented Faces to front-camera-only mode. Do not use `ViroARPlane` or plane detection callbacks — they will not fire.

### Monocular depth — performance

At the default 5fps inference rate, the A18 Pro uses <50% ANE capacity. The thermal throttle is automatic — you do not need to manage it. If the scene becomes hot, inference rate reduces automatically; the depth texture from the last frame continues to be used for occlusion.

---

## What's not yet documented / missing

The following features have been implemented but lack user-facing documentation:

1. **`VRODynamicMeshNode` JS binding** — F1 is C++ only. A `ViroDynamicMesh` React Native component would allow JS consumers to drive per-frame mesh updates without writing C++.

2. **`ViroARWorldMesh` JS subscriber API** — The C++ subscriber API is powerful but there is no JS-facing hook or event for receiving mesh updates from React Native code.

3. **`ViroCameraTexture` capture methods** — `capturePhoto()` and `startRecording()`/`stopRecording()` are implemented natively but lack comprehensive usage examples and error-handling documentation.

4. **Face anchors with `frontCameraEnabled`** — When `ARFaceTrackingConfiguration` is active on iOS, `ARFaceAnchor` objects are created. These are not currently exposed to JS. A future `ViroFaceAnchor` component could allow content to follow the detected face.

5. **`useVirtualController(id)` hook** — Planned but not yet implemented. Would allow reading `VROInputState` from JS at 30 Hz without passing callbacks through every component.

6. **Android `monocularDepth` props** — `preferMonocularDepth`, `monocularDepthScale`, `monocularDepthTargetFPS`, and `depthDebugEnabled` are iOS-only. Android equivalent (ARCore depth) exists but is not wired to these props.
