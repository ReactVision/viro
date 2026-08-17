/**
 * Shared WASM asset-loading options for the harness's Vite bundler (see
 * @reactvision/viro-web-renderer's README on why importGlue/locateFile are
 * needed under bundlers that rewrite import.meta.url). Used by main.tsx and
 * render.tsx's StudioRoot directly, AND injected as a default in
 * viroWebComponents.ts's navigator wrappers — caller-supplied TSX (the
 * "tsx" render path) has no way to know about this harness's bundler setup,
 * so its own `<ViroARSceneNavigator>`/`<Viro3DSceneNavigator>` JSX never
 * passes `webRendererOptions` itself; without the wrapper defaulting it, the
 * renderer falls back to resolving the WASM at a root-relative
 * `/wasm/viro-web.js`, which 404s against this harness's hashed build output.
 */
import glueUrl from "./wasm/viro-web.js?url";
import wasmUrl from "./wasm/viro-web.wasm?url";
import dataUrl from "./wasm/viro-web.data?url";

export const webRendererOptions = {
  importGlue: () => import(/* @vite-ignore */ glueUrl),
  locateFile: (path: string) => {
    if (path.endsWith(".wasm")) return wasmUrl;
    if (path.endsWith(".data")) return dataUrl;
    return path;
  },
};
