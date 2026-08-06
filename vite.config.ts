import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Absolute path of this file's directory (viro/), independent of cwd — used
// to anchor the multi-page build.rollupOptions.input entries below.
const rootDir = fileURLToPath(new URL(".", import.meta.url));

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
    // @babel/standalone is a large UMD/CJS bundle (used by render.tsx to
    // transpile caller-supplied TSX in-browser) — pre-bundle it explicitly so
    // Vite's dep scanner doesn't miss it on first load.
    include: ["@babel/standalone"],
  },
  build: {
    rollupOptions: {
      // Multi-page build: index.html is the interactive demo (main.tsx),
      // render.html is the headless entry (render.tsx) that
      // reactviro-mcp-server's Playwright driver navigates to. Without this,
      // `vite build` only emits index.html.
      input: {
        main: `${rootDir}web-harness/index.html`,
        render: `${rootDir}web-harness/render.html`,
      },
    },
  },
  server: {
    // Allow importing the Viro source (../components), node_modules, and the
    // linked @reactvision/viro-web-renderer package (a symlink resolving to the
    // sibling repo under the workspace root, i.e. two levels up from the harness).
    fs: { allow: ["../.."] },
    // Testing AR (getUserMedia/DeviceMotion) needs HTTPS on a real phone; an
    // ngrok tunnel is the quickest way to get that without local cert setup.
    // Leading dot matches any subdomain, since free ngrok URLs rotate per session.
    allowedHosts: [".ngrok-free.app"],
  },
  // Emscripten .wasm/.data are fetched at runtime; treat .data as an asset.
  assetsInclude: ["**/*.data", "**/*.wasm"],
});
