# Release Notes

## v3.0.2

**The web player, fixed against real scenes, and co-location in `StudioSceneNavigator`.** Large generated models load instead of killing the renderer, taps land where they are drawn, and web AR holds steady through tracking dropouts. A Studio scene can now be shared between devices in the same room. Web needs `@reactvision/viro-web-renderer` 1.0.1; the peer range asks for it.

### Co-location

- **`colocation={{ mode: "host" }}`** scans the space and creates a room with a six-character join code. **`{ mode: "join", code }`** aligns to it, so every device renders the content where the host placed it. A Quest host shares a Meta spatial anchor instead of scanning.
- **A live room shares the scene.** Variables, visibility and tap-to-place positions are shared (the last write wins), and so are drags (the dragging device holds the asset) and NAVIGATE. Animation triggers and sounds play on every device while the function behind them runs on one. Collision bindings keep running when the host leaves.
- **State and control.** Use `onColocationStateChange`, `onColocationRoom` and `colocationIndicator`, plus `leaveColocation()`, `getColocationRoom()`, `finishColocationScan()` and `retryColocation()` on the handle. `StudioColocationIndicator` and `useStudioColocation()` are there for a custom UI.
- **It doesn't hang.** A joiner connected before the host has placed the scene reports `waiting_for_host`, and `connectTimeoutMs` (60 s by default) fails a room that never comes up with `CONNECT_TIMEOUT` or `HOST_TIMEOUT`. The host's Done waits for 30 keyframes and for the point count native reports. Leaving mid-scan or mid-host cancels the native work.
- **Signed-in users work.** It runs on an API key or the internal Studio session. `rvSetStudioSession` also reaches cloud anchors and the co-location channel.

### Fixed on the web

- **A 30 to 40 MB model no longer blacks out the scene.** The renderer's memory was fixed at 256 MB and could not grow. It now grows to 2 GB, and glTF loads no longer copy the model.
- **Failures reach you.** `StudioSceneNavigator` takes `onAssetError(asset, error)` and `onRendererAbort`, which also shows `renderError` in the canvas's place.
- **The Studio scene mounts once**, so models are no longer fetched and parsed more than once.
- **Taps are no longer mirrored vertically.**
- **Web AR holds its last pose through a dropout** and smooths it. `arOptions` accepts `feedWidth`, `feedHeight` and `poseSmoothing`.
- **A denied motion permission is reported** through `onMotionUnavailable` on `ViroARSceneNavigator` and `StudioSceneNavigator`, with a message on screen.
- **Transparent image borders no longer hide what is behind them.**

### Native

- **Meta Quest gets gaze on every headset, screen capture, AR hit test from JS (`performARHitTestWithRay` / `WithWorldPoints`), click haptics and the left-palm menu pinch.** Capture is `sceneNavigator.takeScreenshot`, `startVideoRecording` and `stopVideoRecording`, as on AR. It records the left eye and not the passthrough room, and reports `RECORD_ERROR_NOT_READY` until the headset is rendering.
- **Quest: hit tests, screenshots and recordings no longer crash or come out black,** the laser follows a dragged object, and a drag whose node leaves the scene ends instead of crashing.
- **Remounting a navigator works on every platform.** With physics it crashed on teardown; on iOS the new scene's text came back garbled; on Android the new renderer crashed on its first frame.
- **iOS on React Native 0.86:** native module calls (`applyImpulse`, `getTransformAsync`, hit tests, `project`, camera capture and others) wait for their view to mount instead of failing with "Invalid view returned", so an active `ViroCamera` takes over its scene and `useViroMapCamera` works. A conditional child unmounted before it mounted no longer crashes.
- **iOS: a gesture during AR teardown no longer crashes.**
- **`cancelCloudAnchorOperations()` cancels** ReactVision hosts, resolves and scans (`ErrorCancelled`). It used to be a no-op.
- **The renderer binaries are rebuilt on virocore 3.0.2 and ReactVisionCCA 1.3.0**, which also raises the scan-host floor to 300 points.
