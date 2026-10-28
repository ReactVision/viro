# Release Notes

## v3.1.0

**Advanced VPS arrives: scan a place with the phone, then find it again and pin content to it, matched on the device or on the GPU server. The world mesh now fuses depth across frames into a room that persists, and Meta Quest gets a headset-native Studio experience.** Renderer binaries are rebuilt on virocore 3.1.0, with ReactVisionCCA 1.4.0. The web build uses `@reactvision/viro-web-renderer` 1.1.0.

### Advanced VPS

- **`<ViroVPS>` finds a scanned place and keeps tracking it.** `startTracking(id)` takes a known location, `"auto"` searches by GPS and `"visual"` by camera image. Results come through `onLocalized` and `onTrackingState`.
- **Two ways to localise, behind one prop.** `localization="device"` (the default) downloads the place's map and matches on the phone. `localization="server"` sends camera frames to the GPU server instead, which holds up much better across days and lighting, and needs no map download. `StudioSceneNavigator` takes the same choice as `vpsLocalization`.
- **`<ViroVPSAnchor>` and the place's mesh.** Content placed in map coordinates, and the scanned mesh (occlusion and physics), follow the map every frame.
- **Scanning from your app.** `uploadScanRecording(target, outputDir, options?)` zips a recording natively and sends it straight to Storage; on iOS the upload carries on in the background. `getScan(scanId)` follows processing. `meshQuality` picks the mesh's detail: `low`, `medium` (the default) or `high`.
- **VPS calls go to Studio** and need no address or credentials beyond the Studio session or the Expo plugin's `rvApiKey` and `rvProjectId`. Requests time out instead of hanging.

### World mesh

- **The mesh fuses depth frames into a room that persists** on the depth-image and monocular paths, instead of rebuilding from the last frame. `worldMeshConfig` takes `accumulate`, `voxelSize` and `maxMemoryMB`, `sceneNavigator.resetWorldMesh()` starts a new room, and `getWorldMeshStats()` reports `source` (`lidar`, `depth`, `monocular`, `plane`) and `accumulated`.
- **Android: the world mesh is in the right place,** read from each depth image's own stride, with confidence weighting samples instead of dropping them.
- **iOS without LiDAR: estimated depth is placed where it was seen,** so fusing it no longer leaves duplicated surfaces.
- The world mesh types are exported from the package root.

### Meta Quest

- **Studio scenes feel native in the headset.** A menu on the left controller's menu button (or a palm pinch), panels styled after Meta Horizon OS at a quarter of the size, the HUD centred where the wearer looks, and placement along the controller's ray.
- **The room stays put.** Content on room surfaces, tap-placed models and the co-location frame keep their place when the wearer recentres; `onRoomMoved(listener)` reports a recentre to your app. Plane scenes use the room's planes and pick the one nearest the wearer.
- **Input behaves like the platform's.** Y goes back as B does, only a trigger or pinch selects, a hand and a controller on one side press once, and a released hand releases its pinch. `ViroController.getControllerRayAsync(source)` says where a ray points.
- **Fewer crashes and leaks:** videos no longer abort the app or leak, a scene's root can change as the headset view starts, and closing a scene logs no OpenXR errors.
- **Expo plugin:** Quest builds declare minSdkVersion 32, the Horizon OS SDK, a network security config and Meta's recommended activity settings, and no longer declare NFC.

### Web

- **Web AR content stays in the room on iPhone,** and hides while tracking is lost (`hideContentWhenLost` turns that off). From viro-web-renderer 1.1.0.

### visionOS

- **Studio scenes render in the ImmersiveSpace.** They rooted in `ViroARScene`, which renders nothing on visionOS, so a Studio scene was blank. They now root in `ViroScene`, as on Meta Quest, in shared sessions too.

### Everywhere

- **Every scene navigator sends one usage ping when it mounts,** replacing the device registration ReactVisionCCA used to do. It carries no API key. Turn it off with `ViroTelemetry.setEnabled(false)` or the Expo plugin's `telemetry: false`. The iOS privacy manifest now ships with the pod.
- **Co-location:** the replication socket sends a per-device id (`getColocationDeviceId()`), and a join refused for the team's compute billing says so.
- **A click goes to what is drawn on top,** not always the nearest object, and a click on nothing reaches `ViroController`'s `onClick` again.
- **Text sits where its vertical alignment puts it,** and no longer disappears after a front-culled material.
- **Video:** a paused iOS video stays paused, and Android play and pause reach the player in the order they were made.
- `ViroKit.framework` targets iOS 15.1, the minimum the podspec already declared.

See `CHANGELOG.md` for every change.
