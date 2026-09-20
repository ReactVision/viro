# Release Notes

## v3.0.0

ViroReact runs on five platforms from one codebase: iOS, Android, Meta Quest, Apple Vision Pro and the web.

**Vision Pro and the web become usable in this release.** The renderer has supported both for a while, but neither could be reached from an application until the packages they need shipped — `@reactvision/react-native-visionos` and `@reactvision/visionos-template` for Vision Pro, `@reactvision/viro-web-renderer` for the browser. All three are published now.

Three capabilities are new: **VPS**, which turns a scanned room into a coordinate frame that persists and can be localised into later or from another device; **co-location**, two devices agreeing on where the scene is with shared application state on top; and **mixed reality on Meta Quest** through the standard AR component API.

### VPS

Scan a room to define its own persistent coordinate frame, host it, and localise back into it later or from another device, with an optional world mesh for occlusion and physics.

New in this release, `getScanStatus()`, `getScanDiagnostics()` and `getWorldMeshStats()` make a scan observable while it runs. `getScanStatus()` reports keyframes, viewpoint pairs and camera spread, each beside the threshold it is judged against, and is cheap enough to poll once a second. A failed `finishScan()` carries those measurements as `diagnostics`, so an application can tell the user which one fell short rather than repeating a generic failure.

### Apple Vision Pro

Mount `ViroXRSceneNavigator` and the scene draws in an ImmersiveSpace. Requires `@reactvision/react-native-visionos` alongside `react-native`, and an Expo project; the `visionos/` folder is scaffolded from `@reactvision/visionos-template`. Setup is covered end to end in the visionOS guide.

Scenes are rooted in `ViroScene`, not `ViroARScene`. Components with no view manager on visionOS — the AR set, video, audio, camera — now warn once and render nothing instead of terminating the app.

### Web

Viro runs in the browser through `react-native-web` and a WebAssembly build of the same C++ renderer, shipped as the optional peer `@reactvision/viro-web-renderer`. 3D scenes and AR both work: camera, 6-DoF pose, plane detection and hit test come from ReactVision's own visual-inertial tracker, bundled with the renderer. WebGL2 is the only requirement for 3D; AR additionally needs HTTPS and a device with an IMU.

### Co-location

- **`<ViroARCloudAnchor>`** renders its children in a resolved cloud anchor's _location frame_. Mount it with the same `cloudAnchorId` on two devices and a child at `[0, 0, -1]` is the same physical metre on each, with no coordinate arithmetic in app code. Fires `onLocalized` when the frame exists, `onLocalizeError` when localisation fails or times out.
- **Replicated room state** — `useViroReplicatedState` and `ViroReplicationClient`. Ordered, conflict-resolved application state on its own socket. Entities are claimed before they change, so two people reaching for the same object resolves rather than races: the first claim wins and the second is refused with the current owner attached. `expectVersion` opts a write into optimistic concurrency, unowned entities are last-writer-wins, and a peer that disconnects releases what it held. A room is saved when its last peer leaves and reloaded when it reopens.
- **Smoothing and rate limiting** — `useViroSmoothedPeers` and `useViroSmoothedEntities` blend toward incoming values on a frame loop, with a half-life rather than a per-frame fraction so behaviour is identical at 90 Hz and 45 Hz. `useViroThrottledWrite` holds drag callbacks to a rate the relay accepts without dropping the final position.
- **Frame helpers** — `parseLocationTransform`, `locationToWorld`, `worldToLocation`, `invertTransform`, `poseCsv` and `transformDirection`. World coordinates are per-session, so anything two devices exchange travels as location-frame coordinates and is converted on arrival.

Co-location requires a paid plan. Replication must run on a single instance until room homing exists; see `reactvisioncca/server/README.md`.

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
