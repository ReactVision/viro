# Viro on the web — Integration

Wiring Viro-web into an app: install, bundler config, WASM asset loading,
slam-wasm for AR, permissions, and deployment. For the component API see
[Usage](./USAGE.md); for how it works under the hood see [Internals](./INTERNALS.md).

- [Install](#install)
- [Bundler setup](#bundler-setup)
- [Loading the WASM assets](#loading-the-wasm-assets)
- [AR setup](#ar-setup)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Install

```sh
npm install @reactvision/react-viro @reactvision/viro-web-renderer react-native-web
```

- `@reactvision/react-viro` — the components (resolves `.web.tsx` on web).
- `@reactvision/viro-web-renderer` — the WASM/WebGL2 renderer + loader + AR session.
- `react-native-web` — the RN → DOM shim.

No cross-origin isolation (COOP/COEP) is required — the build is single-threaded.

---

## Bundler setup

Your bundler must:

1. **Resolve `.web.tsx` first** so web variants win over native.
2. **Alias `react-native` → `react-native-web`.**
3. **Make the renderer's `.wasm` / `.data` reachable at runtime.**

### Vite (validated)

```ts
// vite.config.ts
export default defineConfig({
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".json"],
    alias: { "react-native": "react-native-web" },
  },
  optimizeDeps: {
    // Don't pre-bundle the renderer: esbuild rewrites import.meta.url and breaks
    // the loader's relative resolution of the .wasm/.data sidecars.
    exclude: ["@reactvision/viro-web-renderer"],
  },
  assetsInclude: ["**/*.data", "**/*.wasm"],
});
```

### webpack 5

```js
// webpack.config.js
module.exports = {
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js"],
    alias: { "react-native$": "react-native-web" },
  },
  module: { rules: [{ test: /\.(wasm|data)$/, type: "asset/resource" }] },
};
```

### Metro / Expo web

```js
// metro.config.js
config.resolver.assetExts.push("wasm", "data");
// react-native-web alias + .web resolution are Expo web defaults.
```

Metro's pipeline for arbitrary imported binaries is less flexible, so prefer the
`assetBaseUrl` + `public/` approach below.

---

## Loading the WASM assets

The renderer ships three files: `viro-web.js` (glue), `viro-web.wasm`,
`viro-web.data`. Tell the renderer where they are via `webRendererOptions` on the
navigator. Three knobs (use what your bundler needs):

| Option | Use when |
|---|---|
| `importGlue: () => import(glueUrl)` | the bundler can dynamically import the glue at a URL (Vite/webpack with `?url`). |
| `locateFile: (path) => url` | you want to map the `.wasm`/`.data` filenames to served URLs. |
| `assetBaseUrl: string` | the three files are served together from one directory (CDN / `public/`). Also settable globally via `globalThis.VIRO_WEB_ASSET_BASE`. |

**Vite example:**

```tsx
import glueUrl from "@reactvision/viro-web-renderer/wasm/viro-web.js?url";
import wasmUrl from "@reactvision/viro-web-renderer/wasm/viro-web.wasm?url";
import dataUrl from "@reactvision/viro-web-renderer/wasm/viro-web.data?url";

const webRendererOptions = {
  importGlue: () => import(/* @vite-ignore */ glueUrl),
  locateFile: (path: string) =>
    path.endsWith(".wasm") ? wasmUrl : path.endsWith(".data") ? dataUrl : path,
};

<Viro3DSceneNavigator initialScene={{ scene: Scene }} webRendererOptions={webRendererOptions} />
```

**CDN / `public/` example:** copy the three files to `public/viro/` and:

```tsx
const webRendererOptions = { assetBaseUrl: "/viro/" };
```

Serve `.wasm` with `Content-Type: application/wasm`.

---

## AR setup

AR needs a second WASM module, **slam-wasm**, plus device capabilities.

### 1. Build slam-wasm

```sh
cd tinyvio
source ~/emsdk/emsdk_env.sh
bash scripts/build_slam_wasm.sh
```

Outputs `web/slam/tinyvio-slam.js` + `tinyvio-slam.wasm`, about 300 KB together.

The engine is **tinyvio**, presented through the drop-in C API in its
`platforms/slam/`. The surface this renderer drives — a `SlamModule` factory
yielding a `SlamEngine` class — is unchanged, which is why nothing here had to
move when the engine did. The files are named for what they are, because a
binary called `slam_wasm.wasm` next to them is how someone ends up debugging the
engine that was replaced.

### 2. Serve the artifacts

The build uses `MODULARIZE + EXPORT_NAME='SlamModule'` — a classic global
factory loaded via a `<script>` tag. Copy both files somewhere your app serves
static assets and keep them side by side (the `.js` resolves the `.wasm` relative
to its own URL):

```sh
cp web/slam/tinyvio-slam.{js,wasm} <your-app>/public/
```

Serve `tinyvio-slam.wasm` with `Content-Type: application/wasm`.

### 3. Point the navigator at it

```tsx
<ViroARSceneNavigator
  initialScene={{ scene: ARScene }}
  webRendererOptions={webRendererOptions}
  slamScriptUrl="/tinyvio-slam.js"   // injected as <script>, exposes global SlamModule
  arOptions={{ detectPlanes: true }}
/>
```

For an ESM/bundler-managed build instead, drop `slamScriptUrl` and pass
`loadSlam: () => import("/path/tinyvio-slam.mjs")`.

### 4. Device requirements & permissions

| Requirement | Why |
|---|---|
| **HTTPS** (or `localhost`) | `getUserMedia` is blocked on plain HTTP. |
| **Mobile device** | `devicemotion` (IMU) only exists on phones/tablets; slam needs it for gravity alignment. Desktop shows the feed but tracking won't converge. |
| **User gesture** | Camera + iOS `DeviceMotionEvent.requestPermission()` must come from a tap — the navigator's **"Start AR"** button handles this. Don't auto-start. |

`arOptions` tuning knobs: `intrinsics` (`{fx,fy,cx,cy}`, else derived from capture
size), `tuning` (slam noise/FAST/lost thresholds), `facingMode`
(`"environment"`/`"user"`), `captureWidth/Height`, `showCameraBackground`,
`maxPlanes`.

---

## Deployment

- Host the renderer trio (`viro-web.js/.wasm/.data`) and, for AR, the slam pair
  (`tinyvio-slam.js/.wasm`) on any static host; set `assetBaseUrl` / `slamScriptUrl`
  accordingly.
- Ensure `.wasm` is served as `application/wasm` and `.data` as a binary asset.
- Serve over **HTTPS** — mandatory for camera access, and required by iOS even on
  a LAN. During development, tunnel `localhost` (e.g. `ngrok`) for phone testing.
- The renderer `.wasm` + `.data` are a few MB; enable gzip/brotli and long-cache
  the hashed assets.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Blank canvas, no errors | `webRendererOptions` not pointing at the real asset URLs; check the network tab for 404s on `viro-web.wasm`/`.data`. |
| `import.meta.url` / relative path errors | bundler pre-bundled the renderer — exclude it (Vite `optimizeDeps.exclude`) and load the glue via `importGlue`. |
| Native component rendered instead of web | bundler not resolving `.web.tsx` first — fix `resolve.extensions`. |
| Dark scene | no lights — the web build adds none by default; add an ambient/directional light. |
| AR: "slam-wasm not found" | pass `slamScriptUrl` or `loadSlam`, or preload the global `SlamModule`. |
| AR: camera never starts | not HTTPS, or permission denied; the Start button must be a real user tap. |
| AR: stuck in "Limited"/"Unavailable" | no IMU (desktop), motion permission denied, or too little parallax — move slowly over a textured, well-lit surface on a real device. |
| AR: camera image looks flipped | report it — the background is flipped Y by default; a per-device fix may be needed. |

The reference working configuration is the Vite harness in
[`viro/web-harness/`](../../web-harness) (`npm run harness`).
