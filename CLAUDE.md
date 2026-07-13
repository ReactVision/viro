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
- `virocore` has two divergent copies of `VROGeospatial.h` — `ios/ViroKit/VROGeospatial.h` (uses `VROEarthTrackingState::Enabled`) and `ViroRenderer/VROGeospatial.h` (uses `::Tracking` for the same state), both compiled with the identical include guard `VROGeospatial_h`. Xcode's real "Copy Headers" build phase flattens both into one directory with `ios/ViroKit`'s copy winning (confirmed against the shipped `ViroKit.framework/Headers/VROGeospatial.h`, which has `Enabled`) — Android's CMake build never sees the `ios/ViroKit` copy at all, so it consistently gets `Tracking`. Any change to this enum must be applied to **both** copies, appended at the end never inserted in the middle (Android's JNI bridge, `ARScene.java`, maps the enum to Java by raw ordinal position, not by name). A naive manual compile check that adds both directories to the include path (instead of replicating Xcode's flatten-with-override) produces a false-positive "no member named Enabled" error — build a staging directory that copies `ViroRenderer/*.h` first then `ios/ViroKit/*.h` on top before compiling standalone.
