# Viro on React web — 3D guide (no AR)

A step-by-step for rendering Viro 3D scenes in a plain **React web** app (Vite),
with **no AR**. You get primitives, models, materials, lights, animations, text,
images, video and events — all running on WebGL2 via WebAssembly. No camera, no
slam-wasm, no HTTPS requirement, no permission prompts.

> For AR, see [Usage → AR](./USAGE.md#ar). For bundlers other than Vite
> (webpack, Metro/Expo) and deployment, see [Integration](./INTEGRATION.md).

---

## 1. Create a React app (Vite)

```sh
npm create vite@latest my-viro-app -- --template react-ts
cd my-viro-app
```

## 2. Install

```sh
npm install @reactvision/react-viro @reactvision/viro-web-renderer react-native-web
```

- `@reactvision/react-viro` — the components (resolve to `.web.tsx` on web).
- `@reactvision/viro-web-renderer` — the WASM/WebGL2 renderer.
- `react-native-web` — the RN → DOM shim the components build on.

## 3. Configure Vite

The bundler must resolve `.web.tsx` first, alias `react-native` →
`react-native-web`, and treat the WASM sidecars as assets.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".json"],
    alias: { "react-native": "react-native-web" },
  },
  optimizeDeps: {
    // Don't pre-bundle the renderer — esbuild rewrites import.meta.url and breaks
    // the loader's resolution of the .wasm/.data sidecars.
    exclude: ["@reactvision/viro-web-renderer"],
  },
  assetsInclude: ["**/*.data", "**/*.wasm"],
});
```

No COOP/COEP headers are needed — the build is single-threaded.

## 4. Point the renderer at its WASM assets

The renderer ships three files (`viro-web.js`, `viro-web.wasm`, `viro-web.data`).
Import their URLs with Vite's `?url` and hand them to the navigator via
`webRendererOptions`:

```ts
// webRenderer.ts
import glueUrl from "@reactvision/viro-web-renderer/wasm/viro-web.js?url";
import wasmUrl from "@reactvision/viro-web-renderer/wasm/viro-web.wasm?url";
import dataUrl from "@reactvision/viro-web-renderer/wasm/viro-web.data?url";

export const webRendererOptions = {
  importGlue: () => import(/* @vite-ignore */ glueUrl),
  locateFile: (path: string) =>
    path.endsWith(".wasm") ? wasmUrl : path.endsWith(".data") ? dataUrl : path,
};
```

## 5. Write a scene

```tsx
// App.tsx
import {
  Viro3DSceneNavigator, ViroScene, ViroNode,
  ViroBox, ViroSphere, ViroText,
  ViroAmbientLight, ViroDirectionalLight,
  ViroMaterials, ViroAnimations,
} from "@reactvision/react-viro";
import { webRendererOptions } from "./webRenderer";

ViroMaterials.createMaterials({
  blue: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
  red: { lightingModel: "Blinn", diffuseColor: "#ff5533" },
});

ViroAnimations.registerAnimations({
  spin: { duration: 2000, easing: "Linear", properties: { rotateY: 360 } },
});

function MyScene() {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={300} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.6]} castsShadow />

      <ViroText
        position={[0, 1.5, -3]}
        width={4}
        height={1}
        text="Hello Viro Web"
        style={{ fontSize: 36, color: "#ffffff", textAlign: "Center" }}
      />

      <ViroNode position={[0, 0, -3]}>
        <ViroBox
          materials={["blue"]}
          animation={{ name: "spin", run: true, loop: true }}
          onClick={() => console.log("tapped the box")}
        />
        <ViroSphere position={[1.5, 0, 0]} radius={0.4} materials={["red"]} />
      </ViroNode>
    </ViroScene>
  );
}

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Viro3DSceneNavigator
        initialScene={{ scene: MyScene }}
        webRendererOptions={webRendererOptions}
      />
    </div>
  );
}
```

The navigator owns a full-size `<canvas>`; give its container a real height (here
`100vh`) or the canvas collapses.

## 6. Run

```sh
npm run dev
```

Open the printed URL. You should see the text, a spinning blue box (clickable) and
a red sphere.

---

## What you can use (no AR)

| Need | Components |
|---|---|
| Grouping / transforms | `ViroNode` |
| Primitives | `ViroBox`, `ViroSphere`, `ViroQuad`, `ViroSurface`, `ViroPolyline`, `ViroPolygon`, `ViroGeometry` |
| Text & images | `ViroText`, `ViroImage`, `ViroButton`, `ViroSpinner` |
| 3D models | `Viro3DObject` (GLB / VRX + skinning + model animations) |
| Backgrounds | `ViroSkyBox`, `Viro360Image`, `Viro360Video` |
| Video & audio | `ViroVideo`, `ViroMaterialVideo`, `ViroSound`, `ViroSpatialSound` |
| Lights | `ViroAmbientLight`, `ViroDirectionalLight`, `ViroOmniLight`, `ViroSpotLight` |
| Image-based lighting | `ViroLightingEnvironment` (`.hdr`) |
| Camera | `ViroCamera`, `ViroOrbitCamera` |
| Materials / animation | `ViroMaterials`, `ViroAnimations` |
| Effects / containers | `ViroParticleEmitter`, `ViroPortalScene` + `ViroPortal`, `ViroFlexView` |
| Utility | `ViroGameLoop` |
| Events | `onClick`, `onClickState`, `onHover` |

Full prop reference and examples: [Usage](./USAGE.md).

### Loading a model

```tsx
import helmet from "./DamagedHelmet.glb?url";

<Viro3DObject source={{ uri: helmet }} type="GLB" scale={[1.5, 1.5, 1.5]}
  onLoadEnd={() => console.log("loaded")} />
```

### Textured material + image

```tsx
ViroMaterials.createMaterials({
  crate: { lightingModel: "Lambert", diffuseTexture: require("./crate.png") },
});

<ViroImage source={{ uri: "/photo.jpg" }} width={1.5} height={1.5} />
```

---

## Gotchas

- **Blank canvas / 404s on `viro-web.wasm`/`.data`** — `webRendererOptions` isn't
  resolving the asset URLs. Check the network tab; make sure `optimizeDeps.exclude`
  lists the renderer and you're using `importGlue`.
- **A native component renders instead of the web one** — `resolve.extensions`
  must list `.web.tsx` before `.tsx`.
- **Dark scene** — the web build adds no default lights; add an ambient or
  directional light.
- **Canvas is a short strip** — the navigator's container needs an explicit
  height (`100vh` / a fixed px height); `height: 100%` collapses without it.
- **Video/audio won't autoplay** — browser policy: muted video autoplays; audio
  and unmuted video need a user gesture (start on a click).

---

## Not in scope here

AR (`ViroARSceneNavigator`/`ViroARScene`/`ViroARPlane`), `ViroFlexView` automatic
flexbox layout, image/object anchors, animation chains, and multi-scene push/pop
navigation. See [Usage](./USAGE.md) for the current status of each.
