# Release Notes

## v3.2.1

**Placed content stays put: every direct child of `ViroARScene` is anchored on iOS as it already was on Android, and on Android it now waits for tracking instead of giving up. Tracking no longer flickers on phones such as the Galaxy A56, cloud anchors host on a slow uplink, Android release builds with R8 pass, and an AR scene hidden by a tab switch no longer crashes on a queued call.** Renderer binaries are rebuilt on virocore 3.2.1, with Spatial 1.5.0. The web build uses `@reactvision/viro-web-renderer` 1.1.1.

### Everywhere

- **A tap on a moving node fires `onClick`.** A node that moved during the press (an animation, physics, the camera) got `onClickState` but no `onClick`.
- **A node faded by its parent's `opacity` no longer hides translucent content behind it,** such as text or another faded object.

### iOS

- **Content placed at the root of an AR scene stays put as ARKit refines its map.** Each direct child of `ViroARScene` is anchored with an ARKit anchor once tracking is NORMAL, as on Android; its `position`, animations, drag and physics keep working in scene coordinates. Anchors, markers, planes and `ViroVPSAnchor` are left alone.
- **`ViroARObjectMarker` fires when its object is detected,** and an `.arobject` that fails to load is skipped with a warning instead of crashing the app.

### Android

- **Tracking no longer flickers on phones that could not sustain Viro's camera config (#568).** The camera config is capped at 1920×1080 at 30 fps, a paused plane is kept instead of removed, and UNAVAILABLE reaches `onTrackingUpdated` after about 200 ms.
- **A node at the root of an AR scene anchors once tracking starts,** however long that takes; before, a slow start used up its three tries and it floated for the session.
- **A release build with R8 minification passes:** Viro's consumer rules ignore the classes the bundled GVR SDK references but does not ship.
- **An AR scene method called while its screen is hidden answers `AR scene not available`** instead of crashing.
- **Hosting a cloud anchor with the `reactvision` provider no longer fails on a slow uplink:** the upload timeout grows with its size, up to 140 s (Spatial 1.5.0).
- **Content can follow a cloud anchor resolved with the `reactvision` provider:** the result is an ARCore anchor that `onAnchorUpdated` reports and `<ViroARPlane anchorId>` children follow.

### Platform

- **Cloud anchor resolve reports are accurate:** real match and inlier counts, and why a resolve failed or was cancelled (Spatial 1.5.0).

### Check when upgrading

- **Android: a `reactvision` resolve result's `anchor.anchorId` is now the ARCore anchor's id;** `cloudAnchorId` is unchanged. An app that stored the old `anchorId` sees a different value.
- **Android: UNAVAILABLE from `onTrackingUpdated` arrives about 200 ms after tracking drops,** not on the first frame.
- **`ViroARScene.createAnchoredNode` returns an anchor nothing can be attached to;** to keep placed content in place, render it as a direct child of `ViroARScene`.
