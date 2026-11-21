# Release Notes

## v3.2.3

**Viro on the web closes most of the gaps from the web-vs-native parity review: scene-wide events and `ViroController`, portals with their own backgrounds, per-face materials, animated images, full particle and physics support, post-process effects, capture on every navigator, and AR plane detection on by default. A .gltf with external files loads instead of aborting the page. On Android, a minified release build no longer crashes at launch in WorkManager's database.** The web build needs `@reactvision/viro-web-renderer` 1.3.0; iOS and Android binaries are unchanged from 3.2.2 apart from one new header setter.

### Web

- **Navigators:** `project` / `unproject` on all three, `sceneNavigator` and `arSceneNavigator` on their refs, `recenterTracking`, and `takeScreenshot` plus video recording, which Studio's TAKE_PHOTO and RECORD_VIDEO now use. `ViroVRSceneNavigator` renders in mono.
- **Events:** scene-level click, hover, pinch, rotate and fuse; `onTransformUpdate`; `ignoreEventHandling`; `ViroController` reports scene-wide input; a tap on empty space reports `[]`.
- **Animation:** chains, sequences, parallels and aliases survive `registerAnimations`; `run` pauses and resumes; `onFinish` fires every pass; `color` and `material` animate.
- **Materials, geometry and media:** model `materials`, per-face material arrays, submeshes, primitive options (UVs, segments, holes), `arShadowReceiver`, animated images, `stereoMode`, `placeholderSource`, skybox `color`, `isHdr`, and media seek, buffering and time events.
- **Portals, physics, particles and lights:** per-portal backgrounds and enter/exit events; collision queries, held forces, `drawBounds` and impulse torque; every particle emitter prop; `shadowOrthographicPosition`.
- **AR:** plane detection on by default, tracking reasons, plane classification and `pauseUpdates`, `anchorDetectionTypes` and `onCameraARHitTest`. The camera feed is cropped to fill the screen instead of stretched.
- **Permissions:** `checkPermissions` and `requestRequiredPermissions` answer camera, microphone and location; the microphone works after a `ViroSound` on Safari.
- **Studio:** scenes sit in the error boundary with retry, and MANUAL plane detection mounts the plane selector.

### Android

- **A minified release build no longer crashes at launch** with `Failed to create an instance of class androidx.work.impl.WorkDatabase`. Viro's consumer rules keep the constructor Room creates WorkManager's database through.

### Check when upgrading

- **Web: install `@reactvision/viro-web-renderer` 1.3.0** (the peer range is now `^1.3.0`) and copy its whole `wasm/` folder. With 1.2.0 the new features stay off and a one-time warning names what is missing.
- **Android on Expo SDK 58:** build a minified release APK and open it on a device before shipping; this release removes the WorkManager crash an R8 build hit at launch.
