# ViroObjectDetector

On-device, open-vocabulary object detection powered by [YOLOE](https://docs.ultralytics.com/models/yoloe/) running through ONNX Runtime. Everything runs locally on the device.

`ViroObjectDetector` works **only in AR**: it shares the camera feed of an enclosing `ViroARSceneNavigator` (it never opens a camera of its own), runs inference at a throttled frame rate, and fires `onDetection` with bounding boxes and labels. It renders nothing itself — mount it as a child or sibling of the navigator and give it `width: 0, height: 0`.

> **Inference provider required.** `ViroObjectDetector` ships the camera + plumbing, but the actual ONNX inference lives in the companion package **[`@reactvision/react-viro-onnx`](https://github.com/ReactVision/react-viro-onnx)**. Neither platform falls back to anything if it's missing: the detector stays silent and fires `onError` ("No ONNX inference provider registered…"). Add the package to your `plugins` and it auto-registers (see its README).

---

## Installation

You need **two** packages: this component (`@reactvision/react-viro`) and the ONNX inference provider (`@reactvision/react-viro-onnx`). Both are Expo config plugins.

1. Install:
   ```bash
   npm install @reactvision/react-viro @reactvision/react-viro-onnx
   ```
2. Add **both** to `app.json` — the provider **after** the component:
   ```json
   { "expo": { "plugins": ["@reactvision/react-viro", "@reactvision/react-viro-onnx"] } }
   ```
3. Let Metro resolve `.onnx` as an asset, in `metro.config.js`:
   ```js
   config.resolver.assetExts.push("onnx"); // (+ "glb", "gltf", "vrx" for 3D assets)
   ```
4. Bundle a model into the **native** project — see [Model bundling](#model-bundling). This is the most common source of a runtime `model not found`.
5. Generate native projects and run:
   ```bash
   npx expo prebuild        # add --clean to regenerate from scratch (see Model bundling caveat)
   npx expo run:android     # / run:ios
   ```

For native details (iOS pod / onnxruntime AAR), custom-model export, NNAPI, and **local development** of the provider (it installs from a packed tarball — changes require a re-pack), see the provider's **[README](https://github.com/ReactVision/react-viro-onnx)**.

---

## Quick start

Mount the detector alongside a `ViroARSceneNavigator`. It shares the AR camera feed and renders nothing itself, so give it a zero size (see [AR mode](#ar-mode)).

```tsx
import { ViroARSceneNavigator, ViroObjectDetector, type ViroDetectedObject } from "@reactvision/react-viro";

<>
  <ViroARSceneNavigator initialScene={{ scene: MyScene }} />
  <ViroObjectDetector
    style={{ position: "absolute", width: 0, height: 0 }}
    model="yoloe-26n"
    mode="prompt-free"
    confidenceThreshold={0.45}
    maxFPS={15}
    maxDetections={20}
    onDetection={({ detections }) =>
      detections.forEach((d) => console.log(d.label, d.confidence, d.screenBoundingBox))
    }
  />
</>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `string` | `"yoloe-26s"` | Model name (resolved in the app bundle as `<name>.onnx`) or an absolute `/`-path / `file://` URL to an `.onnx` file. |
| `mode` | `"prompt-free" \| "text" \| "visual"` | `"prompt-free"` | See [Modes](#modes). |
| `categories` | `string[]` | `[]` | Class names to keep in `"text"` mode. Matched by whole word, case-insensitive. |
| `confidenceThreshold` | `number` | `0.4` | Minimum score `[0,1]` to emit a detection. |
| `iouThreshold` | `number` | `0.45` | IoU threshold for NMS de-duplication. |
| `maxFPS` | `number` | `15` | Max inference calls/sec. The AR session runs at native FPS; this throttles the inference thread so it doesn't saturate the CPU/NPU while the renderer runs. |
| `maxDetections` | `number` | `20` | Max detections emitted per frame, kept as the top-N by confidence (after NMS). |
| `projectToWorld` | `boolean` | `true` | When `true`, raycast each detection to 3D and include `worldPosition`. iOS only (Android emits `screenBoundingBox` but not yet `worldPosition`). |
| `onDetection` | `(e: { detections: ViroDetectedObject[] }) => void` | — | Fired each processed frame (possibly with an empty array). |
| `onReady` | `() => void` | — | Fired once the model is loaded and the pipeline is running. |
| `onError` | `(e: { error: string }) => void` | — | Fired on model-load / camera failure. |

### `ViroDetectedObject`

```ts
type ViroDetectedObject = {
  label: string;
  confidence: number;                       // [0,1]
  boundingBox: { x; y; width; height };        // normalized [0,1], model input space
  screenBoundingBox?: { x; y; width; height }; // dp/points, aligned to the AR preview (iOS + Android)
  worldPosition?: { x; y; z };                 // metres, with projectToWorld (iOS only)
};
```

---

## Modes

- **`prompt-free`** — the model detects everything in its baked vocabulary (the stock `yoloe-26n` prompt-free export carries **4,585** classes). Rich but noisy; labels can be fine-grained or scene-level.
- **`text`** — keep only detections whose label matches one of `categories` (whole-word, case-insensitive: `"phone"` matches `"cell phone"`, `"cup"` matches `"coffee cup"`, but `"pen"` does **not** match `"pencil"`).

  > ⚠️ `text` mode is purely a **label post-filter**. It runs after inference and keeps only the detections whose label word-matches one of `categories`; it does **not** prompt the model at runtime (there is no CLIP/text encoder in the inference path, and the model's class set is fixed at export time). So it can only surface classes the loaded model already emits — and on the stock prompt-free model, which rarely emits common nouns with high recall, it returns very little.
  >
  > To actually target classes by text, bake them into the model at **export** time: run [`react-viro-onnx`'s `export_text_model.py`](https://github.com/ReactVision/react-viro-onnx#exporting-a-text-prompt-model), which reparametrizes the detection head (RepRTA) against your class list. With such a model you usually don't need `text` mode at all — **`prompt-free` already returns only your baked classes** with high recall. Use `text` + `categories` on top of it only when you want to narrow the output to a subset of those classes.

- **`visual`** — reference-image prompting (SAVPE). Reserved; not yet wired.

---

## Coordinate system

- `boundingBox` is always present and **normalized `[0,1]`** in the model's (portrait) input space.
- The native side also computes `screenBoundingBox` in **density-independent points (dp)**, aligned to the on-screen AR preview — drop it straight into the `{ left, top, width, height }` of an absolutely-positioned overlay `View`. Since React Native already lays out in dp, you don't have to convert anything yourself. The values can go negative or exceed the view bounds when an object extends past the visible edges; the overlay simply clips it.
  - **iOS:** maps detections through ARKit's `displayTransform` (points) and inverts the center-square crop.
  - **Android:** the renderer hands the detector the **full, uncropped** rotated camera frame plus the **viewport crop rectangle**; the detector inverts the center-square crop → full-frame pixels → maps through the crop rect to the view (the Android equivalent of `displayTransform`) → converts to dp. Boxes land on the visible objects without manual calibration.
- `worldPosition` (with `projectToWorld`, iOS) is the ARKit hit-test of the box center, in world metres.

---

## AR mode

The detector reuses the enclosing `ViroARSceneNavigator`'s camera feed rather than opening a second one, so the two don't contend for the camera: on iOS it taps ARKit's `currentFrame.capturedImage`; on Android it attaches a camera-image listener to the enclosing `ViroViewARCore`. Each detection carries `screenBoundingBox` (and `worldPosition` on iOS).

> The detector can be a **sibling** of `ViroARSceneNavigator` (it doesn't need to be a child) — it finds the AR view by walking the tree. Give it `width: 0, height: 0`; it renders nothing itself. If no `ViroARSceneNavigator` is found in the tree, it fires `onError`.

```tsx
<ViroARSceneNavigator initialScene={{ scene: MyScene }} />
<ViroObjectDetector
  style={{ position: "absolute", width: 0, height: 0 }}  // renders nothing itself
  model="yoloe-26n-text"
  mode="text"
  categories={["cup", "laptop", "keyboard", "mouse", "monitor", "book"]}
  projectToWorld
  onDetection={drawBoxes}
/>
```

Draw the overlay from `screenBoundingBox`. For stable boxes across frames, bind each detection to a slot by **screen proximity** (not array index or label) and EMA-smooth — the model's confidence ordering and labels flicker frame-to-frame, so index/label matching makes boxes swap places. See the showcase `yoloe-ar-scene` component for a reference tracker.

---

## Platform support

| Capability | iOS | Android |
|------------|-----|---------|
| AR-session detection (shared camera feed) | ✅ (ARKit `currentFrame`) | ✅ (`ViroViewARCore` listener) |
| ONNX inference + NMS + class names from metadata | ✅ | ✅ |
| `text` mode category filter, `maxDetections` | ✅ | ✅ |
| Center-square crop preprocessing | ✅ | ✅ |
| `screenBoundingBox` (dp, aligned) | ✅ (ARKit `displayTransform`) | ✅ (uncropped frame + viewport crop rect) |
| `worldPosition` | ✅ (ARKit hit-test) | ⏳ not yet (use `screenBoundingBox`) |

Android reaches iOS parity for detection and the 2D overlay. Remaining differences:
- **`worldPosition`** (3D raycast) is not yet emitted on Android; `performARHitTest` is async, so it needs a gather-before-emit pass. The 2D overlay uses `screenBoundingBox` and does not require it.
- **Vertical field of view (Android AR).** The model input is the center **square** crop of the delivered frame. ARCore delivers a portrait frame, so the square spans the full width but only the central **~55–60%** of the vertical FOV — objects near the very top/bottom of the screen aren't seen. (Detected objects are still placed correctly.) iOS crops a landscape sensor frame, so its square covers more vertical FOV. Widening this on Android would mean feeding the model the landscape sensor frame — a future change.

---

## Model bundling

When `model` is a **name** (e.g. `"yoloe-26n-text"`), the native loader reads it from the app's **native bundle** by name — *not* from the Metro/JS asset graph. So the `.onnx` must be copied into the native project:

- **Android:** `android/app/src/main/assets/models/<name>.onnx`. The loader opens `models/<name>.onnx` from Android assets.
- **iOS:** add the file to the target's *Copy Bundle Resources*. The loader checks the bundle root, then `assets/models/`, then `models/`.

Alternatively pass an **absolute path or `file://` URL** as `model` (e.g. a model you downloaded to the filesystem) — that path is read directly and needs no bundling.

> ⚠️ **`expo prebuild --clean` wipes the native project** and with it any `.onnx` you copied into `android/app/src/main/assets/` — you'll then get `model not found` at runtime. Keep the model in `assets/models/` as the source of truth and **re-copy after a clean prebuild**, or (recommended) add a tiny local config plugin that copies it on every prebuild:
>
> ```js
> // plugins/with-onnx-models.js
> const { withDangerousMod } = require("expo/config-plugins");
> const fs = require("fs"); const path = require("path");
> module.exports = (config) =>
>   withDangerousMod(config, ["android", (cfg) => {
>     const src = path.join(cfg.modRequest.projectRoot, "assets/models");
>     const dst = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/assets/models");
>     fs.mkdirSync(dst, { recursive: true });
>     for (const f of fs.readdirSync(src).filter((f) => f.endsWith(".onnx")))
>       fs.copyFileSync(path.join(src, f), path.join(dst, f));
>     return cfg;
>   }]);
> ```
> Then list `"./plugins/with-onnx-models"` in `app.json` `plugins`. (Listing `onnx` in `metro.config.js` `assetExts` only affects `require()`-style loading, not the native name lookup.)

See [`react-viro-onnx`](https://github.com/ReactVision/react-viro-onnx) for installing the inference provider and exporting custom models.
