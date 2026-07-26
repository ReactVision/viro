# ViroReact (@reactvision/react-viro)

AR/VR library for React Native, published to npm as `@reactvision/react-viro`. The primary internal consumer is the ReactVisionStudio monorepo (sibling repo `../ReactVisionStudio`), whose StudioGo app renders Studio-authored scenes. `../viro-test-app` exercises Viro changes in isolation. Never nest this repo inside another repo's tree (yarn workspaces / turbo / metro will ingest it).

## Build and runtime reality

- The package runs from `dist/` (`main: dist/index.js`). Editing `.tsx`/`.ts` source without `npm run build` is a runtime no-op.
- Local dev loop against StudioGo without burning versions: `npm run build`, copy `dist/` over `ReactVisionStudio/apps/studio-go/node_modules/@reactvision/react-viro/dist/`, reload Metro. `npm pack` gives pre-publish confidence. If hot-patching node_modules directly, patch `dist/`, not source.
- JS-only changes reach consumers via EAS Update (OTA); any native change (`ios/`, `android/`, virocore, view managers) requires a fresh EAS native build in consumers.

## Publishing

Manual `npm publish`, maintainer-driven — never publish autonomously. Risky or native changes go out under a `beta`/`next` dist-tag first, get pinned and verified in StudioGo, then promoted with `npm dist-tag add ... latest`. Trivial additive JS-only changes can go straight to latest.

## Studio scene-logic runtime (components/Studio)

- `components/Studio/domain/` is the runtime shared with StudioGo: `sceneNavigationHandler.ts` (the `executeFunctionWithRelations` dispatcher, switching on `function_type`), `viroNodeFactory.tsx`, `collisionBindingsRuntime.ts`, stores/managers (sound, visibility, variables), and `StudioARScene.tsx` as the host here.
- Runtime features must be wired into BOTH hosts: `StudioARScene` (this repo) and StudioGo's `StudioXRScene`. This never follows automatically from the shared walker code. Transports differ: StudioGo uses a JWT edge-function controller; production viro consumers use the native module with X-API-Key. `StudioARScene` must default seamlessly — production consumers never construct runtimeCtx themselves.
- StudioGo vendors this runtime (`apps/studio-go/components/Scene/studio/domain/`) and intentionally FORKS two files; changes here must be re-applied there, and their local mods preserved on any re-vendor:
  - `sceneNavigationHandler.ts` — StudioGo fork replaces native `rvGetScene` with the JWT SceneService.
  - `viroNodeFactory.tsx` — StudioGo fork carries physics-drag params AND `onCollision` wiring (a past re-vendor dropped onCollision silently; keep both).

## Known traps

- Components building nativeProps via `Object.assign({}, this.props)` must scrub `nativeProps.onClick = undefined` (issue #272 pattern). A leaked raw JS `onClick` crashes iOS at mount (`unrecognized selector setOnClick:`) with NO JS logs; `unrecognized selector setOnX:` on a VRT class means a raw prop leaked through a spread. Debug log-less scene-open crashes via Sentry.
