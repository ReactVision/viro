# Apple Vision Pro (visionOS) setup guide

How to run a Viro scene on visionOS. The companion to `QUEST_SETUP.md`; the same
`ViroXRSceneNavigator` drives both, and most of what you write is identical.

**Status (2026-08-26):** the scene renders, input reaches JavaScript, and the enter/exit cycle is
clean — all confirmed on an Apple Vision Pro. Still a preview rather than a shipping platform: the
component set has not been fully swept, though frame cost has now been measured on device: GPU p95
sits at 41–53% of the 90 Hz budget.

---

## Requirements

| | |
|---|---|
| Xcode | 26.6 with the visionOS 26.5 SDK |
| Deployment target | **visionOS 26.0** — the renderer calls `LayerRenderer.Frame.queryDrawables()` (26.0) and `Drawable.computeProjection(viewIndex:)` (2.0) with no availability fallback |
| React Native | `@reactvision/react-native-visionos` **0.86.4**, installed *alongside* `react-native` |
| Expo | SDK 57 |
| Package | `@reactvision/react-viro` 3.0.0 or newer |

**Expo only, for now.** This guide, the config plugin and the project template all assume an Expo
app. A bare React Native app is not supported yet — not because anything is known to be broken
there, but because nothing has been verified there and we would rather say so than let you find out.

visionOS is an out-of-tree React Native platform: an app has an `ios/` folder *and* a
`visionos/` folder consuming the same JavaScript. `Platform.OS` is `"ios"` on visionOS — the fork
keeps the iOS identity — so use `isVisionOS` from Viro to tell them apart, never `Platform.OS`.

---

> **Building with Xcode 27 / the iOS 27 SDK?** That SDK makes the UIScene lifecycle mandatory, and an
> app without it crashes on launch with *"UIScene life cycle is required"* — on **iOS**, not only on
> visionOS. Expo backported opt-in support in `expo@57.0.23`; upgrade Expo and add
> `enableSceneSupport` to `expo-build-properties`:
>
> ```json
> ["expo-build-properties", { "ios": { "enableSceneSupport": true } }]
> ```
>
> A bare `UIApplicationSceneManifest` in `Info.plist` is **not** enough — the app delegate has to
> adopt the lifecycle too, which is what the Expo flag does.

## 1. Configure the Expo plugin

```json
{
  "expo": {
    "plugins": [
      "@reactvision/react-viro",
      "@reactvision/react-viro/plugins/withViroVisionOS"
    ]
  }
}
```

## 2. Create the `visionos/` folder (one time)

```sh
npx @react-native-community/cli@latest init MyApp \
  --template github:ReactVision/visionos-template \
  --directory visionos --skip-install
```

That template is built for React Native 0.86 and already points at
`@reactvision/react-native-visionos`, so there is nothing to reconcile by hand. After the folder
exists, `expo prebuild` manages it.

> **Why a GitHub specifier and not a package name.** `@reactvision/visionos-template` is not on npm
> yet. Once it is, this becomes `--template @reactvision/visionos-template` and the GitHub form
> stops being necessary. Both install the same thing.
>
> Callstack's `@callstack/visionos-template` also exists and is what this guide used to recommend,
> but it is published at 0.79.6 against a 0.86 fork — the generated project needs reconciling with
> 0.86 by hand, which is exactly the step the ReactVision template removes.

## 3. Prebuild, install, build

```sh
npm install --save-dev @react-native-community/cli @callstack/out-of-tree-platforms
npx expo prebuild
npm install                 # applies the patches the plugin just added
cd visionos && pod install
open visionos/MyApp.xcworkspace
```

**Why the first line.** The `visionos/` Podfile autolinks through `@react-native-community/cli`,
which an Expo app does not have — Expo ships its own CLI — and without it `pod install` fails inside
CocoaPods with a wall of text that names the package only in passing.
`@callstack/out-of-tree-platforms` is what the Metro resolver uses to find the visionOS platform.
The plugin warns about both if they are missing, but it is cheaper to install them first.

**No environment prefix is needed on `pod install`.** The plugin writes the two React Native
source flags into the Podfile itself.

<details>
<summary>What the plugin does for you</summary>

- the visionOS platform resolver in `metro.config.js`, plus two things that are easy to miss:
  `visionos` added to `resolver.platforms`, and Viro's asset extensions (`glb`, `gltf`, `hdr`,
  `obj`, `mtl`, `vrx`) added to `assetExts` — without the latter,
  `<ViroLightingEnvironment source={require('./env.hdr')} />` fails the bundle outright with
  "Unable to resolve ./env.hdr" before a frame is drawn
- the three pods (`ViroKit`, `ViroReact`, `ViroReactUI`) in `visionos/Podfile`
- `post_install` hooks: UIKit into every pod's prefix header, the fmt fix, C++20, Hermes JSI headers
- `ENV['RCT_USE_PREBUILT_RNCORE']` and `ENV['RCT_USE_RN_DEP']` set to `'0'`
- `moduleName: "main"` and the `ImmersiveSpace` scene in `App.swift`
- `UIApplicationSupportsMultipleScenes` in `Info.plist`
- Expo's entry point and the `ReactAppDependencyProvider` import in `AppDelegate.swift`
- five third-party patches, `postinstall: patch-package`, and `patch-package` as a devDependency
- the `BlurView` / `LinearGradient` compat shims

Three of these fail *silently* when missing, which is why they are automated rather than
documented as steps: without the RN flags you get `no such module 'React'` inside React Native's
own source; without `UIApplicationSupportsMultipleScenes` the ImmersiveSpace never opens and
nothing is thrown; without the Expo entry point the app sits on its loading spinner forever.

</details>

### Building for the headset

```sh
cd visionos
xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug \
  -destination 'generic/platform=visionOS' \
  DEVELOPMENT_TEAM=YOUR_TEAM CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates build
```

Three things about this that are not obvious:

- **`-allowProvisioningUpdates` is required**, not optional. Without it signing fails even with a
  valid team and valid certificates. It reads as a certificate problem and is not one.
- **Debug does not embed the JS bundle.** The plugin sets `SKIP_BUNDLING=1` for Debug, matching
  what `expo prebuild` writes for iOS, so Metro must be running and reachable from the headset.
  Embedding in Debug also trips Metro's *"Unexpected module with full source map found"*.
- **The bundling phase resolves Expo's entry point.** The bare template asks for `index.js`, which
  an Expo project does not have; the plugin points it at `expo/scripts/resolveAppEntry`. Bundling
  itself stays with the React Native CLI, because the fork's script passes `--resolver-option` for
  the visionos platform extension and `@expo/cli` rejects that flag.

If your project uses the `@/` path alias, note that device builds run their own Metro from the
Xcode phase and read only `metro.config.js` — tsconfig `paths` come from the Expo dev server, not
from that instance. The plugin's metro patch resolves `@/` for both.

---

## 4. Use `ViroXRSceneNavigator`

The same component you use on iOS, Android and Quest.

```tsx
import { ViroXRSceneNavigator } from "@reactvision/react-viro";

<ViroXRSceneNavigator
  arInitialScene={{ scene: PhoneARScene }}   // iOS / Android
  vrInitialScene={{ scene: HeadsetScene }}   // Quest and visionOS
/>
```

On visionOS the component opens the ImmersiveSpace **when it mounts** and closes it when it
unmounts. Mount it behind a button if you want the user to choose:

```tsx
const [xrOpen, setXrOpen] = useState(false);

return (
  <View style={{ flex: 1 }}>
    <Button title="Enter XR" onPress={() => setXrOpen(true)} />
    {xrOpen && <ViroXRSceneNavigator vrInitialScene={{ scene: HeadsetScene }} />}
  </View>
);
```

### Your scene must be rooted in `ViroScene`, not `ViroARScene`

The visionOS renderer excludes the AR subsystem entirely, so `VRTARScene` has no view manager and
an AR-rooted scene fails at mount with *"View config not found for component `VRTARScene`"*. This
is why the component reads `vrInitialScene` and never `arInitialScene` on visionOS — the Quest VR
scene is already a `ViroScene`, so one scene usually serves both headsets.

### The window keeps your 2D UI

The navigator renders with **no layout footprint** on visionOS: its content is in the
ImmersiveSpace, so it takes no space in the window and paints nothing there. Put your ordinary
React Native UI in that window — a title, controls, an exit button. An empty React Native window
renders black, which looks like a bug and is simply an empty window.

### Platform behavior summary

| Platform | Host | Scene prop | Renders in the RN view |
|---|---|---|---|
| iOS / Android | `ViroARSceneNavigator` | `arInitialScene` | yes, the camera feed |
| Meta Quest | VRActivity (separate React host) | `vrInitialScene` | no — renders `null` |
| **Apple Vision Pro** | **ImmersiveSpace (same React host)** | **`vrInitialScene`** | **no — zero-footprint** |

The Quest and visionOS rows differ in one way that matters: on Quest the scene is *forwarded* to
another React host, so nothing stays mounted here; on visionOS the ImmersiveSpace shares this
runtime, so the scene tree stays mounted and its nodes are what the renderer draws.

---

## 5. Write your scene

Everything can be declared from React Native, with no native assets:

```tsx
import {
  ViroScene, ViroSkyBox, ViroAmbientLight, ViroDirectionalLight,
  ViroSpotLight, ViroBox, ViroSphere, ViroText, ViroMaterials,
} from "@reactvision/react-viro";

ViroMaterials.createMaterials({ magenta: { diffuseColor: "#FF3DAE" } });

export default function HeadsetScene() {
  return (
    <ViroScene>
      <ViroSkyBox color="#0B1020" />
      <ViroAmbientLight color="#FFFFFF" intensity={180} />
      <ViroDirectionalLight color="#FFFFFF" direction={[0, -1, -0.4]} />
      <ViroBox position={[0, 0, -2]} scale={[0.3, 0.3, 0.3]} materials={["magenta"]} />
    </ViroScene>
  );
}
```

`ViroSkyBox` takes a solid `color` as well as a cube map, so a complete scene needs no bundled
images.

---

## 6. Input: how pointing works

There are no controllers. A tap is a **pinch**, and where it lands is decided by a ray the renderer
casts from the user. Your scene receives the same `onClick`, `onHover` and drag events it would on
any other platform — but two things about the ray are worth knowing, because they change how you
size targets.

**The ray is aimed from the head, through the hand.** Not along the finger. Aiming along the index
finger sounds more natural and is worse in practice: finger joints move whenever the hand does
anything, and most of all as a pinch begins, so the ray drifts at the exact moment of the tap. Head
through hand matches how people physically point and is far steadier. `rayOrigin: "finger"` exists
if you want the other behaviour.

**It is a trade, and the cost of `"head"` is worth knowing before you meet it.** Because the ray
runs from between the eyes through the hand, pointing at something means physically putting your
hand on that line of sight — often across your body, toward the centre of your view. `"finger"`
points more precisely and more comfortably; it is only the pinch that unsettles it. Try both with
the headset on before deciding either is wrong, which is what `setInputTuning` is for.

**A pinch does not use the aim at the moment you pinch.** The renderer keeps ~150 ms of recent aim
and, when a pinch starts, freezes to the oldest entry — from before the finger began to curl. So
the click lands where you were pointing a moment earlier, which is where you meant. The reticle
freezes with it, so what you see is where the click will go.

**A reticle shows where the ray is pointing**, always, whether or not it is over a target. It rides
the live filtered ray rather than the hover state, so it does not lag or disappear on a miss — an
earlier version did both, and a pointer you cannot see is worse than none.

**Small targets get a cone, not just a ray.** A zero-width ray demands more precision than hand
tracking can deliver. A precise hit is always tried first; only when the ray misses everything does
the renderer widen to a cone of `coneAngle` radians (default 0.03, about 1.7°). So a target roughly
2° wide is comfortable, and anything much smaller will feel fussy however good the tracking is.

All four numbers can be changed at runtime, which is the point — they can only be judged with a
headset on, and a native rebuild is ten minutes:

```ts
import { setInputTuning } from "@reactvision/react-viro";

setInputTuning({
  rayOrigin: "head",     // or "finger"
  smoothing: 0.5,        // 0 none, 1 heavy — live ray only, never the frozen aim
  hoverHysteresis: 0.02, // radians the ray must leave a target before hover drops
  coneAngle: 0.03,       // 0 disables the cone fallback
});
```

It is a no-op on every other platform, so it needs no `isVisionOS` guard.

---

## 7. Immersion style

```tsx
<ViroXRSceneNavigator
  vrInitialScene={{ scene: HeadsetScene }}
  visionOSImmersionStyle="mixed"     // "mixed" (default) or "full"
/>
```

- `"mixed"` — virtual content over passthrough. The closest analogue to phone AR.
- `"full"` — fully virtual, passthrough hidden.

**`"progressive"` is not supported and must not be added to the ImmersiveSpace.** Declaring
support for it changes the CompositorServices contract: presentation must then go through the
drawable's render context, and `encodePresent` — which this renderer uses — is rejected outright.
The process aborts a second or two after the space opens, with the message *"BUG IN CLIENT: cannot
present drawable: need to use drawable render context when supporting progressive style."*
Supporting it means implementing the render-context path first.

---

## 8. Studio

`StudioSceneNavigator` delegates to `ViroXRSceneNavigator`, so it works on visionOS with no
changes on your side: it takes the same path as Quest — pre-registering materials and animations
before the renderer starts, and mounting the scene straight into the immersive space rather than
pushing onto a loading scene.

---

## What is not available

The visionOS renderer is Metal-only and excludes several subsystems. These components have no view
manager on visionOS.

**They no longer take the app down.** A missing view manager does not degrade — `requireNativeComponent`
hands React a component whose native half is absent, and mounting it crashes. Each component below
therefore checks the platform in JS before it renders, warns once with `[Viro] <name> is not supported
on Apple Vision Pro`, and renders nothing. You get a console warning and a gap in the scene instead of
a dead app, which is the same treatment Quest already had.

| Area | Components |
|---|---|
| AR | `ViroARScene`, `ViroARPlane`, `ViroARImageMarker`, `ViroARObjectMarker`, and the rest of the AR set |
| Video | `Viro360Video`, `ViroVideo`, `ViroMaterialVideo` |
| Audio | `ViroSound`, `ViroSpatialSound`, `ViroSoundField` |
| Camera | `ViroCameraTexture`, `ViroObjectDetector` |
| Other | `ViroAnimatedImage`, `ViroPortal`, HUD components, `Viro3DSceneNavigator`, `ViroVRSceneNavigator` |

`Viro3DSceneNavigator` deserves a note: it is the OpenGL presentation path — it builds an
`EAGLContext` and hosts a `VROViewScene` — and neither exists on visionOS. The ImmersiveSpace is
the presentation path instead, which is what `ViroXRSceneNavigator` uses.

---

## Known issues

**Frame cost, measured on device (2026-08-26).** Over sixteen windows of 300 frames on an Apple
Vision Pro: GPU total median 3.1–4.1 ms, p95 4.6–5.9 ms, against a 90 Hz budget of 11.11 ms — so
**41–53% of the budget at p95**, with CPU work under 1 ms. Occasional 12–13 ms frames appear and
look like first-draw pipeline compilation. This was a modest test scene; it is headroom, not a
guarantee for a heavy one.

**The component set is unverified.** Around 28 components are classified as supported by reading the
code, not by running them. Expect to find gaps, and report them — that classification becomes a
verified count only once the sweep runs.

**Shader modifiers written in GLSL do not work on visionOS.** The Metal path translates them
partially: it emits what it can and drops the declarations it cannot, producing shader source that
fails to compile. This affects `ViroPolyline` and any custom shader modifier. There is no workaround
today beyond avoiding them.

**CJK glyphs render as tofu.** Accented Latin is fine; Chinese, Japanese and Korean come out as
empty boxes. This is charmap coverage in the bundled font, not a failure of the text system.

**The window cannot be hidden while immersed.** `RCTMainWindow` creates its `WindowGroup` without
an identifier, and without one there is no `openWindow(id:)` to bring it back. Dismissing it would
be a one-way trip, so the window stays and hosts your controls instead.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `no such module 'React'` in `RCTRootViewRepresentable.swift` | React core built from the prebuilt xcframework, which has no xros slice. The plugin sets `RCT_USE_PREBUILT_RNCORE=0` in the Podfile; check it is there |
| App launches, reaches Metro, never leaves the loading spinner | `AppDelegate.swift` is asking Metro for `index`. Expo serves `.expo/.virtual-metro-entry` |
| The ImmersiveSpace never opens and nothing is thrown | `UIApplicationSupportsMultipleScenes` is `false` in `Info.plist` |
| `[Viro] ViroARScene is not supported on Apple Vision Pro` and an empty scene | The scene is rooted in `ViroARScene`. Use `ViroScene` — see *Your scene must be rooted in `ViroScene`* above |
| The window is a black panel | The window has no content of its own. The navigator draws in the ImmersiveSpace, not there |
| A pod fails on a missing UIKit type | The CocoaPods prefix header has no visionOS case. The plugin's `post_install` puts UIKit back; check it ran |
