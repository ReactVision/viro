# Viro on the web — Internals

How the web platform works under the hood, for contributors. For the public API
see [Usage](./USAGE.md); for wiring it into an app see [Integration](./INTEGRATION.md).

- [Architecture](#architecture)
- [The renderer package](#the-renderer-package)
- [The C API & handle model](#the-c-api--handle-model)
- [The render loop](#the-render-loop)
- [The React bridge (reconciler)](#the-react-bridge-reconciler)
- [Event marshaling](#event-marshaling)
- [Model & animation pipeline](#model--animation-pipeline)
- [The AR pipeline](#the-ar-pipeline)
- [Studio scene web host](#studio-scene-web-host)
- [Build & asset flow](#build--asset-flow)
- [Coordinate conventions & gotchas](#coordinate-conventions--gotchas)

---

## Architecture

Four moving parts across three repos plus one package:

```
 viro/ (bridge)                     viro-web-renderer/ (package)      virocore/ (renderer C++)
 ─────────────────                  ────────────────────────────     ────────────────────────
 .web.tsx components  ──drives──►   ViroSceneApi (typed C API)  ──►   viro-web.wasm  (VROSceneWeb)
 React contexts / hooks             ViroWebRenderer (host)            WebGL2 via VRODriverOpenGLWasm
 ViroArSession (AR orchestration)   loader (Emscripten glue)

 tinyvio (tracking C++) ─►  tinyvio-slam.wasm (SlamEngine, embind) ◄── driven from ViroArSession (JS)
```

- **`virocore`** — the C++ renderer, compiled to `viro-web.wasm`. The web entry
  point is `wasm/src/cpp/VROSceneWeb.cpp` (+ `VROARWeb.cpp` for AR). It exposes a
  flat, handle-based C API via `EMSCRIPTEN_BINDINGS`.
- **`@reactvision/viro-web-renderer`** — ships the compiled WASM, an Emscripten
  loader, `ViroWebRenderer` (canvas + module host), the typed `ViroSceneApi`
  façade, and `ViroArSession` (AR orchestration).
- **`viro`** — the React bridge: `.web.tsx` components that translate props into
  `ViroSceneApi` calls via React context + lifecycle hooks.
- **tinyvio** — the tracking engine, compiled separately to `tinyvio-slam.wasm`
  through its `platforms/slam/` drop-in C API
  (embind `SlamEngine`). Never linked into virocore — JS bridges the two.

**Two co-located WASM modules.** The renderer and slam load independently; JS
orchestrates and injects pose/planes into the renderer through an AR C API. This
avoids a monolithic binary and lets each evolve on its own toolchain.

---

## The renderer package

- **Loader** (`loader.ts`) — instantiates the Emscripten module (MODULARIZE +
  EXPORT_ES6). `importGlue`/`locateFile`/`assetBaseUrl` resolve the sidecars; the
  build is single-threaded (no COOP/COEP).
- **`ViroWebRenderer`** — resolves the canvas to a CSS selector (the WebGL context
  is created C-side from a selector), starts the render loop, dispatches events,
  and owns the model-load / animation callback maps. Exposes:
  - `get scene(): ViroSceneApi`
  - `get canvasSize(): {width, height}` (device pixels, for hit-test unprojection)
  - `setNodeEventHandlers` / `clearNodeEventHandlers`, `resize()`, `dispose()`.
- **`ViroSceneApi`** — a thin typed wrapper over the raw exported functions; every
  method maps 1:1 to a `viro*` binding. This is what the bridge calls.

---

## The C API & handle model

The C++ side never exposes objects to JS — only opaque **integer handles**.
`VROSceneWeb.cpp` keeps static tables mapping `int → shared_ptr<T>`:

```
sNodes, sGeometries, sMaterials, sLights, sTextures, sNodeAnimations, sNodeDelegates
```

A creator (`viroCreateNode`, `viroCreateBox`, `viroCreateMaterial`, …) allocates
the object, stores it under a fresh handle (`sNextHandle++`), and returns the int.
Mutators/destroyers take the handle and look it up. `0` is the invalid handle.
This keeps the ABI trivial (ints across the boundary) and lifetime explicit (the
bridge destroys what it creates on unmount).

API groups (all registered in `EMSCRIPTEN_BINDINGS(viro_web)`):

| Group | Examples |
|---|---|
| Lifecycle | `initViroScene`, `setViroSceneSize`, `viroOnTouch` |
| Nodes | `viroCreateNode`, `viroGetRootNode`, `viroSetNodePosition/Rotation/Scale/Opacity/Visible`, `viroAddChildNode`, `viroDestroyNode` |
| Geometry | `viroCreateBox/Sphere/Surface`, `viroCreatePolyline/Polygon`, `viroCreateGeometry` (custom mesh via VROGeometrySource/Element), `viroSetNodeGeometry`, `viroSetGeometryMaterial` |
| Text | `viroCreateText` (VROText + preloaded Helvetica; UTF-8→wstring decode) |
| Materials | `viroCreateMaterial`, `viroSetMaterialDiffuseColor/LightingModel/…`, `viroSetMaterialTexture` |
| Textures | `viroCreateTextureRGBA`, `viroCreateTextureCubeRGBA`, `viroSetTextureWrap/Filter`, `viroDestroyTexture` |
| Background | `viroSetBackgroundSphere` (equirect), `viroSetBackgroundCube` (skybox), `viroSetBackgroundRotation` |
| IBL | `viroLoadRadianceHDRTexture` (VROHDRLoader), `viroSetLightingEnvironment` |
| Particles | `viroCreateParticleEmitter` (node + sprite + spawn/velocity), `viroSetParticleEmitterRun` |
| Portals | `viroCreatePortalScene` (VROPortal), `viroCreatePortalFrame` (VROPortalFrame), `viroSetPortalEntrance`, `viroSetPortalPassable` |
| Lights | `viroCreateLight`, `viroSetLightColor/Intensity/Direction/…`, `viroAddLightToNode` |
| Camera | `viroSetNodeCamera`, `viroSetActiveCameraNode` |
| Models | `viroLoadModel`, `viroSetModelLoadCallback` |
| Animation | `viroGetAnimationKeys`, `viroStartAnimation/…`, `viroBeginAnimation`/`viroCommitAnimation` |
| AR | `viroInitAR`, `viroARSetPose`, `viroARSetCameraBackground`, `viroARSetCameraImageSize` |

Textures cross as an RGBA8 `Uint8Array` (`viroCreateTextureRGBA` →
`convertJSArrayToNumberVector` → `VROData` → `VROTexture`). Model files (and `.hdr`
environments) are written into Emscripten's virtual FS (`Module.FS`) then loaded
by path.

**No C API needed for video/audio.** `ViroVideo`/`Viro360Video`/`ViroMaterialVideo`
draw each decoded `<video>` frame to a canvas and upload it via the existing
texture C API (`createTextureRGBA` → `setMaterialTexture`/`setBackgroundSphere`),
reusing the AR camera-background pattern; a `viroUpdateTexture` fast-path would
avoid the per-frame texture churn. `ViroSound`/`ViroSoundField` use `<audio>`;
`ViroSpatialSound` uses the Web Audio `PannerNode`. `ViroMaterialVideo` relies on
**named materials being shared** — `viroMaterialRegistry` caches one handle per
name (`getSharedMaterialHandle`), cleared via `resetMaterialCache` on navigator
teardown.

---

## The render loop

`initViroScene` builds an empty scene (root portal + camera; no default lights)
and drives `VROSceneWeb::drawFrame()` from `emscripten_set_main_loop`.

**3D path** (`drawFrame`): make the GL context current → compute FOV/projection
from the viewport → `setRenderState` on the input controller → `prepareFrame`
(identity head rotation) → `glViewport` → `renderEye(Monocular)` → `renderHUD` →
`endFrame`.

**AR path** (`drawFrameAR`, when an AR session exists): mirrors the native ARCore
loop:

1. `_arSession->setViewport` + `updateFrame` → current `VROARCamera`.
2. Draw the camera feed: a screen-space `VROSurface` (`Constant` lighting, no
   depth write) whose diffuse is the JS-uploaded camera texture, set as the scene
   root's background (created lazily, sized to the viewport).
3. If tracking is `Normal`: projection from the camera; set the POV camera node's
   position from the injected pose; pass the injected rotation to `prepareFrame`;
   render as above.

---

## The React bridge (reconciler)

There's no custom react-reconciler — plain components + context + effects:

- **Contexts** (`components/Web/ViroWebContext.ts`):
  - `ViroRendererContext` — the `ViroWebRenderer` (provided by the navigator).
  - `ViroParentNodeContext` — the enclosing node handle; each node re-provides its
    own handle so children parent correctly.
  - `ViroARContext` — AR session + latest anchors + tracking state.
  - `ViroARPlaneClaimsContext` — coordinates which `ViroARPlane` owns which anchor.
- **`useViroNode`** (the workhorse hook): creates the node in a lazy `useState`
  initializer (so children see it on first render), attaches geometry + parents it
  in an effect, applies transform/visibility/material props, wires events, and
  runs animations. Tears everything down on unmount (remove from parent, destroy
  geometry, destroy node). Its optional 4th arg, `geometryKey`, rebuilds the
  geometry when it changes — used by `ViroText`/`ViroPolyline`/`ViroPolygon`/
  `ViroGeometry` so the mesh re-shapes on prop changes (static geometry like
  `ViroBox` omits it and is built once).
- **Registries**: `viroMaterialRegistry` (name → material handle, built lazily
  from `ViroMaterials.createMaterials` definitions), `viroAnimationRegistry`
  (declarative animation definitions), plus `viroColor` / `viroImageLoader` /
  `viroModelLoader` helpers.

Because React runs child effects before parent effects, the lazy-handle pattern is
essential: a child reads its parent's handle from context during render and calls
`addChildNode` in its own effect, which runs before the parent's.

---

## Event marshaling

The renderer registers one generic delegate per event-enabled node. On a DOM
pointer/touch event → `viroOnTouch(action, x, y)` → the WASM input controller
unprojects to a world ray, hit-tests, and invokes a single JS callback with
`(nodeHandle, eventAction, source, intArg, x, y, z)`. `ViroWebRenderer` looks up
the handle's registered handlers and calls `onClick` / `onClickState` / `onHover`
with world-space position + source id.

---

## Model & animation pipeline

- **Loading**: the bridge writes the model (and any `resources`) to `Module.FS`,
  then `viroLoadModel(node, path, format)` runs `VROGLTFLoader`/`VROFBXLoader`
  (LocalFile). GLB is self-contained; VRX is protobuf/gzip with external textures.
  A completion callback resolves the JS promise. Skeletal skinning is supported.
- **Model animations**: `viroGetAnimationKeys` lists them; `viroStartAnimation`
  resolves `node->getAnimation(name)` → `VROExecutableAnimation` and executes it
  (re-executing on loop). `name: "*"` = the first animation.
- **Declarative animations**: `viroBeginAnimation`/`viroCommitAnimation` wrap node
  setters in a `VROTransaction`; the renderer interpolates. The bridge composes
  the target from the node's base transform per axis.

---

## The AR pipeline

`ViroArSession` (`viro-web-renderer/src/arSession.ts`) orchestrates everything in
JS:

1. **Boot**: load slam-wasm, `new SlamEngine()`, `configure(...)` (intrinsics +
   tuning), `start()`. `getUserMedia({facingMode})` → `<video>`. `initAR()` on the
   renderer.
2. **Per frame** (`requestAnimationFrame`): draw the video to a canvas →
   `getImageData` → grayscale (Rec.601) → `allocFrameBuffer` + `HEAPU8.set` →
   `processFrame`. (HEAPU8 is re-read each frame — it detaches on memory growth.)
3. **IMU**: `devicemotion` → `feedImu(ts, accel, gyro)` (rotationRate mapped
   alpha=Z, beta=X, gamma=Y).
4. **Pose read + convert**: read slam's quaternion + position and convert Z-up/
   OpenCV → Y-up/GL, then `sceneApi.arSetPose(quat, pos, trackingState)`.
5. **Camera background**: upload the RGBA frame as a texture (rows as-is, no
   flip — matches ViroImage) and `arSetCameraBackground`.
6. **Planes** (if `detectPlanes`): `fetchPlanes` → convert each to Y-up →
   `onAnchorsUpdated` when the set changes (added/removed/moved beyond ~2 cm).

### Camera feed rendering (hard-won details)

Getting the live feed to show on the WebGL2 build took four fixes; keep them in
mind when touching this path:

1. **Attach the `<video>` to the DOM (hidden).** Safari won't decode/paint a
   detached `<video>`, so `drawImage` yields black frames. `ViroArSession` appends
   a 1×1, `opacity:0` video to `document.body`.
2. **Don't gate `renderEye` on tracking.** `drawFrameAR` renders every frame so
   the feed shows during initialization (mirrors native ARCore); the pose is
   applied only once tracking is `Normal`. (`renderWhileLimited` can also force a
   pose before then — dev/desktop aid.)
3. **`prewarm` the per-frame texture.** JS uploads a fresh `VROTexture` each frame;
   without forcing its GPU upload (`texture->prewarm(driver)`) the one-shot
   texture is replaced before it hydrates → the surface samples empty. (A
   `viroUpdateTexture` that reuses one texture would remove this churn — follow-up.)
4. **No vertical flip.** The texture/surface pipeline already samples correctly;
   an extra row-flip renders the feed upside down.

The feed is a screen-space `VROSurface` set as the scene root's background; it
renders via the portal background path using the orthographic matrix (identity
view). A solid-color diffuse confirmed the surface renders — the blank feed was
purely the texture-hydration issue above.

### Axis conversion

Ported from the slam demo. Quaternions are `[x,y,z,w]`.

```
frameChange = Rx(-90°)   // world Z-up → world Y-up
cameraFlip  = Rx(180°)   // OpenCV camera (Y-down,Z-fwd) → GL camera (Y-up,Z-back)

position'    = frameChange · position
orientation' = frameChange · slamQuat · cameraFlip
```

Plane center + normal are rotated by `frameChange`; a plane's `rotation` is the
Euler (degrees) of the quaternion aligning local `+Y` to its normal.

### Hit-test

`session.hitTest(x, y, vpW, vpH)` unprojects the screen point using the renderer's
FOV (60° vertical, aspect from the viewport) and the latest camera pose to build a
world ray, then intersects each detected plane (`t = (center−origin)·n / dir·n`),
returning hits nearest-first.

### The C++ AR backend

`VROARWeb.h/.cpp` provides a minimal `VROARSession` implementation whose data is
injected from JS (modeled on the lightweight `VROARSessionInertial`):

- `VROARCameraWeb` — holds the injected rotation/position/tracking-state; builds a
  perspective projection from a fixed vertical FOV.
- `VROARFrameWeb` — wraps the camera + anchors + point cloud each frame.
- `VROARSessionWeb` — `setPose` / `setCameraBackground` / `setCameraImageSize`
  from JS; `updateFrame` rebuilds the frame; anchor add/remove/update fire the
  delegate. Cloud anchors / image targets are unsupported no-ops.

**Plane matching lives in TS, not C++.** slam emits planes; `ViroARScene` /
`ViroARPlane` do the declarative matching. There is no `VROARPlaneAnchor`
injection on web — a `ViroARPlane`'s node is just a normal node whose transform is
driven by the matched anchor.

---

## Studio scene web host

Studio scenes (authored in the R3F editor, stored as Viro-compatible data) play
on the web through the **same shared runtime** the native StudioGo app uses
(`components/Studio/domain/` — the function dispatcher, variable/visibility
stores, sound manager, and `viroNodeFactory`). That runtime is pure JS and
renderer-agnostic; the web host just mounts its output with the `.web` components.

- **`StudioSceneNavigator.web.tsx`** — picks `ViroARSceneNavigator` (AR via slam,
  when the scene uses plane detection) or `Viro3DSceneNavigator` (3D); holds the
  scene data in state; owns the session-scoped variable store; exposes a
  canvas-based `takeScreenshot`.
- **`StudioARScene.web.tsx`** — mirrors the native host: builds the stores +
  `runtimeCtx`, registers materials/animations, and maps assets to nodes via the
  unchanged `viroNodeFactory.createNode` (its elements resolve to `.web`). Mounts
  in `ViroARScene`/`ViroScene` with plane-anchored content wrapped in `ViroARPlane`.

**One additive seam in the shared runtime:** `SequenceRuntimeContext.navigate?`.
The NAVIGATION handler calls it when present (web: fetch scene data + re-render);
native leaves it unset and falls back to the `VROXRSceneNavigator` push path — so
StudioGo is unchanged. `apiRequestExecutor` was already injectable; the web host
supplies JS implementations for both (the data source itself is out of scope —
the host receives scene data / a fetcher from its caller).

**Web-unsupported scene features** are skipped and reported via `onUnsupported`:
image markers, VR/Quest, native physics, occlusion (plane detection *is*
supported via slam).

---

## Build & asset flow

Renderer (manual; native builds are run by a maintainer):

```
virocore/wasm  --build_web.sh (emsdk)-->  products/build/viro-web.{js,wasm,data}
                                               │  viro-web-renderer: npm run copy-wasm
                                               ▼
                              viro-web-renderer/wasm/  --(copy)-->  viro/web-harness/wasm/
```

slam (for AR):

```
tinyvio  --build_slam_wasm.sh-->  web/slam/tinyvio-slam.{js,wasm}  --(copy)-->  app public/
```

Gotchas:
- Changing an asset under `preload/` does **not** regenerate the `.data` — force
  it (e.g. `touch VROSceneWeb.cpp`) so the packager reruns.
- The 26 GLSL shaders under `preload/` must stay in sync with the core copies; a
  stale copy silently breaks rendering.
- WebGL2 is strict: MRT bloom output must be written in every shader when bloom is
  active; dead UBOs (e.g. `bones_dq`) are rejected.

---

## Coordinate conventions & gotchas

- **Rotation props are degrees** (Viro convention); the bridge converts to radians
  before `viroSetNodeRotation`.
- **slam is Z-up/OpenCV, virocore is Y-up/GL** — conversion happens once, in JS
  (`arSession.ts`). Apply the same transform to any new slam-sourced data.
- **`getImageData` is top-row-first; GL samples v=0 at the bottom** — the camera
  background is Y-flipped before upload.
- **`Module.HEAPU8` detaches on memory growth** — re-read it every frame before
  `.set`.
- **`web-harness/` is excluded from `viro/tsconfig.json`** — the IDE may flag
  `webRendererOptions` on the AR navigator there (it resolves to the native
  `.tsx`); Vite resolves `.web.tsx` at runtime, so it's cosmetic.
- **Every component needs a `.web.tsx`, even ones that are pure no-ops on web.**
  `dist/index.js` is one CommonJS barrel that `require()`s every component
  eagerly at import time. A native-only component with no `.web.tsx` sibling
  falls through to the plain `.tsx`, whose `requireNativeComponent()` call at
  module scope throws immediately on web — and since the whole barrel loads in
  one pass, that one missing stub crashes *any* web usage of the package, not
  just usage of that component. When adding a component that has no web
  implementation (e.g. `ViroARImageMarker`, `ViroObjectDetector`,
  `ViroVirtualJoystick`), add a minimal `.web.tsx` that renders `null` (plus a
  dev-only `console.warn`) rather than omitting the file.
