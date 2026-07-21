# Viro on the web

`@reactvision/react-viro` runs in the browser via `react-native-web` + a
WebAssembly/WebGL2 build of the Viro renderer (`@reactvision/viro-web-renderer`).
Components resolve to `.web.tsx` implementations that drive the renderer through a
scene C API — no native module, no DOM-per-view. AR adds a second WASM module
([slam-wasm](../../../slam)) for tracking.

> **Status: experimental (Phase 3 / MVP-2).** 3D scenes are solid; AR (camera +
> 6-DoF pose + plane detection + hit-test) works on mobile web and is under
> active validation.

## The three guides

| Guide | For | Read it to… |
|---|---|---|
| **[React web 3D guide](./REACT_WEB_GUIDE.md)** | getting started | a copy-paste Vite walkthrough for a 3D scene (no AR). |
| **[Usage](./USAGE.md)** | app developers | write Viro scenes that run on the web — components, props, events, materials, animations, AR. |
| **[Integration](./INTEGRATION.md)** | app / platform engineers | wire Viro-web into a project — install, bundler config, WASM assets, slam-wasm build & serving, permissions, deployment. |
| **[Internals](./INTERNALS.md)** | contributors / maintainers | understand how it works — architecture, the C API + handle model, render loops, event marshaling, the AR pose/plane pipeline, and the build flow. |

## Supported components

| Category | Web | Notes |
|---|---|---|
| Navigators | `Viro3DSceneNavigator`, `ViroARSceneNavigator` | AR needs slam-wasm + a start gesture |
| Scene / grouping | `ViroScene`, `ViroARScene`, `ViroNode` | |
| Geometry | `ViroBox`, `ViroSphere`, `ViroQuad`, `ViroSurface`, `ViroPolyline`, `ViroPolygon`, `ViroGeometry` | `ViroGeometry` = custom mesh |
| Text & images | `ViroText`, `ViroImage`, `ViroButton`, `ViroSpinner` | text uses the preloaded system font |
| Models | `Viro3DObject` | GLB (self-contained) + VRX (protobuf/gzip + external textures) + skinning |
| Backgrounds | `ViroSkyBox`, `Viro360Image`, `Viro360Video` | cube map / equirect sphere / equirect video |
| Video | `ViroVideo`, `Viro360Video`, `ViroMaterialVideo` | frame-uploaded video texture |
| Audio | `ViroSound`, `ViroSoundField`, `ViroSpatialSound` | Web Audio (spatial via PannerNode) |
| Lights | `ViroAmbientLight`, `ViroDirectionalLight`, `ViroOmniLight`, `ViroSpotLight`, `ViroLightingEnvironment` | IBL from an `.hdr` |
| Camera | `ViroCamera`, `ViroOrbitCamera` | |
| Materials / animation | `ViroMaterials`, `ViroAnimations`, `ViroAnimatedComponent` | color + PBR textures; declarative + model animations |
| Effects & containers | `ViroParticleEmitter`, `ViroPortalScene`, `ViroPortal`, `ViroFlexView` | FlexView = sized container (auto-layout is a follow-up) |
| Utility | `ViroGameLoop` | per-frame callbacks |
| Events | `onClick`, `onClickState`, `onHover` | |
| AR | `ViroARPlane` | plane anchors + ray hit-test |

**Not yet on web:** `ViroFlexView` automatic flexbox layout (the container works;
children position via their own transform), `ViroARPlaneSelector`, image/object
anchors, animation chains, multi-scene push/pop navigation.

## Quick start

See [Usage → Minimal example](./USAGE.md#minimal-3d-scene) and
[Integration → Install & bundler](./INTEGRATION.md#install). The reference working
setup is the Vite harness in [`viro/web-harness/`](../../web-harness) (`npm run harness`).
