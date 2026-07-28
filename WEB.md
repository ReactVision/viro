# Viro on the web (experimental)

`@reactvision/react-viro` renders in the browser via `react-native-web` + a
WASM/WebGL2 build of the Viro renderer (`@reactvision/viro-web-renderer`).
Components resolve to `.web.tsx` implementations that drive the renderer through a
scene C API — no native module, no DOM-per-view. AR adds a second WASM module
(slam-wasm) for tracking.

> Status: Phase 3 (MVP-2). 3D scenes + experimental AR (camera + 6-DoF pose +
> plane detection + hit-test) on mobile web.

## Documentation

Full docs live in **[`docs/web/`](./docs/web/README.md)**:

- **[Usage](./docs/web/USAGE.md)** — components, props, events, materials,
  animations, and AR — for app developers.
- **[Integration](./docs/web/INTEGRATION.md)** — install, bundler config, WASM
  assets, slam-wasm build & serving, permissions, deployment.
- **[Internals](./docs/web/INTERNALS.md)** — architecture, the C API, render
  loops, the AR pipeline, and the build flow — for contributors.

## Install

```sh
npm install @reactvision/react-viro @reactvision/viro-web-renderer react-native-web
```

No COOP/COEP / cross-origin isolation required — the build is single-threaded.
The reference working setup is the Vite harness in
[`web-harness/`](./web-harness) (`npm run harness`).
