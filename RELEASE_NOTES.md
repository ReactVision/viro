# Release Notes

## v3.0.2

**The web player, fixed against real scenes.** Large generated models load instead of killing the renderer, taps land where they are drawn, and web AR holds steady through tracking dropouts. Needs `@reactvision/viro-web-renderer` 1.0.1, which carries the renderer build these depend on; the peer range now asks for it.

### Fixed on the web

- **A 30 to 40 MB model no longer blacks out the scene.** The renderer's memory was fixed at 256 MB and could not grow, so one large GLB aborted it for good. It now grows to 2 GB, and glTF loads no longer copy the model on the way in.
- **Failures reach you.** `StudioSceneNavigator` takes `onAssetError(asset, error)` for a model or image that fails to load, and `onRendererAbort` for the terminal case, which also shows `renderError` in the canvas's place. Both used to go only to `console.error`.
- **The Studio scene mounts once.** It was rebuilt on every navigator render, so models were fetched and parsed more than once.
- **Taps are no longer mirrored vertically.**
- **Web AR holds its last pose through a dropout** instead of swinging to a default orientation, and the pose is smoothed. `arOptions` accepts `feedWidth`, `feedHeight` and `poseSmoothing`.
- **A denied motion permission is reported** through `onMotionUnavailable`, with a message on screen, instead of starting an AR session that can never track.
- **Transparent image borders no longer hide what is behind them.**

### Native

The renderer binaries are rebuilt on virocore 3.0.2. The one change native apps see is a glTF load that no longer copies the model, which lowers peak memory on large files.
