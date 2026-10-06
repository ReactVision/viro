# Release Notes

## v3.0.3

**Meta Quest gets an in-headset menu and stops reopening itself, iOS mounts `ViroObjectDetector` again, and the package bundles for the web.** A patch release on top of 3.0.2. Renderer binaries are rebuilt on virocore 3.0.3.

### Meta Quest

- **The headset view no longer reopens by itself** after the wearer goes Home or opens Settings. VR launches once, on mount; the panel offers "Enter immersive view", which `renderQuestPanel(enter)` replaces with your own panel. Leaving VR returns to the panel through Home, where the wearer left it.
- **A menu on the left controller's Y button** in `StudioSceneNavigator`: scene name, shared-session status and join code, your `questMenuItems` and Exit. The scene HUD now stays where it appears instead of following the head, says why a shared session failed, and its text is sharp.
- **Studio scenes with plane detection on no longer crash** outside a shared session, and a plane scene opened after another AR scene now gets the room's planes.
- **The boundary is hidden while passthrough is on.**
- **Expo plugin:** `android.questFeatures` drops the permissions an app does not use (`colocation`, `eyeTracking`, `passthroughCamera`), `android.questHorizonOsSdk` sets the Horizon OS SDK version (69 by default), `horizonos.permission.HAND_TRACKING` replaces the deprecated name, and Quest builds no longer declare location or require a camera.

### iOS

- **`<ViroObjectDetector />` mounts again.** 3.0.2's prebuilt archive left out `VRTObjectDetectorView`, so it failed with "View config not found" and `react-viro-onnx` found nothing to attach to. Run `pod install` and rebuild. If the view is ever missing, the component now renders nothing and calls `onError` instead of taking the screen down.
- **A session-only app no longer asks for location** when it opens an AR scene. The Core Location feed starts only with `RVApiKey` and `RVProjectId`, as before 3.0.2.
- **Camera recordings carry an audio track.**

### Web

- **The package bundles with Vite and webpack.** 3.0.2 shipped raw JSX in `dist/`. The build now uses the automatic JSX runtime, and assets resolve without React Native's `AssetSourceResolver`.

### Everywhere

- **Studio, scene and cloud-anchor requests run in the platform database's region**, falling back to unpinned when that region's edge runtime is down. `rvSetStudioSession` takes an optional `functionRegion`.
- **`getRecordingStatus` returns `"None"`, `"Recording"`, `"IOError"` or `"Unsupported"` on Android too** (typed `ViroRecordingStatus`). Android used to return the Java enum names.
- **`onCollision` fires against the AR world mesh** with its `collisionTag`.
- **On Android, `startRecording` without `RECORD_AUDIO` rejects** instead of hanging.
- **A `ViroCamera` mounted between its siblings becomes the scene's camera.**
- **visionOS:** `ViroSpatialSound`, `ViroSoundField` and `ViroObjectDetector` render nothing instead of crashing.
