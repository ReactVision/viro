# Release Notes

## v3.2.2

**Viro on the web catches up with native: pinch, rotate and fuse, drag in live AR, styled text, material effects, node transform reads, camera reads and AR hit tests, a light estimate from the camera, sound that mixes with video on iPhone, and recovery from a lost WebGL context. On Android, a minified VR build keeps the GVR classes its native library needs.** Renderer binaries are rebuilt on virocore 3.2.2. The web build needs `@reactvision/viro-web-renderer` 1.2.0.

### Web

- **Gestures:** `onPinch`, `onRotate` and `onFuse`; drag in live AR and the 3D navigators, with `FixedToPlane` in the Studio host.
- **Node refs:** `getTransformAsync`, `getBoundingBoxAsync`, `getMorphTargets`, and `setNativeProps` for transform, opacity and visibility.
- **Text:** `ViroText` takes `fontWeight`, `fontStyle`, `extrusionDepth` and `outerStroke`.
- **Materials:** alpha, bloom threshold, colour write mask and chroma key.
- **AR:** `onAmbientLightUpdate` from the camera feed, camera transform and position reads, `ViroARHitTestResult` hit tests with the ray, world-point and position variants, and `resetARSession(true, …)`.
- **Navigation and animation:** `Viro3DSceneNavigator` navigates, AR scenes get `arSceneNavigator`, and animations fire `onStart` / `onFinish`, start relative ones from where the node is and honour `delay` on model clips.
- **Studio web host:** animations follow the native rules, `ALERT` shows a dialog over the canvas, `onSceneChange` fires after a navigation, and assets wait for tracking.
- **Sound mixes with video on iPhone,** and held-back media plays at the first gesture.
- **A lost WebGL context recovers:** the navigators remount the scene on a new renderer.

### Android

- **A minified GVR / VR build keeps `com.google.vr.**`,** which `libgvr.so` looks up by name. AR-only apps were not affected.

### Check when upgrading

- **Web: install `@reactvision/viro-web-renderer` 1.2.0** (the peer range is now `^1.2.0`) and copy its whole `wasm/` folder, which now carries the Roboto faces styled text uses.
- **Android on Expo SDK 58: R8 is on for release builds by default.** Build a minified release APK and open it on a device before shipping. With the ONNX detector, use `@reactvision/react-viro-onnx` 1.0.3, whose rules keep ONNX Runtime.
