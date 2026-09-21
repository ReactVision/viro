# Release Notes

## v3.0.1

Co-location works on Meta Quest. It was announced in 3.0.0 and did not run there: `metaSpatialAnchorFrameSource` reported itself supported on a headset, and the call failed at the last step.

Every layer beneath was finished. The OpenXR session has driven Meta's spatial-anchor group sharing since it learned the extension, and `com.viro.core.ARScene` exposed both calls in Java. What was missing was the forwarding — and then, once that was built, four more things, none of which produced an error.

That is the part worth knowing if you are debugging something similar. A missing Android permission does not make the Meta runtime refuse a call; it hides the extension from enumeration, so the headset looks like one that never supported shared anchors. Loading a function from an extension that was never enabled at instance creation returns false quietly. An OpenXR event the renderer does not forward leaves a callback waiting forever, because every spatial-entity call answers by event. And a query filter chained in the wrong field is rejected as a validation failure that names the query rather than the filter.

Verified on a Quest 3: `create` publishes an anchor, `join` recovers the frame.

### Using it

```tsx
import { ViroSharedFrame, metaSpatialAnchorFrameSource } from "@reactvision/react-viro";

// The headset that publishes the room:
<ViroSharedFrame source={metaSpatialAnchorFrameSource(roomUuid, "create")} />

// Every other headset joining it:
<ViroSharedFrame source={metaSpatialAnchorFrameSource(roomUuid, "join")} />
```

Two requirements, both of which report themselves rather than failing quietly:

**Your scene must be rooted in `ViroARScene`.** Co-location means agreeing on a room, and a fully virtual scene has no room to agree on — no AR session, no anchor to share. Under a `ViroScene` root the call answers *"Co-location needs a mixed-reality scene"*.

**Your app needs the config plugin**, which now declares `horizonos.permission.IMPORT_EXPORT_IOT_MAP_DATA`. Run `expo prebuild` after upgrading so the manifest picks it up.

Co-location remains same-family: a Quest on a Meta anchor and a phone on a cloud anchor are in unrelated frames, and nothing has ever observed both. That is a scope decision rather than a gap. Full API in `docs/CO_LOCATION.md`, Quest specifics in `docs/QUEST_SETUP.md` §7d.

### Also in this release

The renderer changes this depends on are in `@reactvision/virocore` 3.0.1, which ships inside this package as prebuilt binaries — there is nothing to install separately.

**One prop was removed.** `onCloudAnchorStateChange` on `ViroARSceneNavigator` was documented as firing "when a cloud anchor state changes, including progress updates during hosting/resolving", and was wired to nothing on either platform — no handler, no native event. An app that set it heard silence with no error to explain it. Removing a declared prop is the kind of change that normally waits for a major; this one never did anything, so nothing can break that was working.

The state it promised was always available, in three places depending on what you are asking: `hostCloudAnchor()` and `resolveCloudAnchor()` resolve with `state`; `getCloudAnchorStatus()` reports progress while a resolve is running, which is what the callback was reaching for and carries more than a state change would; and `rvGetCloudAnchor(anchorId)` gives the current state of an anchor you did not just touch. `docs/VPS_LITE.md` has the table.

`ViroCloudAnchorStateChangeEvent` stays exported, deprecated, so an existing import still compiles.

Found by a new audit — `npm run audit:events` — that checks every declared `on*` callback against what Android emits, iOS names, or a JS parent invokes. It is in the repository because this is the second time a callback has shipped wired to nothing; `onWorldMeshUpdated` was the first.

Nothing else changed.

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
