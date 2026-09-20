# Release Notes

## v3.0.0

ViroReact now runs on five platforms from one codebase. This release adds **Apple Vision Pro** and **the web**, brings **mixed reality on Meta Quest** to the standard AR component API, and introduces **co-location** — two devices in the same room agreeing on where the scene is, with shared application state on top.

### Apple Vision Pro

Mount `ViroXRSceneNavigator` and the scene draws in an ImmersiveSpace. Requires `@reactvision/react-native-visionos` alongside `react-native`, and an Expo project; the `visionos/` folder is scaffolded from `@reactvision/visionos-template`. Setup is covered end to end in the visionOS guide.

Scenes are rooted in `ViroScene`, not `ViroARScene`. Components with no view manager on visionOS — the AR set, video, audio, camera — now warn once and render nothing instead of terminating the app.

### Web

Viro runs in the browser through `react-native-web` and a WebAssembly build of the same C++ renderer, shipped as the optional peer `@reactvision/viro-web-renderer`. 3D scenes and AR both work: camera, 6-DoF pose, plane detection and hit test come from ReactVision's own visual-inertial tracker, bundled with the renderer. WebGL2 is the only requirement for 3D; AR additionally needs HTTPS and a device with an IMU.

### Co-location

- **`<ViroARCloudAnchor>`** renders its children in a resolved cloud anchor's *location frame*. Mount it with the same `cloudAnchorId` on two devices and a child at `[0, 0, -1]` is the same physical metre on each, with no coordinate arithmetic in app code. Fires `onLocalized` when the frame exists, `onLocalizeError` when localisation fails or times out.
- **Replicated room state** — `useViroReplicatedState` and `ViroReplicationClient`. Ordered, conflict-resolved application state on its own socket. Entities are claimed before they change, so two people reaching for the same object resolves rather than races: the first claim wins and the second is refused with the current owner attached. `expectVersion` opts a write into optimistic concurrency, unowned entities are last-writer-wins, and a peer that disconnects releases what it held. A room is saved when its last peer leaves and reloaded when it reopens.
- **Smoothing and rate limiting** — `useViroSmoothedPeers` and `useViroSmoothedEntities` blend toward incoming values on a frame loop, with a half-life rather than a per-frame fraction so behaviour is identical at 90 Hz and 45 Hz. `useViroThrottledWrite` holds drag callbacks to a rate the relay accepts without dropping the final position.
- **Frame helpers** — `parseLocationTransform`, `locationToWorld`, `worldToLocation`, `invertTransform`, `poseCsv` and `transformDirection`. World coordinates are per-session, so anything two devices exchange travels as location-frame coordinates and is converted on arrival.

Co-location requires a paid plan. Replication must run on a single instance until room homing exists; see `reactvisioncca/server/README.md`.

### VPS

Scan a room to define its own persistent coordinate frame, host it, and localise back into it later or from another device, with an optional world mesh for occlusion and physics.

New in this release, `getScanStatus()`, `getScanDiagnostics()` and `getWorldMeshStats()` make a scan observable while it runs. `getScanStatus()` reports keyframes, viewpoint pairs and camera spread, each beside the threshold it is judged against, and is cheap enough to poll once a second. A failed `finishScan()` carries those measurements as `diagnostics`, so an application can tell the user which one fell short rather than repeating a generic failure.

### Meta Quest

Mixed reality runs through the standard AR component API: pass a `ViroARScene` to `ViroXRSceneNavigator` and the same scene works on phones and on Quest 3 / 3S. Plane anchors come from the headset's room model. New packaging defaults help builds pass Horizon Store validation — arm64-only output (`android.questArm64Only`) and a `com.oculus.supportedDevices` manifest entry (`android.questSupportedDevices`).

### Fixed

- **iOS: AVKit and UIImagePickerController lost their controls in apps that also used Viro.** A crash fix installed on `UIView` cleared gesture recognizers from every view being re-parented, including Apple's own. AVKit lost the tap that toggles fullscreen video controls and the image picker lost its shutter button. The fix now applies only to Viro's views.
- **Android: cloud anchor and scan calls issued on a scene's first frame never returned.** The AR session is created on the first rendered frame, so a resolve, host or scan made at mount raced it and vanished, leaving the promise unsettled. Such calls are now queued and flushed in order once the session exists.
- **Quest: dragging with both hands tracked followed the wrong hand**, and objects jumped on grab. A drag now belongs to the ray that started it.
- **Quest: clicks on a highlighted button were dropped several times a second.** The aim laser was selectable geometry and the hand's own ray hit it before the target.
- **`ViroController` terminated the app on its first button event.**
- **`finishScan()` without a preceding `startScan()`** is refused instead of hosting unrelated data, and a failed world-mesh snapshot now names which precondition was not met rather than giving one message for six different causes.

### Changed

- Peer poses publish at 20 Hz, up from 10; `VIRO_POSE_INTERVAL_MS` is now 50. `useViroColocation` reads peers every 33 ms. Both need the rebuilt native binaries to take effect.

### Deprecated

- **`onWorldMeshUpdated`** does not fire and never has. Poll `getWorldMeshStats()` instead. The prop remains so existing code compiles.

### Migration

- The bundled Android renderer was rebuilt for this release. Clear Gradle caches if an incremental build picks up a stale AAR.

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

