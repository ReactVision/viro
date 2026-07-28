import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite config for the web bridge harness (web-harness/). Resolves .web.* first
 * and aliases react-native -> react-native-web so the Viro components load on
 * the web. Single-threaded WASM, so no COOP/COEP headers are required.
 */
export default defineConfig({
  root: "web-harness",
  resolve: {
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".json",
    ],
    alias: {
      "react-native": "react-native-web",
    },
  },
  plugins: [react()],
  optimizeDeps: {
    // Don't pre-bundle the WASM renderer: esbuild optimization rewrites
    // import.meta.url, breaking the loader's relative resolution of
    // ../wasm/viro-web.{js,wasm,data}. Serving it as raw ESM keeps the paths.
    exclude: ["@reactvision/viro-web-renderer"],
  },
  server: {
    // Allow importing the Viro source (../components), node_modules, and the
    // linked @reactvision/viro-web-renderer package (a symlink resolving to the
    // sibling repo under the workspace root, i.e. two levels up from the harness).
    fs: { allow: ["../.."] },
  },
  // Emscripten .wasm/.data are fetched at runtime; treat .data as an asset.
  assetsInclude: ["**/*.data", "**/*.wasm"],
});
