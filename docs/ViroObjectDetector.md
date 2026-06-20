# ViroObjectDetector

On-device, open-vocabulary object detection powered by [YOLOE](https://docs.ultralytics.com/models/yoloe/) running through ONNX Runtime. Runs fully offline — no network, no cloud.

The component opens a camera feed (its own `AVCaptureSession`/CameraX, or the shared AR session), runs inference at a throttled frame rate, and fires `onDetection` with bounding boxes and labels.

> **Inference provider required.** `ViroObjectDetector` ships the camera + plumbing, but the actual ONNX inference lives in the companion package **[`@reactvision/react-viro-onnx`](../../react-viro-onnx/README.md)**. Without it the camera runs but every frame returns zero detections. Add it to your `plugins` and it auto-registers (see its README).

---

## Quick start

```tsx
import { ViroObjectDetector, type ViroDetectedObject } from "@reactvision/react-viro";
import { StyleSheet } from "react-native";

<ViroObjectDetector
  style={StyleSheet.absoluteFill}
  model="yoloe-26n"
  mode="prompt-free"
  confidenceThreshold={0.45}
  maxFPS={15}
  maxDetections={20}
  onDetection={({ detections }) =>
    detections.forEach((d) => console.log(d.label, d.confidence, d.boundingBox))
  }
/>
```

For an AR overlay that shares the ARKit/ARCore session, mount it inside a `ViroARSceneNavigator` with `useARSession` (see [AR mode](#ar-mode)).

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `string` | `"yoloe-26s"` | Model name (resolved in the app bundle as `<name>.onnx`) or an absolute `/`-path / `file://` URL to an `.onnx` file. |
| `mode` | `"prompt-free" \| "text" \| "visual"` | `"prompt-free"` | See [Modes](#modes). |
| `categories` | `string[]` | `[]` | Class names to keep in `"text"` mode. Matched by whole word, case-insensitive. |
| `confidenceThreshold` | `number` | `0.4` | Minimum score `[0,1]` to emit a detection. |
| `iouThreshold` | `number` | `0.45` | IoU threshold for NMS de-duplication. |
| `maxFPS` | `number` | `15` | Max inference calls/sec. The camera runs at native FPS; this throttles the inference thread so it doesn't saturate the CPU/NPU while the renderer runs. |
| `maxDetections` | `number` | `20` | Max detections emitted per frame, kept as the top-N by confidence (after NMS). |
| `cameraPosition` | `"front" \| "back"` | `"back"` | Camera to sample (standalone mode only). |
| `useARSession` | `boolean` | `false` | When `true`, do **not** open a camera; subscribe to the enclosing `ViroARSceneNavigator`'s AR frames instead. **iOS only** (see [Platform support](#platform-support)). |
| `projectToWorld` | `boolean` | `true` | When `true` (and `useARSession`), raycast each detection to 3D and include `worldPosition`. iOS only. |
| `onDetection` | `(e: { detections: ViroDetectedObject[] }) => void` | — | Fired each processed frame (possibly with an empty array). |
| `onReady` | `() => void` | — | Fired once the model is loaded and the pipeline is running. |
| `onError` | `(e: { error: string }) => void` | — | Fired on model-load / camera failure. |

### `ViroDetectedObject`

```ts
type ViroDetectedObject = {
  label: string;
  confidence: number;                       // [0,1]
  boundingBox: { x; y; width; height };     // normalized [0,1]
  screenBoundingBox?: { x; y; width; height }; // screen pixels (AR mode, iOS)
  worldPosition?: { x; y; z };              // metres (AR mode + projectToWorld, iOS)
};
```

---

## Modes

- **`prompt-free`** — the model detects everything in its baked vocabulary (the stock `yoloe-26n` prompt-free export carries **4,585** classes). Rich but noisy; labels can be fine-grained or scene-level.
- **`text`** — keep only detections whose label matches one of `categories` (whole-word, case-insensitive: `"phone"` matches `"cell phone"`, `"cup"` matches `"coffee cup"`, but `"pen"` does **not** match `"pencil"`).

  > ⚠️ `text` mode is a **post-filter** over the model's output. It can only surface classes the loaded model already emits. The stock prompt-free model rarely emits common nouns with high recall, so `text` mode on it returns very little. For real text-targeted detection, export a **text-prompt (RepRTA) model** with your classes baked in — see [`react-viro-onnx`'s model export guide](../../react-viro-onnx/README.md#exporting-a-text-prompt-model). With such a model, `text` mode (or even `prompt-free`) yields high recall on your classes.

- **`visual`** — reference-image prompting (SAVPE). Reserved; not yet wired.

---

## Coordinate system

- `boundingBox` is always present and **normalized `[0,1]`** in the model's (portrait) input space.
- In **AR mode (iOS)** the native side additionally computes `screenBoundingBox` in **screen pixels**, aligned to the on-screen AR preview. It maps detections through ARKit's `displayTransform` and inverts the center-square crop used during preprocessing, so boxes land on the visible objects regardless of FOV/orientation. Use it directly as `{ left, top, width, height }` on an absolutely-positioned overlay `View`.
- `worldPosition` (AR + `projectToWorld`, iOS) is the ARKit hit-test of the box center, in world metres.

In standalone (non-AR) mode, map `boundingBox` to the preview yourself using the preview layer's `resizeAspectFill` geometry.

---

## AR mode

Mount inside a `ViroARSceneNavigator` and set `useARSession`. The detector taps ARKit's `currentFrame.capturedImage` instead of opening its own camera (no duplicate feed, no camera contention). Each detection then carries `screenBoundingBox` (and optionally `worldPosition`).

```tsx
<ViroARSceneNavigator initialScene={{ scene: MyScene }} />
<ViroObjectDetector
  style={{ position: "absolute", width: 0, height: 0 }}  // renders nothing itself
  model="yoloe-26n-text"
  mode="text"
  categories={["cup", "laptop", "keyboard", "mouse", "monitor", "book"]}
  useARSession
  projectToWorld
  onDetection={drawBoxes}
/>
```

Draw the overlay from `screenBoundingBox`. For stable boxes across frames, bind each detection to a slot by **screen proximity** (not array index or label) and EMA-smooth — the model's confidence ordering and labels flicker frame-to-frame, so index/label matching makes boxes swap places. See the showcase `yoloe-ar-scene` component for a reference tracker.

---

## Platform support

| Capability | iOS | Android |
|------------|-----|---------|
| Standalone camera detection | ✅ | ✅ (CameraX) |
| ONNX inference + NMS + class names from metadata | ✅ | ✅ |
| `text` mode category filter, `maxDetections` | ✅ | ✅ |
| Center-square crop preprocessing | ✅ | ✅ |
| **AR-session mode** (`useARSession`) | ✅ | ✅ (shares the `ViroViewARCore` camera feed) |
| `screenBoundingBox` | ✅ (ARKit `displayTransform`) | ✅ (camera→view aspectFill; may need on-device calibration) |
| `worldPosition` | ✅ (ARKit hit-test) | ⏳ not yet (use `screenBoundingBox`) |

Android reaches iOS parity for detection and 2D overlay. Two caveats:
- **`screenBoundingBox`** is mapped via an aspectFill of the camera image into the AR view (ARCore doesn't expose its viewport transform to Java). Like iOS's mapping, expect to calibrate camera orientation on-device — if boxes are rotated/offset, the rotation in `preprocessBitmap`/`addScreenBox` is the knob.
- **`worldPosition`** (3D raycast) is not yet emitted on Android; `performARHitTest` is async, so it needs a gather-before-emit pass. The 2D demo uses `screenBoundingBox` and does not require it.

---

## Model bundling

The `.onnx` file must be in the app bundle so the native loader can find it by name.

- **iOS:** add the file to the target's *Copy Bundle Resources*. The loader checks the bundle root, then `assets/models/`, then `models/`.
- **Android:** place it under `android/app/src/main/assets/` (or `assets/models/`).
- **Expo:** keep the file in `assets/models/` and ensure `metro.config.js` lists `onnx` in `assetExts`. For iOS you still need it in *Copy Bundle Resources* (a config plugin or a manual `.pbxproj` entry).

See [`react-viro-onnx`](../../react-viro-onnx/README.md) for installing the inference provider and exporting custom models.
