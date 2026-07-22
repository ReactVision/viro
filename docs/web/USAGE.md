# Viro on the web — Usage

How to write Viro scenes that run in the browser. The component API matches
native; this page documents the web-supported subset and any web-specific
behavior. For project setup (bundler, WASM assets, slam-wasm) see
[Integration](./INTEGRATION.md).

- [Minimal 3D scene](#minimal-3d-scene)
- [Navigators](#navigators)
- [Nodes & transforms](#nodes--transforms)
- [Geometry](#geometry)
- [Text & images](#text--images)
- [Backgrounds](#backgrounds)
- [3D models](#3d-models)
- [Video & audio](#video--audio)
- [Lights & camera](#lights--camera)
- [Lighting environment (IBL)](#lighting-environment-ibl)
- [Materials](#materials)
- [Animations](#animations)
- [Particles](#particles)
- [Portals](#portals)
- [FlexView](#flexview)
- [Events](#events)
- [Utility](#utility)
- [AR](#ar)

---

## Minimal 3D scene

```tsx
import {
  Viro3DSceneNavigator, ViroScene, ViroNode, ViroBox,
  ViroAmbientLight, ViroDirectionalLight, ViroMaterials,
} from "@reactvision/react-viro";

ViroMaterials.createMaterials({
  blue: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
});

function Scene() {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={300} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.6]} />
      <ViroNode position={[0, 0, -4]}>
        <ViroBox materials={["blue"]} animation={{ name: "spin", run: true, loop: true }} />
      </ViroNode>
    </ViroScene>
  );
}

export default function App() {
  return (
    <Viro3DSceneNavigator
      initialScene={{ scene: Scene }}
      webRendererOptions={webRendererOptions /* WASM asset loading — see Integration */}
    />
  );
}
```

`webRendererOptions` is the one bundler-specific bit (how the `.wasm`/`.data`
assets are located). On plain ESM hosting it can be omitted.

---

## Navigators

The navigator owns the `<canvas>` and the renderer, and hosts your scene.

| Prop | Type | Notes |
|---|---|---|
| `initialScene` | `{ scene: React.ComponentType }` | The scene component to render. |
| `viroAppProps` | `object` | Passed through to the scene as props. |
| `webRendererOptions` | object | WASM asset loading (`importGlue` / `assetBaseUrl` / `locateFile`). See [Integration](./INTEGRATION.md#loading-the-wasm-assets). |

Multi-scene push/pop navigation is stubbed on web (single scene for now).

---

## Nodes & transforms

`ViroNode` groups children and applies a transform. Every renderable web
component shares the same transform/visibility/event/animation props:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `position` | `[x, y, z]` | `[0,0,0]` | meters |
| `rotation` | `[x, y, z]` | `[0,0,0]` | **degrees** (Viro convention) |
| `scale` | `[x, y, z]` | `[1,1,1]` | |
| `opacity` | `number` | `1` | |
| `visible` | `boolean` | `true` | |
| `materials` | `string \| string[]` | — | names registered via `ViroMaterials` |
| `animation` | `ViroAnimationProp` | — | see [Animations](#animations) |
| `onClick` / `onClickState` / `onHover` | callback | — | see [Events](#events) |

```tsx
<ViroNode position={[0, 1, -3]} rotation={[0, 45, 0]} scale={[1, 1, 1]}>
  {/* children inherit this transform */}
</ViroNode>
```

---

## Geometry

| Component | Props |
|---|---|
| `ViroBox` | `width`, `height`, `length` (default 1) |
| `ViroSphere` | `radius` |
| `ViroSurface` | `width`, `height` (a flat quad) |
| `ViroQuad` | `width`, `height` |
| `ViroPolyline` | `points` (`[x,y]` or `[x,y,z]`), `thickness` |
| `ViroPolygon` | `vertices` (`[x,y]`), `holes` (follow-up) |
| `ViroGeometry` | `vertices`, `normals`, `texcoords`, `triangleIndices` — custom mesh |

```tsx
<ViroBox width={1} height={1} length={1} materials={["blue"]} />
<ViroSphere radius={0.5} materials={["blue"]} />
<ViroSurface position={[0, -1.8, 0]} rotation={[-90, 0, 0]} width={8} height={8} materials={["checker"]} />

<ViroPolyline thickness={0.05} points={[[0,0,0],[1,0.6,0],[2,0,0]]} materials={["red"]} />
<ViroPolygon vertices={[[0,0],[1,0],[0.5,1]]} materials={["blue"]} />

<ViroGeometry
  vertices={[[-0.5,-0.5,0],[0.5,-0.5,0],[0.5,0.5,0],[-0.5,0.5,0]]}
  normals={[[0,0,1],[0,0,1],[0,0,1],[0,0,1]]}
  texcoords={[[0,1],[1,1],[1,0],[0,0]]}
  triangleIndices={[[0,1,2],[0,2,3]]}
  materials={["checker"]}
/>
```

---

## Text & images

```tsx
<ViroText
  text="Hello Viro Web"
  width={4}
  height={1}
  style={{ fontSize: 36, color: "#ffdd44", textAlign: "Center" }}
/>

<ViroImage source={{ uri: "/photo.jpg" }} width={1.5} height={1.5} onLoadEnd={() => {}} />

<ViroButton
  source={{ uri: "/btn.png" }}
  hoverSource={{ uri: "/btn_hover.png" }}
  clickSource={{ uri: "/btn_down.png" }}
  width={1}
  height={0.4}
  onClick={() => {}}
/>

<ViroSpinner type="Light" />
```

- **`ViroText`** — `text`, `width`/`height`, `maxLines`, `textLineBreakMode`,
  `textClipMode`, and `style.{fontSize, color, textAlign, textAlignVertical}`.
  Uses the preloaded system font; custom `fontFamily`, `extrusionDepth` and
  `outerStroke` are follow-ups. The geometry re-shapes when `text`/style changes.
- **`ViroImage`** — `source` (`{ uri }` / URL / `require`), `width`/`height`,
  `onLoadStart`/`onLoadEnd`/`onError`. Unlit + alpha-blended. `resizeMode`,
  `placeholderSource` are follow-ups (image stretches to width×height).
- **`ViroButton`** — a `ViroImage` that swaps to `hoverSource`/`clickSource`
  (a.k.a. `gazeSource`/`tapSource`) and forwards `onClick`.
- **`ViroSpinner`** — two counter-rotating images. `type` `"Dark"`/`"Light"` picks
  the built-in art; `source`/`sourceReverse` override it.

---

## Backgrounds

Scene-level; place inside the scene. They set the renderer background (no node).

```tsx
{/* Equirectangular 360 image on a sphere. */}
<Viro360Image source={{ uri: "/pano.jpg" }} rotation={[0, 90, 0]} />

{/* Cube-map skybox from six faces. */}
<ViroSkyBox
  source={{
    px: { uri: "/px.jpg" }, nx: { uri: "/nx.jpg" },
    py: { uri: "/py.jpg" }, ny: { uri: "/ny.jpg" },
    pz: { uri: "/pz.jpg" }, nz: { uri: "/nz.jpg" },
  }}
/>
```

---

## 3D models

`Viro3DObject` loads GLB (self-contained) and VRX (protobuf/gzip; external
textures via `resources`). Skeletal skinning + model animations are supported.

| Prop | Type | Notes |
|---|---|---|
| `source` | `{ uri: string }` | model URL |
| `type` | `"GLB" \| "GLTF" \| "VRX"` | |
| `resources` | `{ uri: string }[]` | external assets a VRX references (textures) |
| `animation` | `ViroAnimationProp` | `name: "*"` selects the model's first animation |
| `onLoadEnd` / `onError` | callback | |

```tsx
<Viro3DObject
  source={{ uri: helmetUrl }}
  type="GLB"
  scale={[1.6, 1.6, 1.6]}
  onLoadEnd={() => console.log("loaded")}
/>

<Viro3DObject
  source={{ uri: dragonUrl }}
  type="VRX"
  resources={textureUrls.map((uri) => ({ uri }))}
  animation={{ name: "*", run: true, loop: true }}
/>
```

---

## Video & audio

Video plays onto a surface (`ViroVideo`), the background sphere (`Viro360Video`),
or a named material (`ViroMaterialVideo`). Frames are uploaded to a texture each
decoded frame. Audio uses Web Audio; `ViroSpatialSound` positions the source in 3D.

```tsx
<ViroVideo source={{ uri: "/clip.mp4" }} width={2} height={1.2} loop muted />
<Viro360Video source={{ uri: "/pano.mp4" }} loop muted />

{/* Video onto the "screen" material used by some geometry. */}
<ViroMaterialVideo material="screen" source={{ uri: "/clip.mp4" }} loop />

<ViroSound source={{ uri: "/music.mp3" }} loop volume={0.8} />
<ViroSpatialSound source={{ uri: "/beep.mp3" }} position={[2, 0, -1]} loop minDistance={1} maxDistance={20} />
```

Common playback props: `paused`, `loop`, `muted`, `volume`, `onFinish`, `onError`.

> Autoplay policies: browsers may block audio/unmuted video until a user gesture;
> `muted` video autoplays. `ViroSpatialSound`'s listener sits at the world origin
> (camera-tracked listener is a follow-up). HTTPS is not required for video/audio
> (only for AR camera).

---

## Lights & camera

```tsx
<ViroAmbientLight color="#ffffff" intensity={300} />
<ViroDirectionalLight color="#ffffff" intensity={1000} direction={[0, -1, -0.6]} castsShadow />
<ViroOmniLight position={[0, 2, 0]} attenuationStartDistance={0} attenuationEndDistance={10} />
<ViroSpotLight position={[0, 3, 0]} direction={[0, -1, 0]} innerAngle={5} outerAngle={45} castsShadow />
```

Common light props: `color`, `intensity`, `temperature`, `direction`,
`position`, `attenuationStartDistance`/`attenuationEndDistance`,
`innerAngle`/`outerAngle`, `castsShadow`.

`ViroCamera` sets the point of view; `ViroOrbitCamera` looks at a `focalPoint`:

```tsx
<ViroCamera position={[0, 0, 0]} active />
<ViroOrbitCamera position={[0, 1, 4]} focalPoint={[0, 0, 0]} active />
```

> The web build does **not** add default lights — add at least an ambient or
> directional light or your scene will be dark (matches native).

---

## Lighting environment (IBL)

`ViroLightingEnvironment` applies an HDR image-based lighting environment —
diffuse irradiance + specular reflections for PBR materials. `source` must be a
radiance `.hdr` (equirectangular); the renderer fetches it, writes it to the WASM
FS and loads it via the HDR loader.

```tsx
<ViroLightingEnvironment source={{ uri: "/studio.hdr" }} onLoadEnd={() => {}} />
```

Scene-level (renders no node); cleared on unmount. Pair with PBR materials
(`lightingModel: "PBR"`) to see reflections/irradiance.

---

## Materials

Register named materials once, reference them by name via the `materials` prop.

```tsx
ViroMaterials.createMaterials({
  blue: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
  metal: {
    lightingModel: "PBR",
    diffuseTexture: require("./albedo.png"),
    metalnessTexture: require("./metal.png"),
    roughnessTexture: require("./rough.png"),
    normalTexture: require("./normal.png"),
  },
});
```

Supported: `lightingModel` (`Constant`/`Lambert`/`Blinn`/`Phong`/`PBR`),
`diffuseColor`, and texture channels `diffuseTexture`, `specularTexture`,
`normalTexture`, `roughnessTexture`, `metalnessTexture`, `ambientOcclusionTexture`,
plus scalar props (`shininess`, `fresnelExponent`, `roughness`, `metalness`,
`diffuseIntensity`), `cullMode`, `blendMode`, `writesToDepthBuffer`,
`readsFromDepthBuffer`. Textures accept a URL, a `require()`d asset, or a data URL.

---

## Animations

Register declarative animations, then run them via the `animation` prop.

```tsx
ViroAnimations.registerAnimations({
  spin: { duration: 2000, easing: "Linear", properties: { rotateY: 360 } },
});

<ViroBox animation={{ name: "spin", run: true, loop: true }} />
```

`animation` prop: `{ name, run, loop?, onStart?, onFinish? }`. Animated
properties compose from the node's base transform per axis: `positionX/Y/Z`,
`rotateX/Y/Z`, `scaleX/Y/Z`, `opacity`. Easing: `Linear`, `EaseIn`, `EaseOut`,
`EaseInEaseOut`, `Bounce`, `PowerDecel`.

> Not yet on web: animation **chains** (sequences) and animated color/material.

---

## Particles

`ViroParticleEmitter` attaches a particle system to a node. The sprite is
`image.source` on a quad; spawn behavior and a velocity range drive the emission.

```tsx
<ViroParticleEmitter
  position={[0, 2, 0]}
  image={{ source: { uri: "/spark.png" }, width: 0.1, height: 0.1 }}
  run
  spawnBehavior={{
    emissionRatePerSecond: [20, 30],
    particleLifetime: [1500, 2500],
    maxParticles: 300,
    spawnVolume: { shape: "Box", params: [0.2, 0, 0.2] }, // Box | Sphere | Point
  }}
  particlePhysics={{ velocity: { min: [-0.2, 1, -0.2], max: [0.2, 2, 0.2] } }}
/>
```

> Appearance modifiers (color/scale/rotation/alpha over life), bursts and
> acceleration are follow-ups.

---

## Portals

A `ViroPortalScene` holds content seen through a doorway; its `<ViroPortal>`
child is the entrance frame (its children are the doorway geometry).

```tsx
<ViroPortalScene passable={false}>
  <ViroPortal position={[0, 0, -2]}>
    <ViroSurface width={1.4} height={2} materials={["doorway"]} />
  </ViroPortal>
  {/* content visible through the portal */}
  <ViroBox position={[0, 0, -4]} materials={["blue"]} />
</ViroPortalScene>
```

---

## FlexView

`ViroFlexView` is a rectangular container sized by `style.width`/`height` with an
optional background (color or materials).

```tsx
<ViroFlexView
  position={[0, 0, -2]}
  style={{ width: 2, height: 1, backgroundColor: "#222831" }}
>
  <ViroText text="Panel" width={2} height={0.4} style={{ fontSize: 24, color: "#fff" }} />
</ViroFlexView>
```

> MVP: the container + background work; **automatic flexbox layout**
> (flexDirection/justifyContent/alignItems/padding) is a follow-up — position
> children via their own transform for now.

---

## Events

```tsx
<ViroBox
  onClick={(position, source) => console.log("clicked at", position)}
  onHover={(isHovering, position, source) => {}}
  onClickState={(clickState, position, source) => {}}
/>
```

Touches/pointer events unproject through the current view/projection to a world
ray, hit-test the scene, and dispatch to the node's handlers.

---

## Utility

**`ViroGameLoop`** — per-frame callbacks off `requestAnimationFrame`. Mount it
anywhere in the scene; it stops on unmount and pauses when `paused`.

```tsx
<ViroGameLoop
  onUpdate={({ dt, elapsed }) => {/* every frame */}}
  fixedHz={30}
  onFixedUpdate={({ dt }) => {/* fixed-step physics/logic */}}
/>
```

**`ViroAnimatedComponent`** (deprecated) — injects its `animation` into its single
child. Prefer setting `animation` on the component directly:

```tsx
<ViroAnimatedComponent animation="spin" run loop>
  <ViroBox materials={["blue"]} />
</ViroAnimatedComponent>
```

---

## AR

AR uses the same declarative model: `ViroARSceneNavigator` → `ViroARScene` →
your content, with `ViroARPlane` binding to detected surfaces. AR requires
slam-wasm and a device with a camera + IMU over HTTPS — see
[Integration → AR setup](./INTEGRATION.md#ar-setup).

```tsx
import {
  ViroARSceneNavigator, ViroARScene, ViroARPlane,
  ViroBox, ViroAmbientLight,
} from "@reactvision/react-viro";

function ARScene() {
  return (
    <ViroARScene
      onTrackingUpdated={(state, reason) => console.log("tracking", state)}
      onAnchorFound={(a) => console.log("plane", a.anchorId, a.width, a.height)}
    >
      <ViroAmbientLight color="#ffffff" intensity={400} />
      {/* World-fixed cube 1 m ahead — proves pose tracking. */}
      <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} materials={["blue"]} />
      {/* Binds to the first detected plane; children sit on the surface. */}
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
      webRendererOptions={webRendererOptions}
      slamScriptUrl="/slam_wasm.js"
      arOptions={{ detectPlanes: true }}
    />
  );
}
```

The navigator renders a **"Start AR"** button; tapping it requests camera +
motion permission and begins tracking. Move the device — world-anchored content
stays put.

### `ViroARSceneNavigator` (web props)

| Prop | Type | Notes |
|---|---|---|
| `slamScriptUrl` | `string` | URL to `slam_wasm.js` (injected as a `<script>`, exposes global `SlamModule`). |
| `loadSlam` | `() => Promise<factory>` | ESM alternative to `slamScriptUrl`. |
| `arOptions` | object | `detectPlanes`, `maxPlanes`, `facingMode`, `captureWidth/Height`, `intrinsics`, `tuning`, `showCameraBackground`, `renderWhileLimited`. |
| `startLabel` | `string` | Text above the Start button. |

> **Desktop / dev:** slam is visual-inertial and needs an **IMU** (`devicemotion`,
> mobile only) to reach `Normal` tracking. On a desktop the camera feed and scene
> still render (the loop no longer gates on tracking), but the state stays
> `Limited` and the pose won't follow the device. `arOptions.renderWhileLimited`
> forces the slam pose to be applied before convergence (useful only on a device
> that has an IMU but is slow to converge; leave it off on desktop for a stable
> default pose). Real AR needs a **mobile device over HTTPS**.

### `ViroARScene`

| Prop | Type |
|---|---|
| `onTrackingUpdated` | `(state, reason) => void` — state `1` Unavailable / `2` Limited / `3` Normal |
| `onAnchorFound` / `onAnchorUpdated` / `onAnchorRemoved` | `(anchor) => void` |

Imperative hit-test via `ref`:

```tsx
const sceneRef = useRef<ViroARSceneHandle>(null);
const hits = await sceneRef.current.performARHitTestWithPoint(x, y); // device px
// [{ anchorId, position:[x,y,z], normal:[x,y,z], distance }], nearest first
```

### `ViroARPlane`

| Prop | Type | Notes |
|---|---|---|
| `anchorId` | `string` | Bind to a specific plane. Omit for auto-match. |
| `minWidth` / `minHeight` | `number` | Minimum size to auto-match (meters). |
| `alignment` | `"Horizontal" \| "HorizontalUpward" \| "HorizontalDownward" \| "Vertical"` | Filter by orientation. |
| `onAnchorFound` / `onAnchorUpdated` / `onAnchorRemoved` | callback | |

Children render in plane-local space (origin = plane center, local +Y = surface
normal). Auto-matching planes coordinate through `ViroARScene` so two never claim
the same anchor.

**Anchor shape** (`onAnchor*`):

```ts
{
  anchorId: string;
  type: "plane";
  position: [x, y, z];   // plane center, world (Y-up)
  rotation: [x, y, z];   // Euler degrees; +Y aligned to normal
  scale: [1, 1, 1];
  center: [0, 0, 0];
  width: number; height: number;  // extents (m) along local X / Z
  alignment: "HorizontalUpward" | "HorizontalDownward" | "Vertical";
}
```
