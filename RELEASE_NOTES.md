# Release Notes

## Unreleased

### Fixed

- **Quest builds failed Meta Horizon Store validation on Expo projects.** The plugin's targetSdk cap never applied on Expo's template and the GLES declaration was optional, which the store reads as missing. With `"QUEST"` in `xRMode` the plugin now sets `android.targetSdkVersion=34` in `gradle.properties` and requires GLES 3.0.

### Added

- **Quest Store packaging defaults**: arm64-only builds (`android.questArm64Only`, default true) and a `com.oculus.supportedDevices` manifest entry (`android.questSupportedDevices`, default `quest2|questpro|quest3|quest3s`).

## v2.58.1

### Fixed

- **AR session recordings played sideways (iOS and Android).** Video captured by `ViroARSceneNavigator.startRecording()` carried no rotation, so it played in the camera sensor's landscape orientation however the phone was held. Both platforms now tag the file so players show it upright.
- **AR session recordings were unusable for analysis on iOS.** The IMU was written in G while Android wrote m/s² — the same `session.jsonl` field meaning two things, off by 9.81×. iOS now writes m/s². Against tinyvio on a real recording this moved tracking from 0% of frames to 96%. A second iOS fix keeps the sidecar and the video in step: duplicate ARKit frames are dropped whole, and a pose is only written once its frame has reached the encoder.
- **AR session recordings had scrambled colour (Android).** The same video came out sharp and correctly framed but under large green/magenta blocks — the encoder was fed a pixel layout it did not actually use. Frames are now handed to it through its real per-plane strides.

All fixed in `@reactvision/virocore` 2.58.1. None of them affect `startVideoRecording()`, which records the rendered screen and was never involved.

### Migration

- **No breaking changes.**
- iOS `imu.accel`/`pose.gravity` are now m/s² rather than G, matching Android; the format only shipped in 2.58.0, so there is effectively no earlier data to reconcile.
- Tooling that decodes a recording's `video.mp4` for tracking should pass ffmpeg `-noautorotate`: the new rotation is container metadata only, so the frames still match `session.jsonl`'s intrinsics, but ffmpeg rotates by default and would leave the geometry wrong without erroring. Older recordings are unaffected by the flag.
- Pairs with `@reactvision/virocore` 2.58.1.

See [`CHANGELOG.md`](./CHANGELOG.md) for full detail.

---

## v2.58.0

### Highlights

**AR Session Recording**

- `startRecording()`/`stopRecording()`/`getRecordingStatus()` on `ViroARSceneNavigator` capture video + raw IMU + ground-truth pose to local storage, for offline analysis via `tinyvio` — distinct from `ViroCameraTexture`'s screen-only recording.

### Fixed

- The package could crash immediately when bundled with `react-native-web` — ten native-only components had no `.web.tsx` variant and crashed the shared import barrel regardless of what an app actually used. Fixed with stub implementations for all ten.
- GLB/glTF models with sparse accessors or non-indexed primitives now load correctly (previously failed) — fixed in `@reactvision/virocore` 2.58.0.

### Changed

- Android alert dialogs now follow Material 3 instead of the Material 2 look inherited from the RN/Expo template theme (#508). Only the `alertDialogTheme` attribute is overlaid, so the rest of your app's theme is untouched. *(Shipped in 2.58.0; documented retroactively.)*

### Migration

- **No breaking changes.** Everything in this release is additive or a bug fix.
- `docs/` no longer ships in this package — see the CHANGELOG's Changed section if you had bookmarked a `docs/*.md` path.
- Pairs with `@reactvision/virocore` 2.58.0.

See [`CHANGELOG.md`](./CHANGELOG.md) for full detail.

---

## v2.57.5

### Highlights

**Stability / crashes**

- **Scene-open freeze fixed (Android).** Opening an AR scene with heavier content (3D models / video) could freeze the app for ~5 s (ANR) on some devices. An interim camera-background workaround was replaying `pause → resume` on the UI thread, which blocked the main thread in `GLSurfaceView.onPause()` waiting on the GL thread. The workaround was removed now that the renderer handles camera-texture binding natively; the black-passthrough issue it guarded against stays fixed.
- **Animated glTF model crash fixed.** Loading an animated model whose rig has a zero-duration animation channel (a single keyframe / all-zero times — legal glTF) crashed with a native `SIGSEGV` (divide-by-zero → `NaN` keyframe times → corrupted sort in the renderer's skeletal-animation resampler). Guarded in the renderer.
- **Anchor-retry crash fixed (Android, SIGSEGV).** Leaving/switching an AR scene while a node's anchor retry was pending could crash in `nativeCreateAnchoredNode`; the retry now bails when the parent scene is torn down (plus a native null-ref guard in the renderer).
- **`getTransformAsync` / `getBoundingBoxAsync` / `getMorphTargets` no longer redbox or hang** when the node isn't registered yet (a normal mount race hit by `onProximity`). They now reject with `view_not_ready` so callers can retry/ignore quietly (iOS + Android).

**Features**

- **`onGaze` — eye-gaze hover on Meta Quest Pro.** New optional event on every Viro node that fires when the node is hovered by the user's eye-gaze ray (renderer support via `XR_EXT_eye_gaze_interaction`, Quest Pro). `onHover` still fires for all input sources; `onGaze` is eye-gaze-only, and setting it alone enables hover on the node. No-op on headsets without eye tracking (Quest 2 / 3 / 3S).
- **Free-tier watermark now burned into recorded video on Android** (previously photo-only), composited natively per frame in the renderer — at parity with iOS.

**Media**

- **Android media files are now reliably written (API 29+).** Screenshots and video recordings were silently failing under scoped storage (raw write to public `Pictures/` → `EACCES`), or landing in app-private storage invisible to the gallery. Media now writes to app-specific storage (always succeeds) and is published to the gallery via `MediaStore` when `saveToCameraRoll` is set. Permission gate corrected (`RECORD_AUDIO`; `WRITE_EXTERNAL_STORAGE` only on API ≤ 28).

### Migration

- **No breaking changes.** `onGaze` is additive; everything else is a bug/stability fix.

