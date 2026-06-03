# ViroCameraTexture

`ViroCameraTexture` binds a live device camera feed to a named material's diffuse texture. Every frame rendered, the latest camera image is pushed into the material so any geometry that uses it shows a real-time camera view.

---

## Installation requirements

No extra packages are needed beyond `@reactvision/react-viro`. On both platforms the host app must declare the camera permission before the component is mounted.

**Android** — `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

**iOS** — `Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Used to display live camera feed in AR scenes</string>
```

You are responsible for requesting the permission at runtime before rendering the component. If the permission is not granted the component fires `onError`.

---

## Basic usage

```tsx
import { ViroMaterials, ViroQuad, ViroCameraTexture } from '@reactvision/react-viro';

// 1. Register the material — only lightingModel is required.
//    ViroCameraTexture sets the diffuse texture on it automatically.
ViroMaterials.createMaterials({
  selfieMat: { lightingModel: 'Constant' },
});

// 2. Place a surface and attach the camera texture to its material.
function SelfieScene() {
  return (
    <ViroARScene>
      <ViroQuad
        position={[0, 0, -2]}
        width={1.6}
        height={2.4}
        materials={['selfieMat']}
      />
      <ViroCameraTexture
        material="selfieMat"
        cameraPosition="front"
        onCameraReady={() => console.log('Camera ready')}
        onError={(e) => console.error(e.nativeEvent.error)}
      />
    </ViroARScene>
  );
}
```

`ViroCameraTexture` has no visual representation of its own — it is a sibling of the geometry node, not a child of it.

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `material` | `string` | **required** | Name of a material registered via `ViroMaterials.createMaterials`. The component sets this material's diffuse texture to the live camera feed. |
| `cameraPosition` | `"front" \| "back"` | `"front"` | Which physical camera to open. The front camera feed is automatically mirrored by the OS for a natural selfie effect. |
| `paused` | `boolean` | `false` | When `true`, frame updates stop and the last captured frame is held. Drops CPU and battery usage to near zero. |
| `onCameraReady` | `() => void` | — | Fires once when the first real camera frame is available and the texture is ready. Called from the native Camera2 / AVFoundation callback, not synchronously on mount. |
| `onError` | `(event) => void` | — | Fires when the camera fails to initialise — permission denied, hardware error, or invalid material name. |

---

## Camera position and AR scenes

`ViroARScene` already uses the **back camera** via ARKit / ARCore for tracking and background rendering. `ViroCameraTexture` is independent of that feed — it opens its own camera session.

| Scene type | `cameraPosition` | Result |
|------------|------------------|--------|
| `ViroARScene` | `"front"` | ✅ Two different physical cameras run concurrently — AR tracking on the back, selfie on the front |
| `ViroARScene` | `"back"` | ❌ The OS will deny a second exclusive session on the same sensor already held by ARCore/ARKit |
| `ViroScene` (non-AR) | `"front"` or `"back"` | ✅ No AR framework running, either camera works |

The intended use-case inside an AR scene is always the **front camera** for a selfie overlay while the back camera drives AR tracking.

---

## Switching cameras at runtime

Updating `cameraPosition` while mounted is supported. The native layer disposes the current camera session and opens a new one. A brief black frame may appear during the switch.

```tsx
const [position, setPosition] = React.useState<'front' | 'back'>('front');

<ViroCameraTexture
  material="camMat"
  cameraPosition={position}
/>

<ViroText
  text="Flip"
  onClick={() => setPosition(p => p === 'front' ? 'back' : 'front')}
/>
```

---

## Pausing and resuming

Use `paused` to freeze the feed — useful when the scene is not visible, to save battery, or before taking a snapshot.

```tsx
const [paused, setPaused] = React.useState(false);

<ViroCameraTexture
  material="camMat"
  paused={paused}
/>
```

When `paused` goes from `true` back to `false`, the camera session resumes and the texture begins updating again on the next rendered frame.

---

## Handling errors

```tsx
<ViroCameraTexture
  material="camMat"
  onError={(e) => {
    const { error } = e.nativeEvent;
    if (error.includes('not found')) {
      // material name was wrong
    } else {
      // camera hardware or permission error
    }
  }}
/>
```

Common error causes:

- `CAMERA` permission not granted before mount.
- The `material` name does not match any name registered with `ViroMaterials.createMaterials`.
- The device has no camera matching the requested `cameraPosition`.

---

## Typical AR selfie pattern

```tsx
import React, { useState } from 'react';
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroQuad,
  ViroCameraTexture,
  ViroMaterials,
} from '@reactvision/react-viro';

ViroMaterials.createMaterials({
  selfie: { lightingModel: 'Constant' },
});

function SelfieARScene() {
  const [ready, setReady] = useState(false);

  return (
    <ViroARScene>
      {/* A portrait-ratio quad floating in front of the user */}
      <ViroQuad
        position={[0, 0, -1.5]}
        width={0.9}
        height={1.6}
        materials={['selfie']}
        opacity={ready ? 1 : 0}   // hide until the first frame arrives
      />
      <ViroCameraTexture
        material="selfie"
        cameraPosition="front"
        onCameraReady={() => setReady(true)}
        onError={(e) => console.error('Camera error:', e.nativeEvent.error)}
      />
    </ViroARScene>
  );
}

export default function App() {
  return (
    <ViroARSceneNavigator
      initialScene={{ scene: SelfieARScene }}
      autofocus
    />
  );
}
```

---

## Fullscreen camera (non-AR)

For a fullscreen camera view — a mirror app, a camera preview, etc. — use `ViroScene` instead of `ViroARScene`. There is no AR framework running, so the back camera is not held and either `"front"` or `"back"` works freely. The scene background is solid black, so a quad sized to fill the field of view is the only thing visible.

The formula: at distance `d` from the camera with a 90° horizontal FOV, the quad width that fills the screen is `2 * d * tan(45°) = 2d`. Height is derived from the screen aspect ratio.

```tsx
import React, { useState } from 'react';
import { Dimensions } from 'react-native';
import {
  ViroScene,
  ViroSceneNavigator,
  ViroQuad,
  ViroCameraTexture,
  ViroMaterials,
} from '@reactvision/react-viro';

ViroMaterials.createMaterials({
  mirror: { lightingModel: 'Constant' },
});

const DIST   = 1;
const WIDTH  = 2 * DIST;                                        // fills 90° horizontal FOV
const { width: sw, height: sh } = Dimensions.get('window');
const HEIGHT = WIDTH * (sh / sw);                               // match screen aspect ratio

function FullscreenSelfieScene() {
  const [ready, setReady] = useState(false);

  return (
    <ViroScene>
      <ViroQuad
        position={[0, 0, -DIST]}
        width={WIDTH}
        height={HEIGHT}
        materials={['mirror']}
        opacity={ready ? 1 : 0}
      />
      <ViroCameraTexture
        material="mirror"
        cameraPosition="front"
        onCameraReady={() => setReady(true)}
        onError={(e) => console.error(e.nativeEvent.error)}
      />
    </ViroScene>
  );
}

export default function App() {
  return (
    <ViroSceneNavigator
      initialScene={{ scene: FullscreenSelfieScene }}
    />
  );
}
```

**Custom FOV** — if you configure a non-default FOV on the camera node, adjust the width formula:
```ts
const WIDTH = 2 * DIST * Math.tan((fovDegrees / 2) * (Math.PI / 180));
```

**Orientation changes** — `Dimensions.get` is evaluated at module load time. To support landscape, recompute `HEIGHT` inside the scene using a `Dimensions` event listener or the `useWindowDimensions` hook.

**Mirroring** — the OS mirrors the front camera feed automatically. No transform is needed on the quad.

---

## Capturing photos and video

`ViroCameraTexture` exposes three async instance methods for capturing from the live camera feed. They communicate with the native layer via `NativeModules.VRTCameraTextureModule` under the hood — no extra setup is needed.

All three methods return a `ViroCaptureResult`:

```ts
type ViroCaptureResult =
  | { success: true;  url: string }   // absolute path of the written file
  | { success: false; error: string } // human-readable error
```

### capturePhoto(options?)

Saves the current frame as a JPEG. The promise resolves after the file has been written.

```ts
capturePhoto(options?: { outputPath?: string }): Promise<ViroCaptureResult>
```

- `outputPath` — absolute path for the output file (e.g. from `react-native-fs`). Omit to use a default cache-directory path chosen by the native layer.

```tsx
import React, { useRef } from 'react';
import { Button } from 'react-native';
import { ViroARScene, ViroQuad, ViroCameraTexture, ViroMaterials } from '@reactvision/react-viro';

ViroMaterials.createMaterials({ cam: { lightingModel: 'Constant' } });

function Scene() {
  const cameraRef = useRef<ViroCameraTexture>(null);

  const takePhoto = async () => {
    const result = await cameraRef.current?.capturePhoto();
    if (result?.success) {
      console.log('Photo saved to', result.url);
    } else {
      console.error('Capture failed:', result?.error);
    }
  };

  return (
    <ViroARScene>
      <ViroQuad position={[0, 0, -1.5]} width={0.9} height={1.6} materials={['cam']} />
      <ViroCameraTexture ref={cameraRef} material="cam" cameraPosition="front" />
      {/* Trigger takePhoto from your UI */}
    </ViroARScene>
  );
}
```

### startRecording(options?) / stopRecording()

Record the camera feed to an MP4. `startRecording` resolves once the recording session is open; `stopRecording` finalises the file and resolves with its path.

```ts
startRecording(options?: { outputPath?: string }): Promise<ViroCaptureResult>
stopRecording(): Promise<ViroCaptureResult>
```

```tsx
import React, { useRef, useState } from 'react';
import { Button } from 'react-native';
import { ViroARScene, ViroQuad, ViroCameraTexture, ViroMaterials } from '@reactvision/react-viro';

ViroMaterials.createMaterials({ cam: { lightingModel: 'Constant' } });

function Scene() {
  const cameraRef = useRef<ViroCameraTexture>(null);
  const [recording, setRecording] = useState(false);

  const toggleRecording = async () => {
    if (!recording) {
      const result = await cameraRef.current?.startRecording();
      if (result?.success) {
        setRecording(true);
        console.log('Recording started, will write to', result.url);
      }
    } else {
      const result = await cameraRef.current?.stopRecording();
      setRecording(false);
      if (result?.success) {
        console.log('Video saved to', result.url);
      }
    }
  };

  return (
    <ViroARScene>
      <ViroQuad position={[0, 0, -1.5]} width={0.9} height={1.6} materials={['cam']} />
      <ViroCameraTexture ref={cameraRef} material="cam" cameraPosition="front" />
    </ViroARScene>
  );
}
```

### Permissions for video recording

Recording audio alongside the video requires the microphone permission. Declare it in addition to the camera permission and request it at runtime before calling `startRecording`.

**Android** — `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

**iOS** — `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Used to record audio with video captures</string>
```

If the microphone permission is not granted, `startRecording` will resolve with `{ success: false, error: "..." }` on Android (Camera2 session will fail to configure the MediaRecorder audio source). On iOS the recording will succeed but will contain no audio track.

---

## Notes

- The material only needs a `lightingModel` — no texture property is required. `ViroCameraTexture` overwrites whatever diffuse texture the material has while it is mounted and clears it on unmount.
- The texture resolution is fixed at **1280 × 720** on Android. On iOS it follows the AVFoundation session preset (default `AVCaptureSessionPresetHigh`).
- The front camera feed is mirrored automatically by the OS. No transform is needed on the geometry.
- Multiple `ViroCameraTexture` components targeting the same material name will conflict — only the last one to mount will hold the texture.

---

## Choosing between `ViroCameraTexture` and `frontCameraEnabled`

Both features deliver a front-camera feed, but they serve different use cases:

| | `ViroCameraTexture` | `frontCameraEnabled` on ViroARSceneNavigator |
|---|---|---|
| **Feed destination** | Material texture on any geometry | Full-screen AR session background |
| **AR tracking** | Back camera AR remains active | Front camera, no world tracking |
| **Coordinate system** | World-locked AR (back camera) | Gravity-aligned (iOS) / device-relative (Android) |
| **Selfie mirror effect** | ✅ Quad/sphere with camera texture | ❌ Not a mirror — whole scene is front camera |
| **Face filter / overlay** | ❌ No face tracking | ✅ ARFaceTracking (iOS) / Augmented Faces (Android) |
| **Capture photo/video** | ✅ `capturePhoto()`, `startRecording()` | ❌ Not supported |
| **Typical use case** | Picture-in-picture, VR mirror, AR viewport | Selfie AR, face effects, front-facing scenes |

**Use `ViroCameraTexture` when:**
- You want to show a camera feed on a specific surface (mirror, screen, viewport)
- You need to keep the back-camera AR world active simultaneously
- You want photo or video capture from the front camera

**Use `frontCameraEnabled` when:**
- The entire scene should use the front camera as background
- You want face-tracking behavior (content anchored relative to face or gravity)
- No geometry-level camera texture needed

See [`PLATFORM_EXTENSIONS.md`](./PLATFORM_EXTENSIONS.md) for the `frontCameraEnabled` API reference.
