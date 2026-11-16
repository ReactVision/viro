# Release Notes

## v3.2.0

**ViroReact moves to React Native 0.88 and Expo SDK 58, on every platform including Apple Vision Pro, through `@reactvision/react-native-visionos` 0.88.1.** `ViroController` takes the same drag, pinch and rotate handlers on iOS and Android, iOS sounds load by name and preload, and AR scenes on the web gain physics, collisions, scene navigation and a virtual camera for previewing without one. Renderer binaries are rebuilt on virocore 3.2.0. The web build uses `@reactvision/viro-web-renderer` 1.1.1.

### Everywhere

- **Breaking: React Native 0.88 and Expo SDK 58.** `react-native` is `>=0.88.0 <0.89.0` and `expo` is `>=58.0.0 <59.0.0`, with React 19.3. React Native 0.86 and Expo SDK 57 stay on 3.1.x.
- **`ViroController` delivers `onDrag`, `onPinch` and `onRotate` on iOS and Android,** with the same payloads as a node's handlers. Pinch and rotate come from a touch screen, so a Quest controller does not send them.
- **`ViroNativeRef` is `HostInstance | null`,** since React Native 0.88 removed `NativeMethods`; the methods are the same.

### iOS

- **`ViroSound.preloadSounds` and sounds played by name work;** the promise resolves with `{ result, msg }` as on Android, and a downloaded sound opens.
- **`ViroSpatialSound` and `ViroSoundField` no longer crash on mount.**
- **`ViroObjectDetector` boxes and hit tests line up in a resized window** and in iPad multitasking.

### Android

- **A build without the `AR` xRMode leaves ARCore out (Expo plugin):** a Quest-only app no longer carries `:arcore_client`, its meta-data or its `<queries>` entry.
- **Building the bridge from source needs Gradle 9.4.1 and AGP 9.2.1.** Apps that consume the published package are not affected.

### visionOS

- **Runs on React Native 0.88 through `@reactvision/react-native-visionos` 0.88.1,** an optional peer dependency again (`>=0.88.0 <0.89.0`). Generate the `visionos/` folder from `@reactvision/visionos-template` 0.88.1.
- **The patches the Expo plugin copies apply to Expo SDK 58;** three of the SDK 57 ones failed on install, and a new one lets `react-native-gesture-handler` 3.3.0 build for visionOS.

### Web

- **Physics:** a `physicsBody` simulates, `onCollision` fires with the other body's `viroTag`, and a node's ref takes `applyImpulse`, `applyTorqueImpulse` and `setVelocity`.
- **`virtualCamera` on `ViroARSceneNavigator`** previews an AR scene with no camera or permission prompt, with a floor plane and dragging.
- **Scene navigation** (`push`, `replace`, `jump`, `pop`, `popN`) works in `ViroARSceneNavigator`.
- **Clicks reach the node native would give them to,** and changing opacity or visibility no longer resets a node's position.

### Check when upgrading

- **Upgrade React Native and Expo first;** 3.2.0 does not install next to `react-native` 0.86.
- **On visionOS, regenerate the `visionos/` folder** from `@reactvision/visionos-template` 0.88.1 and install `@reactvision/react-native-visionos@0.88.1`; a 0.86 folder does not build against 0.88.
- **A `ViroController` that set `onPinch` or `onRotate` now receives them.** The node in the payload is null when the gesture started on nothing that takes it.
