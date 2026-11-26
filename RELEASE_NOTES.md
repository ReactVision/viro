# Release Notes

## v3.3.0

**On Android, materials take `emissionColor`, `emissionTexture` and `reflectiveTexture` as on iOS, and a `reflectiveTexture` no longer crashes the app. On the web, AR surfaces are in metres from the first one and keep their ids through a tracking loss, the tracker's point cloud reaches `onARPointCloudUpdate` and `displayPointCloud`, hit tests return feature points, the 3D navigators take an opt-in virtual camera, cameras take a field of view, materials take emission and reflection, and a browser without WebGL2 gets a message instead of a blank canvas.** The web build needs `@reactvision/viro-web-renderer` 1.4.0. iOS behaves as in 3.2.3.

### Android

- **`emissionColor`, `emissionTexture` and `reflectiveTexture` on a material work,** as on iOS. The first two threw "Invalid color/texture property", and the reflective cube map was loaded and dropped.
- **A material with a `reflectiveTexture` no longer crashes the app** (`Unable to find "uri" key`).

### Web

- **AR:** surfaces in metres and stable through a tracking loss; `onARPointCloudUpdate` and `displayPointCloud`; `FeaturePoint` hit results, which Studio's web player falls back to; `TRACKING_LIMITED` with its reason while tracking still holds; dragging and hit tests under a scene `ViroCamera`.
- **Navigators:** `virtualCamera` on `ViroSceneNavigator` and `Viro3DSceneNavigator`; `onWebRendererError`, and a message over the canvas when the renderer cannot start.
- **Cameras and materials:** `fieldOfView` on `ViroCamera`; `emissionColor`, `emissionTexture` and `reflectiveTexture`.
- **Images and models:** GIFs play without `ImageDecoder`; `ViroSpinner`'s images load in any bundler; a GLB loads as a GLB whatever `type` it is given.

### Check when upgrading

- **Web: install `@reactvision/viro-web-renderer` 1.4.0** (the peer range is now `^1.4.0`) and copy its whole `wasm/` and `slam/` folders. With 1.3.0 the new features stay off and a one-time warning names what is missing.
- **Materials with an `emissionTexture`** also need an `emissionColor`, on every platform: the texture scales it, and it is black by default.
