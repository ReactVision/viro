# Meta Quest setup guide

This guide walks through wiring up Meta Quest (OpenXR) support in an Expo
React Native app using `@reactvision/react-viro`.

## Requirements

| Path | Minimum Expo SDK | Minimum React Native |
|---|---|---|
| AR (iOS / non-Quest Android) | 54 | 0.81 |
| **VR (Meta Quest)** | **55** | **0.83** |

The VR floor is non-negotiable. `VRActivity` and `MainActivity` share a
single `ReactHostImpl` singleton and need to coordinate `onHostResume` /
`onHostPause` across two surfaces. The `skipActivityIdentityAssertion
OnHostPause` feature flag — required to suppress a hard-crash assertion
during the racy `MainActivity.onPause` that follows `VRActivity.onResume`
in `FLAG_ACTIVITY_NEW_TASK` ordering — is only honored on RN ≥ 0.83.

`ViroXRSceneNavigator` enforces this at runtime: on Quest hardware with
RN < 0.83 it throws an actionable error and refuses to launch VR. AR
continues to work on Expo 54.

If you only need AR, you can stay on Expo 54. If your app uses VR on
Quest, upgrade to Expo 55 / RN 0.83.

## Why two activities?

Horizon OS only grants exclusive OpenXR display access to an Activity that
declares `com.oculus.intent.category.VR`. A normal RN Activity (portrait, 2D
panel) can't also be the immersive VR Activity. So Quest apps run with **two
Activities sharing one `ReactHost`**:

- **MainActivity** — your panel app (tabs, menus, navigation)
- **VRActivity** — immersive VR rendering, mounts `ViroQuestEntryPoint` as the
  `"VRQuestScene"` root

The library generates `VRActivity` for you (Expo plugin). `"VRQuestScene"` is
registered via `AppRegistry.registerComponent` unconditionally whenever the
library is imported — this is harmless on non-Quest builds because no
`VRActivity` exists to call `loadApp("VRQuestScene")`. Most apps need no
manual Quest-specific JS setup.

## 1. Configure the Expo plugin

In `app.json` / `app.config.ts`, add `QUEST` to the `xRMode` array of the
`@reactvision/react-viro` plugin:

```json
{
  "expo": {
    "plugins": [
      [
        "@reactvision/react-viro",
        {
          "android": {
            "xRMode": ["AR", "QUEST"],
            "questAppId": "YOUR_META_APP_ID"
          }
        }
      ]
    ]
  }
}
```

`questAppId` is the numeric App ID from the
[Meta Developer Portal](https://developer.oculus.com/manage). It is written to
`AndroidManifest.xml` as `com.oculus.app_id` meta-data, which tells Horizon OS
the app name to display in system overlays. Without it the OS shows
**"App Name Unavailable"** with a Quit button on first launch.

You can ship `["AR", "QUEST"]` together — the same APK runs as a normal AR
phone app on Android and as an immersive VR app on Quest. `isQuest` from the
library distinguishes at runtime.

## 2. Run prebuild

```bash
npx expo prebuild --clean
```

This generates two things on Android:

- `android/app/src/main/java/<your-package>/VRActivity.kt`
- An `<activity>` entry in `AndroidManifest.xml` declaring
  `com.oculus.intent.category.VR`

`VRActivity.kt` is generated only if it doesn't already exist, so you can
edit it after prebuild.

> **Upgrading from a pre-2.55.x react-viro?** The new `VRActivity.kt` template
> implements lifecycle-correct `onResume` / `onPause` overrides that drive
> `ReactHostImpl.onHostResume(VRActivity)` and keep `JavaTimerManager` +
> Metro Fast Refresh alive while VR is foreground. Because the plugin only
> writes the file when missing, **delete the existing
> `android/app/src/main/java/<your-package>/VRActivity.kt` and re-run
> `npx expo prebuild --clean`** to pick up the fix. Without this step you
> will see broken `requestAnimationFrame` / `setTimeout`, no first-launch
> animations, and Metro Fast Refresh that only works after one VR-out-and-
> back cycle.

## 3. Use `ViroXRSceneNavigator` in your panel

`ViroXRSceneNavigator` is the single cross-platform entry point. On Quest it
automatically sets the scene intent, launches VRActivity, and returns `null`
from its own render (VRActivity owns the display). On iOS and non-Quest Android
it renders `ViroARSceneNavigator` inline.

```tsx
import { ViroXRSceneNavigator } from "@reactvision/react-viro";

export default function MyScreen() {
  return (
    <ViroXRSceneNavigator
      arInitialScene={{ scene: MyARScene }}
      vrInitialScene={{ scene: MyVRScene }}
      style={{ flex: 1 }}
    />
  );
}
```

- `arInitialScene` — mounted on iOS / non-Quest Android via `ViroARSceneNavigator`.
- `vrInitialScene` — forwarded to VRActivity via the bridge; mounted inside
  `ViroVRSceneNavigator` in VRActivity.
- `initialScene` — shorthand when AR and VR use the same scene component.

### Platform behavior summary

| Component | iOS | Android (non-Quest) | Meta Quest |
|---|---|---|---|
| `ViroXRSceneNavigator` | AR (ViroARSceneNavigator) | AR (ViroARSceneNavigator) | Launches VRActivity; mounts a `ViroScene` (VR) or `ViroARScene` (MR + plane detection) root |
| `ViroVRSceneNavigator` | _(OVR/Cardboard only — not for Quest)_ | OVR/Cardboard VR | Used internally by VRActivity |
| `StudioSceneNavigator` | AR + Studio content | AR + Studio content | VR + Studio content via VRActivity |

## 4. Write your VR scene

VR scenes use `ViroScene` as the root (not `ViroARScene`). Your `vrInitialScene`
component and any subsequent pushed scenes should follow this pattern:

```tsx
import {
  ViroScene,
  ViroAmbientLight,
  ViroController,
  Viro360Image,
} from "@reactvision/react-viro";

export function MyVRScene() {
  return (
    <ViroScene>
      <ViroController controllerVisibility reticleVisibility />
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <Viro360Image source={require("./assets/space.jpg")} />
      {/* …your content… */}
    </ViroScene>
  );
}
```

`StudioARScene` already handles the Quest / non-Quest root automatically
(`isQuest ? <ViroScene> : <ViroARScene>`), so Studio content works on both
platforms with no per-scene changes.

## 5. Navigating between VR scenes

### From inside a VR scene

`ViroVRSceneNavigator` passes a `sceneNavigator` prop to every scene it renders.
Use it to push/pop directly — no bridge or ref needed:

```tsx
export function MyVRScene({ sceneNavigator }: any) {
  return (
    <ViroScene>
      <ViroNode onClick={() => sceneNavigator.push({ scene: DetailScene })}>
        {/* … */}
      </ViroNode>
    </ViroScene>
  );
}
```

All standard operations are available: `push`, `pop`, `popN`, `replace`, `jump`.

### From panel-side code (via ref)

Use the ref returned by `ViroXRSceneNavigator`. On Quest every call is forwarded
to the `ViroVRSceneNavigator` running in VRActivity via the bridge:

```tsx
const navRef = useRef<any>(null);

// Push a new scene
navRef.current?.arSceneNavigator?.push({ scene: DetailScene });

// Pop back
navRef.current?.arSceneNavigator?.pop();

<ViroXRSceneNavigator ref={navRef} vrInitialScene={{ scene: MyVRScene }} />
```

`arSceneNavigator` is the unified ref accessor for both AR and VR paths
(naming is historical — it works on Quest too).

## 6. Exit VR

There are three ways your VR session can end:

### a. Programmatic exit from inside the VR scene

```tsx
import { exitVRScene } from "@reactvision/react-viro";

<ViroNode onClick={exitVRScene}>
  <ViroQuad ... />
  <ViroText text="Exit" ... />
</ViroNode>
```

`exitVRScene()` finishes VRActivity and returns the user to the panel.

### b. Hardware back button

`ViroQuestEntryPoint` wires the back/B button automatically — pressing it
calls `exitVRScene()` and returns to the panel. No code required.

After the user returns to the panel, `ViroXRSceneNavigator` renders `null`
(it owns no display on Quest), so the screen will be blank unless your app
navigates away. Use `onExitViro` to handle this:

```tsx
// ViroXRSceneNavigator
<ViroXRSceneNavigator
  vrInitialScene={{ scene: MyVRScene }}
  onExitViro={() => navigation.goBack()}
/>

// StudioSceneNavigator
<StudioSceneNavigator
  onExitViro={() => navigation.goBack()}
/>
```

`onExitViro` fires when `exitVRScene()` is called — whether from the B button,
a programmatic `exitVRScene()` call, or an in-scene exit button.

If you need different back behaviour (e.g. pop the scene stack instead of
exiting VR entirely), register a custom VR root (see section 8) and wire
`BackHandler` yourself.

### c. System Meta button

When the user presses the Meta button, Horizon OS shows the universal menu.
Closing the app from there finishes VRActivity directly. The generated
`VRActivity` registers an `Application.ActivityLifecycleCallbacks` that
auto-finishes itself when the panel resumes — so both surfaces are never
alive simultaneously.

## 7. (Optional) VR-specific native operations

### Renderer flags

`passthroughEnabled` and `handTrackingEnabled` are props on `ViroXRSceneNavigator`
and flow through the bridge to `ViroVRSceneNavigator` automatically:

```tsx
<ViroXRSceneNavigator
  vrInitialScene={{ scene: MyVRScene }}
  passthroughEnabled
  handTrackingEnabled
  hdrEnabled
  bloomEnabled
/>
```

### VRModuleOpenXR (recenter / passthrough toggle)

`VRModuleOpenXR.recenterTracking(viewTag)` and `setPassthroughEnabled(viewTag, enabled)`
need the native view tag of the live `ViroVRSceneNavigator`. The library exports
both the typed module reference and a `useVRViewTag()` hook that subscribes to it:

```tsx
import { VRModuleOpenXR, useVRViewTag } from "@reactvision/react-viro";

function MyVRScene() {
  const viewTag = useVRViewTag();

  const recenter = () => {
    if (viewTag != null) VRModuleOpenXR?.recenterTracking?.(viewTag);
  };

  return (
    <ViroScene>
      <ViroNode onClick={recenter}>...</ViroNode>
    </ViroScene>
  );
}
```

### Passthrough styling

`setPassthroughStyle(viewTag, style)` tunes the passthrough layer at runtime
(`XR_FB_passthrough` → `xrPassthroughLayerSetStyleFB`). `opacity` is the texture
opacity factor `[0,1]`; `edgeColor` is an `[r,g,b,a]` edge-highlight colour (alpha
`0` disables the edge effect). No-op off-Quest.

```tsx
import { setPassthroughStyle, useVRViewTag } from "@reactvision/react-viro";

function MyVRScene() {
  const viewTag = useVRViewTag();

  // Dim the room to 80% and outline real-world edges in cyan.
  if (viewTag != null) {
    setPassthroughStyle(viewTag, { opacity: 0.8, edgeColor: [0, 1, 1, 1] });
  }

  return <ViroScene>...</ViroScene>;
}
```

## 7b. Plane detection & mixed reality on Quest

Quest 3 / 3S can run **mixed-reality AR scenes** through the same OpenXR renderer,
with plane detection backed by the Quest **room model** (`XR_FB_scene`). This lights
up the standard Viro AR component API on Quest:

- `ViroARScene` as the scene root (instead of `ViroScene`)
- `onAnchorFound` / `onAnchorUpdated` / `onAnchorRemoved`
- `ViroARPlane` / `ViroARPlaneSelector` anchored to detected floors, walls,
  ceilings and tables

There is **no separate API** — pass an AR scene to `ViroXRSceneNavigator` and it
works on both phones (ARCore) and Quest (OpenXR). Passthrough is enabled
automatically when an AR scene is mounted on Quest, so the room is visible behind
virtual content.

```tsx
import {
  ViroXRSceneNavigator,
  ViroARScene,
  ViroARPlane,
  ViroQuad,
  ViroMaterials,
} from "@reactvision/react-viro";

function MRScene() {
  return (
    <ViroARScene
      onAnchorFound={(anchor) => console.log("plane found", anchor)}
    >
      {/* Auto-anchors to the first detected horizontal plane */}
      <ViroARPlane minHeight={0.5} minWidth={0.5} alignment="Horizontal">
        <ViroQuad
          rotation={[-90, 0, 0]}
          width={1}
          height={1}
          materials={["grid"]}
        />
      </ViroARPlane>
    </ViroARScene>
  );
}

// Single scene, both platforms: ARCore on phones, OpenXR plane detection on Quest.
<ViroXRSceneNavigator initialScene={{ scene: MRScene }} style={{ flex: 1 }} />
```

Notes & current limitations:

- **Plane data comes from the room model**, not live detection. Planes are the
  spatial-entity scene captured by **Space Setup** on the headset, exposed via
  `XR_FB_scene`. You must run Space Setup once (Settings → Physical Space → Space
  Setup) or the query returns no planes. Meta labels map to Viro classifications
  (`FLOOR`→Floor, `WALL_FACE`→Wall, `CEILING`→Ceiling, `DESK`/`TABLE`→Table, …).
- **Permission:** add `horizonos.permission.USE_ANCHOR_API` (the Expo plugin
  declares it for Quest). It is runtime-granted — request it in-app or
  `adb shell pm grant <pkg> horizonos.permission.USE_ANCHOR_API`.
- **Set `hdrEnabled={false}`** on `ViroXRSceneNavigator` for MR scenes. The
  HDR/bloom post-process path renders to an intermediate target and forces an
  opaque final composite, which hides passthrough (black background). Direct
  rendering preserves the transparent clear. (Lifting this restriction is planned.)
- `XR_EXT_plane_detection` (live, dynamic planes) is also wired as a fallback for
  runtimes that expose it; current Horizon OS does not, so the room-model path is
  the active one.
- **Stereo + non-depth-writing transparency (engine note).** On Quest's tiled GPU,
  rendering *many* transparent objects with `writesToDepthBuffer: false` breaks the
  **second (right) eye's entire render** — the whole eye goes black/garbage while
  the left eye is correct. A single such object is fine; it only manifests at
  quantity (≈dozens). `ViroARPlaneSelector` hit this with its per-plane overlays;
  it now uses `writesToDepthBuffer: true` for its overlay material **on Quest only**
  (phone keeps `false` for clean coplanar blending). If you build custom Quest AR
  content with many translucent surfaces, have them write depth. The underlying
  engine bug (non-depth-writing transparent pass breaking stereo at quantity) needs
  on-device GPU capture to pin down and is tracked as a follow-up.
- Image markers (`ViroARImageMarker`), persistent/cloud anchors and geospatial
  are **not yet** bridged on Quest — see `META_HORIZON_PLAN.md` M5.

## 7c. Object detection on Quest

`ViroObjectDetector` runs on Quest 3 / 3S. There's no ARCore camera and the
passthrough layer isn't app-readable, so frames come from the **Meta Passthrough
Camera API** (Camera2, Horizon OS v74+). The detector view is a zero-size RN view
and the camera is independent of the renderer, so it can run alongside an immersive
`ViroXRSceneNavigator` — `onDetection` results can be bridged into the VR scene
(both Activities share one JS engine; a module-level store works, like
`VRQuestNavigatorBridge`).

```tsx
import { ViroObjectDetector } from "@reactvision/react-viro";
import { PermissionsAndroid } from "react-native";

// Request the headset-camera permission once before mounting the detector.
await PermissionsAndroid.requestMultiple([
  "android.permission.CAMERA",
  "horizonos.permission.HEADSET_CAMERA",
]);

<ViroObjectDetector
  model="yoloe-26n"          // a bundled model name (assets/models/<name>.onnx)
  mode="prompt-free"
  confidenceThreshold={0.4}
  maxFPS={10}
  onDetection={({ detections }) => {/* label + normalized boundingBox */}}
/>
```

Notes & current limitations:

- **Permission:** `horizonos.permission.HEADSET_CAMERA` (Expo plugin declares it;
  runtime-granted). Quest 3 / 3S + Horizon OS v74+ only.
- **v1 emits `label` + normalized `boundingBox` only** — no `worldPosition` /
  `screenBoundingBox` (those need camera extrinsics + a raycast; the camera has its
  own FOV distinct from the rendered view).
- Inference falls back to CPU if the NNAPI execution provider lacks a kernel for the
  model (works, just slower).
- The styling/opacity of passthrough does not affect detection — the camera feed is
  independent of the composited passthrough layer.

## 8. (Optional) Custom VR root

The library auto-registers `ViroQuestEntryPoint` as `"VRQuestScene"`. If you
need a fully custom VR root (custom navigator props, additional providers,
analytics wrappers), re-register after importing the library — the last
registration wins in React Native:

```ts
// index.js / App.tsx — after your normal imports
import "@reactvision/react-viro"; // ensures library side-effects run first
import { AppRegistry } from "react-native";

AppRegistry.registerComponent(
  "VRQuestScene",
  () => require("./components/vr-quest-root").default
);
```

Your custom root still uses `ViroVRSceneNavigator` directly and is responsible
for subscribing to `VRQuestNavigatorBridge` if you want `ViroXRSceneNavigator`'s
push/pop calls to reach it:

```tsx
import {
  ViroVRSceneNavigator,
  VRQuestNavigatorBridge,
} from "@reactvision/react-viro";

export default function VRQuestRoot() {
  // ViroQuestEntryPoint does all of this automatically — only needed for
  // custom roots that bypass it.
  const [intent, setIntent] = useState(() => VRQuestNavigatorBridge.getIntent());
  const navRef = useRef(null);

  useEffect(() => VRQuestNavigatorBridge.onIntent(setIntent), []);

  useEffect(() => {
    if (!intent) return;
    return VRQuestNavigatorBridge.subscribeOps((op) => {
      if (op.type === "push")    navRef.current?.push(op.scene);
      else if (op.type === "pop")     navRef.current?.pop();
      // …etc
    });
  }, [intent?.intentKey]);

  if (!intent) return null;

  return (
    <ViroVRSceneNavigator
      ref={navRef}
      key={intent.intentKey}
      initialScene={intent.initialScene}
      passthroughEnabled   // ← custom prop example
      style={{ flex: 1 }}
    />
  );
}
```

## Common pitfalls

- **Using `ViroVRSceneNavigator` directly in a panel screen (MainActivity)** →
  the engine binds `xrCreateSession` to MainActivity, which lacks
  `com.oculus.intent.category.VR`. The session stays in `IDLE`, you see a black
  region, and logcat shows errors. Use `ViroXRSceneNavigator` for panel screens;
  `ViroVRSceneNavigator` is for OVR/Cardboard and for the VRActivity context only.
- **Pure VR vs mixed-reality root** → a fully-virtual VR scene uses `ViroScene` as
  its root. For mixed reality on Quest (passthrough + plane detection + anchors),
  use `ViroARScene` as the root instead — see §7b. Both work through
  `ViroXRSceneNavigator`; pick the root that matches whether you want the room
  visible and plane anchors.
- **Calling `launchVRScene()` from a component that's also rendered in
  VRActivity** → don't. The launch belongs in the panel surface only.
- **Wrong APK on the Quest** → if you ship without `xRMode: ["QUEST"]` in the
  plugin config, no VRActivity is generated and `VRLauncher` will be
  undefined at runtime.
- **Not wiring `onExitViro`** → after B button / programmatic exit, `ViroXRSceneNavigator`
  renders `null` in the panel, leaving a blank screen. Always pass `onExitViro`
  to navigate back: `onExitViro={() => navigation.goBack()}`.
- **Expecting `onExitViro` to fire on Meta button / system kill** → it doesn't
  reliably; the system can finish VRActivity without going through `exitVRScene()`.
  Don't gate critical cleanup on it.
- **Top-level `import` of a heavy VR root in `index.js`** → if you use a custom
  root, prefer `require(…)` lazily inside the factory to avoid Viro native module
  access before the JS bridge is ready.
- **`ViroXRSceneNavigator` throws on Quest with Expo 54** → VR requires Expo 55 /
  RN 0.83. The runtime gate fires before `launchVRScene()` and surfaces a clear
  error. Either upgrade Expo, or scope your build to AR-only by omitting `QUEST`
  from `xRMode`.
- **Stale `VRActivity.kt` after upgrading react-viro** → the plugin won't
  overwrite an existing `VRActivity.kt`. If hot reload dies the moment VR
  launches and animations don't play on first onClick, you're still on the
  old no-op-delegate template. Delete the file and re-run `expo prebuild`.

## Reference example

The showcase app in
[`Github/showcase/components/ar-examples/vr-quest-scene.tsx`](https://github.com/reactvision/showcase)
contains a single-file demo with both the launcher panel and the VR root,
including controllers, particle effects, custom shaders, physics, and
in-scene system controls (recenter, passthrough toggle, exit).
