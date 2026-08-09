/**
 * Headless render entry point for the reactviro-mcp-server
 * `reactviro_render_scene` tool. Given scene input injected via
 * `window.__RENDER_INPUT__` (set by the driving Playwright script through
 * `page.addInitScript`, before this module runs), mounts the scene and
 * reports readiness/errors/warnings via `window.__renderState`
 * (renderState.ts). The driver takes the actual screenshot itself (Playwright's
 * own canvas-locator screenshot, not a hand-rolled toDataURL call) — this
 * file's only job is to get real pixels on the canvas and know when to say
 * "done".
 *
 * Two input kinds:
 *   - { kind: "studio", scene: StudioSceneResponse, mode? }
 *       Rendered through the existing StudioSceneNavigator.web path — no code
 *       execution, sceneData is plain JSON.
 *   - { kind: "tsx", code: string, navigatorType: "AR" | "VR" | "3D", assetOverrides? }
 *       The TSX (e.g. straight out of reactviro_generate_scene) is transpiled
 *       in-browser (Babel standalone) and executed against the curated
 *       `@reactvision/react-viro` shim in viroWebComponents.ts. Components
 *       without a web implementation degrade to a stub that renders children
 *       only and records a warning instead of crashing the whole scene.
 *       Local `require('./assets/...')` calls resolve to built-in placeholder
 *       assets, UNLESS `assetOverrides` has an exact-string match for that
 *       require() literal, in which case that real URL is used instead.
 *
 * Security note: the "tsx" path executes caller-supplied code. This file is
 * ONLY ever loaded in an ephemeral, isolated Playwright browser context (see
 * reactviro-mcp-server/src/render/browser.ts) that has no route to the
 * internet and no access to server secrets, and is torn down right after one
 * render — never in a real user's browser tab.
 */
import * as React from "react";
import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as ReactNativeWeb from "react-native";
// @ts-expect-error -- @babel/standalone ships no first-party types
import * as Babel from "@babel/standalone";

import { renderState, pushWarning, markReady, markError } from "./renderState";
import { makeCheckerDataUrl, PLACEHOLDER_MODEL_URL } from "./placeholderAssets";
import { webRendererOptions } from "./wasmOptions";
import { StudioSceneNavigator } from "../components/Studio/StudioSceneNavigator";
import type { ArPlaybackFrame, ViroArSession } from "@reactvision/viro-web-renderer";
import * as ViroWeb from "./viroWebComponents";
import type { StudioSceneResponse } from "../components/Studio/types";

type RenderInput =
  | { kind: "studio"; scene: StudioSceneResponse; mode?: "ar" | "3d" }
  | {
      kind: "tsx";
      code: string;
      navigatorType: "AR" | "VR" | "3D";
      assetOverrides?: Record<string, string>;
    }
  | {
      /**
       * Composite a Studio scene over a recorded AR session: the recording's
       * frames as the camera background, its poses as the camera. The poses are
       * computed offline and arrive already in virocore (Y-up/GL) space — see
       * viro-web-renderer's README on `playback`.
       *
       * The driver steps frames itself through window.__playbackStep, one at a
       * time, rather than letting anything run free: a screenshot has to line up
       * with a known frame index, and a rAF loop cannot promise that.
       */
      kind: "playback";
      scene: StudioSceneResponse;
      videoUrl: string;
      frames: ArPlaybackFrame[];
    };

declare global {
  interface Window {
    /**
     * Advance the replay to one frame and resolve once it is decoded and drawn.
     * Present only in playback mode, and only after the session has started.
     */
    __playbackStep?: (index: number) => Promise<boolean>;
    __playbackFrameCount?: number;
    __RENDER_INPUT__?: RenderInput;
  }
}

// ─── Unsupported-on-web fallback ──────────────────────────────────────────
// Any name the caller's code imports from "@reactvision/react-viro" that
// isn't re-exported from viroWebComponents.ts renders its children
// un-anchored and records a warning, instead of throwing. The Proxy also
// covers non-JSX usage (e.g. `ViroARTrackingTargets.createTargets(...)`
// called at module scope) by turning any property access into a no-op.
function makeUnsupportedStub(name: string) {
  function Stub(props: any) {
    useEffect(() => {
      pushWarning(`"${name}" has no web implementation yet — rendering children only.`);
    }, []);
    return props?.children ? createElement(React.Fragment, null, props.children) : null;
  }
  Stub.displayName = `Unsupported(${name})`;
  return new Proxy(Stub, {
    get(target, prop) {
      if (prop === "displayName" || prop in target) return (target as any)[prop];
      if (typeof prop !== "string") return undefined;
      return (..._args: unknown[]) => {
        pushWarning(`"${name}.${prop}" has no web implementation yet — ignored.`);
      };
    },
  });
}

const viroReactModule = new Proxy(ViroWeb as Record<string, unknown>, {
  get(target, prop) {
    if (typeof prop === "string" && prop in target) return target[prop];
    if (typeof prop === "string") return makeUnsupportedStub(prop);
    return undefined;
  },
});

// ─── require() shim for the transpiled generated TSX ──────────────────────
// `assetOverrides` (exact-string keyed on the require() literal) lets a
// caller who controls the source swap a real URL in for a specific local
// asset instead of getting the generic placeholder — useful when they want
// to preview their actual model/texture, not just check composition.
const checkerUrl = makeCheckerDataUrl();
function makeRequireShim(assetOverrides: Record<string, string> | undefined) {
  return function requireShim(specifier: string): unknown {
    if (specifier === "react") return React;
    if (specifier === "react-native") return ReactNativeWeb;
    if (specifier === "@reactvision/react-viro") return viroReactModule;
    const override = assetOverrides?.[specifier];
    if (override) return { uri: override };
    const ext = specifier.split(".").pop()?.toLowerCase() ?? "";
    if (["glb", "gltf", "vrx", "obj", "fbx"].includes(ext)) return { uri: PLACEHOLDER_MODEL_URL };
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) return { uri: checkerUrl };
    if (["mp3", "wav", "m4a", "ogg", "mp4", "mov", "webm"].includes(ext)) {
      pushWarning(`Skipped local media asset "${specifier}" — no placeholder audio/video.`);
      return null;
    }
    pushWarning(`Unresolved import "${specifier}" — using a null placeholder.`);
    return null;
  };
}

function compileGeneratedScene(code: string, assetOverrides: Record<string, string> | undefined): React.ComponentType<any> {
  const result = Babel.transform(code, {
    filename: "GeneratedScene.tsx",
    presets: [
      ["typescript", { isTSX: true, allExtensions: true }],
      ["react", { runtime: "classic" }],
    ],
    plugins: ["transform-modules-commonjs"],
    sourceType: "module",
  });
  const js = result.code ?? "";
  const moduleObj: { exports: any } = { exports: {} };
  // Sandboxed exec of caller-supplied code — see file header. `new Function`
  // gives a fresh top-level scope; the only things it can reach are the
  // arguments passed below (no closures over anything else in this module).
  // eslint-disable-next-line no-new-func
  const run = new Function("module", "exports", "require", js);
  run(moduleObj, moduleObj.exports, makeRequireShim(assetOverrides));
  const exported = moduleObj.exports?.default ?? moduleObj.exports;
  if (typeof exported !== "function") {
    throw new Error("Generated scene has no default-exported component.");
  }
  return exported as React.ComponentType<any>;
}

function TsxRoot({ code, assetOverrides }: { code: string; assetOverrides?: Record<string, string> }) {
  const [App, setApp] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    try {
      const Compiled = compileGeneratedScene(code, assetOverrides);
      // setApp(Compiled) would be misread as a useState *updater* function
      // (React calls it with prevState instead of storing it) — wrap it so
      // the component itself, not its first invocation's return value, ends
      // up in state.
      setApp(() => Compiled);
    } catch (err) {
      markError(err);
    }
  }, [code]);

  useEffect(() => {
    if (!App) return;
    // The generated scaffold's own navigator has no onSceneReady-style hook —
    // approximate "ready" with a settle window once a <canvas> shows up, so
    // placeholder textures/geometry have time to upload to the GL context.
    const start = performance.now();
    let cancelled = false;
    const check = () => {
      if (cancelled || renderState.ready) return;
      const canvas = document.querySelector("canvas");
      if (canvas && performance.now() - start > 600) {
        markReady();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
    return () => {
      cancelled = true;
    };
  }, [App]);

  return App ? createElement(App) : null;
}

function StudioRoot({ scene, mode }: { scene: StudioSceneResponse; mode?: "ar" | "3d" }) {
  return createElement(StudioSceneNavigator, {
    sceneData: scene,
    mode,
    webRendererOptions,
    onSceneReady: markReady,
    onError: (err: Error) => markError(err),
    onUnsupported: (features: string[]) => {
      for (const f of features) pushWarning(`Studio scene uses unsupported feature "${f}" on web.`);
    },
  });
}

function PlaybackRoot({
  scene,
  videoUrl,
  frames,
}: {
  scene: StudioSceneResponse;
  videoUrl: string;
  frames: ArPlaybackFrame[];
}) {
  const onSessionReady = (session: ViroArSession) => {
    // Hand the driver a stepper rather than letting it reach into the session.
    // It resolves per frame, so the driver can screenshot straight after
    // without racing the video decoder.
    window.__playbackStep = (index: number) => session.renderPlaybackFrame(index);
    window.__playbackFrameCount = session.playbackFrameCount;
    markReady();
  };

  return createElement(StudioSceneNavigator, {
    sceneData: scene,
    // A recording is an AR session by definition; 3D mode would drop the camera
    // background and defeat the point.
    mode: "ar" as const,
    webRendererOptions,
    arOptions: { playback: { videoUrl, frames }, showCameraBackground: true },
    onSessionReady,
    onError: (err: Error) => markError(err),
    onUnsupported: (features: string[]) => {
      for (const f of features) pushWarning(`Studio scene uses unsupported feature "${f}" on web.`);
    },
  });
}

const input = window.__RENDER_INPUT__;
if (!input) {
  markError(new Error("window.__RENDER_INPUT__ was not set before render.tsx ran."));
} else if (input.kind === "playback") {
  createRoot(document.getElementById("root")!).render(
    createElement(PlaybackRoot, {
      scene: input.scene,
      videoUrl: input.videoUrl,
      frames: input.frames,
    }),
  );
} else if (input.kind === "studio") {
  createRoot(document.getElementById("root")!).render(
    createElement(StudioRoot, { scene: input.scene, mode: input.mode }),
  );
} else {
  if (input.navigatorType === "VR") {
    pushWarning(
      'navigator_type "VR" has no web implementation yet — rendered via the 3D fallback (see viroWebComponents.ts).',
    );
  }
  createRoot(document.getElementById("root")!).render(
    createElement(TsxRoot, { code: input.code, assetOverrides: input.assetOverrides }),
  );
}
