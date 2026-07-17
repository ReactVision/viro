# Viro on the web (experimental)

`@reactvision/react-viro` renders on the web via `react-native-web` + a WASM/WebGL2
build of the Viro renderer (`@reactvision/viro-web-renderer`). Components resolve
to `.web.tsx` implementations that drive the renderer through a scene C API — no
native module, no DOM-per-view.

> Status: Phase 3 (MVP-2, experimental AR). Supported so far:
> `Viro3DSceneNavigator`, `ViroScene`, `ViroNode`, `ViroBox`/`ViroSphere`/
> `ViroQuad`/`ViroSurface`, `Viro3DObject` (GLB/VRX + skinning), lights,
> `ViroCamera`, `ViroMaterials` (color + PBR textures), `ViroAnimations`
> (declarative) and model animations, and click/hover events. **AR:**
> `ViroARSceneNavigator`, `ViroARScene`, `ViroARPlane` (camera + 6-DoF pose +
> plane detection + hit-test via slam-wasm) — see **[WEB_AR.md](./WEB_AR.md)**.
> Not yet: `ViroText`/`ViroImage` (need async asset loading), animation chains,
> image/object anchors, `ViroARPlaneSelector`.

## Install

```sh
npm install @reactvision/react-viro @reactvision/viro-web-renderer react-native-web
```

## Bundler setup

Your bundler must (1) resolve `.web.tsx` first, (2) alias `react-native` →
`react-native-web`, and (3) make the renderer's `.wasm`/`.data` assets reachable.
See **Bundler integration** in `@reactvision/viro-web-renderer`'s README for
per-bundler snippets (Vite validated; webpack and Metro/Expo documented).

**No COOP/COEP / cross-origin isolation required** — the build is single-threaded.

## Minimal example

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
      webRendererOptions={webRendererOptions /* how to load the WASM assets — see renderer README */}
    />
  );
}
```

`webRendererOptions` (`importGlue`/`assetBaseUrl`/`locateFile`) tells the renderer
where the WASM assets live; it's the one bundler-specific bit. On plain ESM it can
be omitted (the package self-resolves).

## Local development

A Vite harness lives in `web-harness/` (`npm run harness`) and exercises the full
web bridge against the local WASM build — the reference for a working setup.
