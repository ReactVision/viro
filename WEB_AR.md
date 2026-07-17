# Viro AR on the web (experimental)

Markerless AR for `@reactvision/react-viro` in the browser: live camera background,
6-DoF device tracking, plane detection, and ray hit-testing — same component API as
native (`ViroARSceneNavigator` / `ViroARScene` / `ViroARPlane`).

> Status: Phase 3 (MVP-2). Works on mobile web (iOS Safari + Android Chrome).
> Supported: camera feed, pose tracking, horizontal/vertical plane anchors,
> ray-vs-plane hit-test. Not yet: image/object anchors, `ViroARPlaneSelector`,
> persistent anchors, point-cloud hit-test, WebXR backend.

---

## How it works

The renderer (virocore/WASM) does **not** track — it draws the scene from a pose.
Tracking runs in a **second** WASM module, [slam-wasm](../slam), driven from JS:

```
 <video> (getUserMedia) ─┐
                         ├─► slam-wasm ─► 6-DoF pose + planes ─► axis convert (JS)
 devicemotion (IMU)  ────┘                                            │
                                                                      ▼
                                    virocore/WASM renderer  ◄── AR C API (pose, camera bg)
```

- **Two co-located WASM modules.** `viro-web.wasm` (renderer) and `slam_wasm.wasm`
  (tracking) load independently; JS orchestrates and injects pose/planes.
- **Axis conversion in JS.** slam is Z-up / OpenCV; virocore is Y-up / GL. The
  bridge applies `Rx(-90°)` (world) and `Rx(180°)` (camera) — see
  [`arSession.ts`](../viro-web-renderer/src/arSession.ts).
- **Plane matching in TS.** slam emits oriented-rectangle planes; the bridge
  converts them to anchors and `ViroARScene`/`ViroARPlane` do the declarative
  matching. There is no native `VROARPlaneAnchor` on web.

---

## Requirements

| | Why |
|---|---|
| **HTTPS** (or `localhost`) | `getUserMedia` (camera) is blocked on plain HTTP. |
| **A mobile device** | `devicemotion` (IMU) only exists on phones/tablets; slam needs it for gravity alignment. Desktop shows the feed but tracking won't converge. |
| **A user gesture** | Camera + iOS `DeviceMotionEvent.requestPermission()` must be triggered from a tap. `ViroARSceneNavigator` renders a **"Start AR"** button for this. |
| **slam-wasm assets** | `slam_wasm.js` + `slam_wasm.wasm`, served somewhere reachable (see below). |

No COOP/COEP / cross-origin isolation required — both modules are single-threaded.

---

## Setup

### 1. Bundler

Same as 3D — resolve `.web.tsx` first, alias `react-native` → `react-native-web`,
and make the renderer's `.wasm`/`.data` reachable. See [WEB.md](./WEB.md) and the
[renderer README](../viro-web-renderer/README.md#bundler-integration).

### 2. Build slam-wasm

```sh
cd slam
source ~/emsdk/emsdk_env.sh
emcmake cmake -B build-wasm -DSLAM_BUILD_WASM=ON -DSLAM_BUILD_TESTS=OFF
emmake make -C build-wasm -j$(nproc)
# copy the artifacts to where your app serves static files:
cp build-wasm/platforms/web/slam_wasm.{js,wasm} <your-app>/public/
```

The slam web build uses `MODULARIZE + EXPORT_NAME='SlamModule'` (a classic global
factory), so it's loaded via a `<script>` tag — pass its URL as `slamScriptUrl`.

### 3. Serve `slam_wasm.wasm` with the right MIME type

`Content-Type: application/wasm`. (`slam_wasm.js` resolves the `.wasm` relative to
its own URL, so keep the two files side by side.)

---

## Minimal example

```tsx
import {
  ViroARSceneNavigator, ViroARScene, ViroARPlane,
  ViroBox, ViroAmbientLight, ViroDirectionalLight, ViroMaterials,
} from "@reactvision/react-viro";

ViroMaterials.createMaterials({
  blue: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
  red: { lightingModel: "Blinn", diffuseColor: "#ff5533" },
});

function ARScene() {
  return (
    <ViroARScene
      onTrackingUpdated={(state, reason) => console.log("tracking", state, reason)}
      onAnchorFound={(a) => console.log("plane found", a.anchorId, a.width, a.height)}
    >
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.6]} />

      {/* World-fixed cube, 1 m ahead — proves pose tracking. */}
      <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} materials={["blue"]} />

      {/* Binds to the first detected plane; the box sits on the surface. */}
      <ViroARPlane minWidth={0.1} minHeight={0.1}>
        <ViroBox position={[0, 0.05, 0]} scale={[0.1, 0.1, 0.1]} materials={["red"]} />
      </ViroARPlane>
    </ViroARScene>
  );
}

export default function App() {
  return (
    <ViroARSceneNavigator
      initialScene={{ scene: ARScene }}
      webRendererOptions={webRendererOptions /* WASM asset loading — see renderer README */}
      slamScriptUrl="/slam_wasm.js"
      arOptions={{ detectPlanes: true }}
    />
  );
}
```

Tapping **"Start AR"** requests camera + motion permission, boots slam, and begins
injecting poses. Move the device: the cube stays fixed in the world.

---

## API — web-specific props

### `ViroARSceneNavigator`

| Prop | Type | Notes |
|---|---|---|
| `initialScene` | `{ scene: Component }` | The AR scene to render. |
| `webRendererOptions` | object | How to load the renderer WASM (`importGlue`/`assetBaseUrl`/`locateFile`). See renderer README. |
| `slamScriptUrl` | `string` | URL to `slam_wasm.js`. Injected as a `<script>`; exposes global `SlamModule`. |
| `loadSlam` | `() => Promise<factory>` | Alternative to `slamScriptUrl` for ESM/bundler setups (e.g. `() => import("...")`). |
| `arOptions` | object | `detectPlanes`, `maxPlanes`, `facingMode`, `captureWidth/Height`, `intrinsics`, `tuning`, `showCameraBackground`. |
| `startLabel` | `string` | Overlay text above the Start button. |

If neither `slamScriptUrl` nor `loadSlam` is given, the navigator expects a global
`SlamModule` to already exist (host injected the `<script>` itself).

### `ViroARScene`

| Prop | Type |
|---|---|
| `onTrackingUpdated` | `(state, reason) => void` — state is `1` Unavailable / `2` Limited / `3` Normal. |
| `onAnchorFound` / `onAnchorUpdated` / `onAnchorRemoved` | `(anchor) => void` — plane anchors. |

Imperative (via `ref`):

```tsx
const sceneRef = useRef<ViroARSceneHandle>(null);
// ...
const hits = await sceneRef.current.performARHitTestWithPoint(x, y); // device px
// hits: [{ anchorId, position:[x,y,z], normal:[x,y,z], distance }], nearest first
```

### `ViroARPlane`

| Prop | Type | Notes |
|---|---|---|
| `anchorId` | `string` | Bind to a specific detected plane. Omit for auto-match. |
| `minWidth` / `minHeight` | `number` | Auto-match only planes at least this big (meters). |
| `alignment` | `"Horizontal" \| "HorizontalUpward" \| "HorizontalDownward" \| "Vertical"` | Filter by orientation. |
| `onAnchorFound` / `onAnchorUpdated` / `onAnchorRemoved` | callback | Fires as this plane binds/moves/unbinds. |

Children render in the plane's local space (origin at the plane center, local +Y =
surface normal). Auto-matching planes coordinate through the enclosing
`ViroARScene` so two of them never claim the same anchor.

**Anchor shape** (passed to `onAnchor*`):

```ts
{
  anchorId: string;
  type: "plane";
  position: [x, y, z];        // plane center, world (Y-up)
  rotation: [x, y, z];        // Euler degrees; +Y aligned to the normal
  scale: [1, 1, 1];
  center: [0, 0, 0];          // relative to the anchor origin
  width: number; height: number;   // extents (m) along local X / Z
  alignment: "HorizontalUpward" | "HorizontalDownward" | "Vertical";
}
```

---

## Tuning tracking

`arOptions.tuning` maps to slam's config (defaults mirror the slam demo):

```ts
arOptions={{
  detectPlanes: true,
  intrinsics: { fx: 500, fy: 500, cx: 320, cy: 240 }, // else derived from capture size
  tuning: { fastThreshold: 15, gyroNoise: 5e-3, accelNoise: 5e-2, lostThreshold: 8 },
}}
```

If tracking never leaves `Limited`/`Unavailable`: check you're on a real device
over HTTPS, that motion permission was granted, and move the device slowly to give
slam parallax on a textured, well-lit surface.

---

## Local development

The Vite harness (`viro/web-harness/`, `npm run harness`) has a **3D / AR** toggle.
Put `slam_wasm.js` + `slam_wasm.wasm` in `web-harness/public/` (git-ignored). For a
phone test, run `npx vite --host` behind HTTPS (e.g. an `ngrok` tunnel) so
`getUserMedia` + `devicemotion` are available.

---

## Limitations & follow-ups

- **IMU axis / extrinsics** use slam's defaults (identity extrinsics). On-device
  validation across iOS/Android is pending; calibration may be needed.
- **Camera background** re-uploads a texture per frame (works; a `viroUpdateTexture`
  fast path is a follow-up).
- **Planes** are oriented rectangles (extent), not polygons; only plane hit-test is
  implemented (no point-cloud).
- Not implemented: `ViroARPlaneSelector`, image/object anchors, persistent anchors,
  relocalization, WebXR backend.
