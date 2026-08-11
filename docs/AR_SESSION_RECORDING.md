# AR Session Recording

Records an AR session to local device storage — the camera passthrough feed, raw IMU, and the platform's own tracked pose — for **offline analysis or replay on a dev machine**. There is no in-app playback of a recording; the consumer is a separate offline tool (`tinyvio`'s `tv_replay`, driven directly or via the ReactVision MCP server's `reactviro_validate_recording`), not this SDK.

> Not to be confused with **screen recording** (`startVideoRecording`/`stopVideoRecording`, [`ViroCameraTexture`'s own `startRecording`](./ViroCameraTexture.md#recording)) — those capture the *rendered output* or *camera-texture feed* as a normal video. This feature instead captures the raw inputs a visual-inertial tracking engine needs to re-run the exact same session offline: video + IMU + ground-truth pose, kept as three separate streams rather than one video file.

## Why you'd use this

Field-testing AR tracking quality is otherwise "walk around with the app and eyeball it." This lets you capture a real session once, then run it through a tracking engine headlessly, as many times as you want, to get concrete numbers on anchor drift and tracking dropouts — the exact "did the anchor stay where I put it?" question a field test is really asking. It's the input format for `reactviro_validate_recording` (see the ReactVision MCP server) and any custom `tinyvio`-based tooling.

## Quick start

```tsx
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { Directory, Paths } from "expo-file-system"; // or any other way to get a writable path

const navigatorRef = useRef<any>(null);

// Start
const dir = new Directory(Paths.document, `recording-${Date.now()}`);
dir.create({ intermediates: true });
const outputDir = dir.uri.replace(/^file:\/\//, ""); // native wants a plain path, not a file:// URI
const { success, error } = await navigatorRef.current.arSceneNavigator.startRecording(outputDir);

// ...later...
await navigatorRef.current.arSceneNavigator.stopRecording();
```

`outputDir` will contain `video.mp4` (H.264, the camera passthrough feed) and `session.jsonl` (one JSON object per line: a `header` with camera intrinsics, `imu` samples, and `pose` samples — one per encoded video frame) once recording stops. The exact format is specified in the workspace plan doc `viro-ar-recording-playback-plan.md` — the short version: raw accelerometer/gyroscope readings come from an independent sensor tap, not from ARKit/ARCore's internal fusion (neither platform exposes that), and the recorded pose is the platform's own tracking output, kept only as ground truth to score a different engine's tracking against — it is never fed back into anything.

## API reference

### `startRecording(outputDir: string): Promise<{ success: boolean; error?: string }>`

Starts recording. `outputDir` is created if it doesn't exist. Fails (with `success: false`) if a recording is already in progress, if the directory can't be created, or if the device has no raw accelerometer/gyroscope (Android) — check `error` for the reason.

### `stopRecording(): Promise<void>`

Stops recording and finalizes `video.mp4` + `session.jsonl`. No-op if nothing is recording.

### `getRecordingStatus(): Promise<"None" | "Recording" | "IOError" | "Unsupported">`

- **`None`** — not recording (either never started, or already stopped).
- **`Recording`** — actively writing.
- **`IOError`** — the encoder or sidecar file hit a write error mid-recording; the recording is likely incomplete. Call `stopRecording()` to clean up and inspect the device's logs for the underlying error.
- **`Unsupported`** — this platform/session can't record (there is no web/visionOS/Quest implementation — see Platform support below).

## Getting the files off the device

**The recording writes into the app's sandboxed Documents directory**, which is not visible anywhere on iOS by default. Do one (ideally both) of the following:

1. **Enable Files-app access** — add to `app.json`:
   ```json
   { "expo": { "ios": { "infoPlist": {
     "UIFileSharingEnabled": true,
     "LSSupportsOpeningDocumentsInPlace": true
   } } } }
   ```
   This makes the app's Documents directory browsable from the iOS Files app, under "On My iPhone/iPad" → your app name — the user can then drag files out, AirDrop them, etc.
2. **Share immediately after stopping**, via `expo-sharing`:
   ```tsx
   import * as Sharing from "expo-sharing";
   await Sharing.shareAsync(`file://${outputDir}/video.mp4`);
   await Sharing.shareAsync(`file://${outputDir}/session.jsonl`);
   ```
   This is the more immediate UX — no need for the user to go find the file themselves — but doesn't help for recordings from a *previous* run if you didn't grab the share sheet at the time; that's what (1) is for.

Android has no equivalent sandboxing problem for this use case — files under the app's external files directory are reachable via `adb pull` or a file manager without extra configuration, though `Sharing.shareAsync` still works there too for a one-tap flow.

## Platform support

| Platform | Status |
|---|---|
| iOS | ✅ — `AVAssetWriter` fed directly from ARKit's own `CVPixelBuffer` (no extra render pass), `CMMotionManager`'s raw accelerometer/gyroscope APIs (not the fused `CMDeviceMotion` path) |
| Android | ✅ — `MediaCodec`/`MediaMuxer` in buffer mode fed from ARCore's `acquireCameraImage()` YUV planes, `SensorManager`'s `TYPE_ACCELEROMETER`/`TYPE_GYROSCOPE` |
| Web / visionOS / Quest | ❌ `getRecordingStatus()` returns `"Unsupported"`; `startRecording()` resolves `{ success: false, error: "Recording not supported" }` |

## Developer test scene

`showcase/components/ar-examples/session-recording.tsx` is a minimal Start/Stop/Share harness with a live `getRecordingStatus()` poll and a Share button, useful as a working reference for the output-directory + share-sheet pattern above.

## Gotchas

- **One `pose` line per encoded video frame is the only thing associating a pose with a frame** — the MP4 carries frame numbers, the sidecar carries timestamps, and there's nothing else to key on. If you're writing your own consumer (rather than using `tv_replay`), don't assume you can decimate one stream without the other staying in lockstep.
- **`orientation` is device-from-reference, and pairs with `gravity`.** A `[x, y, z, w]`-ordered quaternion landed straight into a `(w, x, y, z)`-ordered struct inverts the rotation reference silently — it reads as poor tracking, not as a parsing bug. If you're writing a custom consumer, check a candidate interpretation against the recorded `gravity` vector rather than trusting the convention blindly.
- **This is not related to `provider`/cloud anchors/VPS-Lite.** It has no dependency on `ReactVisionCCA` or any cloud backend — it's a pure local capture, works fully offline, and needs no API key.
