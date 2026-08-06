# Release Notes

## v2.57.5

### Highlights

**Stability / crashes**

- **Scene-open freeze fixed (Android).** Opening an AR scene with heavier content (3D models / video) could freeze the app for ~5 s (ANR) on some devices. An interim camera-background workaround was replaying `pause → resume` on the UI thread, which blocked the main thread in `GLSurfaceView.onPause()` waiting on the GL thread. The workaround was removed now that the renderer handles camera-texture binding natively; the black-passthrough issue it guarded against stays fixed.
- **Animated glTF model crash fixed.** Loading an animated model whose rig has a zero-duration animation channel (a single keyframe / all-zero times — legal glTF) crashed with a native `SIGSEGV` (divide-by-zero → `NaN` keyframe times → corrupted sort in the renderer's skeletal-animation resampler). Guarded in the renderer.
- **Anchor-retry crash fixed (Android, SIGSEGV).** Leaving/switching an AR scene while a node's anchor retry was pending could crash in `nativeCreateAnchoredNode`; the retry now bails when the parent scene is torn down (plus a native null-ref guard in the renderer).
- **`getTransformAsync` / `getBoundingBoxAsync` / `getMorphTargets` no longer redbox or hang** when the node isn't registered yet (a normal mount race hit by `onProximity`). They now reject with `view_not_ready` so callers can retry/ignore quietly (iOS + Android).

**Features**

- **`onGaze` — eye-gaze hover on Meta Quest Pro.** New optional event on every Viro node that fires when the node is hovered by the user's eye-gaze ray (renderer support via `XR_EXT_eye_gaze_interaction`, Quest Pro). `onHover` still fires for all input sources; `onGaze` is eye-gaze-only, and setting it alone enables hover on the node. No-op on headsets without eye tracking (Quest 2 / 3 / 3S).
- **Free-tier watermark now burned into recorded video on Android** (previously photo-only), composited natively per frame in the renderer — at parity with iOS.

**Media**

- **Android media files are now reliably written (API 29+).** Screenshots and video recordings were silently failing under scoped storage (raw write to public `Pictures/` → `EACCES`), or landing in app-private storage invisible to the gallery. Media now writes to app-specific storage (always succeeds) and is published to the gallery via `MediaStore` when `saveToCameraRoll` is set. Permission gate corrected (`RECORD_AUDIO`; `WRITE_EXTERNAL_STORAGE` only on API ≤ 28).

### Migration

- **No breaking changes.** `onGaze` is additive; everything else is a bug/stability fix.

