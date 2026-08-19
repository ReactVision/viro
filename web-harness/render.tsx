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

const SLAM_SCRIPT_URL = "/tinyvio-slam.js";
import { StudioSceneNavigator } from "../components/Studio/StudioSceneNavigator";
import type { ArPlaybackFrame, ViroArSession } from "@reactvision/viro-web-renderer";
import * as ViroWeb from "./viroWebComponents";
import { setPlaybackSource } from "./viroWebComponents";
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
      /** A StudioSceneResponse, or TSX to compile. */
      scene: StudioSceneResponse | string;
      assetOverrides?: Record<string, string>;
      videoUrl: string;
      frames: ArPlaybackFrame[];
      /**
       * The recording camera's intrinsics, and the resolution they were
       * measured at. Without them the scene is projected through an assumed
       * 60-degree field of view, which lines up with the footage only by
       * coincidence — the camera image fills the viewport either way, so the
       * mismatch shows up as content standing in the wrong place.
       */
      intrinsics?: { fx: number; fy: number; cx: number; cy: number };
      intrinsicsSize?: { width: number; height: number };
      /** Display rotation of the video, so the renderer can orient the intrinsics. */
      intrinsicsRotation?: number;
    };

declare global {
  interface Window {
    /**
     * Advance the replay to one frame and resolve once it is decoded and drawn.
     * Present only in playback mode, and only after the session has started.
     */
    __playbackStep?: (index: number) => Promise<boolean>;
    __playbackFrameCount?: number;
    /**
     * Swap the scene being drawn over the recording, without restarting the
     * session. An authoring surface changes the scene on every drag of a
     * position slider; reloading the page for each one would re-initialise the
     * tracker's WASM and re-open the video to show a box moved two
     * centimetres. Present only in playback mode with a Studio scene -- caller
     * TSX has to be recompiled, which this cannot do.
     */
    __setScene?: (scene: StudioSceneResponse) => void;
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
    // tinyvio, through platforms/slam's drop-in C API. Only the live AR path
    // loads it; playback drives poses computed outside the browser.
    slamScriptUrl: SLAM_SCRIPT_URL,
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
  intrinsics,
  intrinsicsSize,
  intrinsicsRotation,
}: {
  scene: StudioSceneResponse;
  videoUrl: string;
  frames: ArPlaybackFrame[];
  intrinsics?: { fx: number; fy: number; cx: number; cy: number };
  intrinsicsSize?: { width: number; height: number };
  intrinsicsRotation?: number;
}) {
  // The prop is the initial scene; after mount the live one comes from
  // __setScene. The headless driver never calls it and sees the prop unchanged.
  const [live, setLive] = useState(scene);
  useEffect(() => {
    window.__setScene = setLive;
    return () => {
      delete window.__setScene;
    };
  }, []);

  const onSessionReady = (session: ViroArSession) => {
    // Hand the driver a stepper rather than letting it reach into the session.
    // It resolves per frame, so the driver can screenshot straight after
    // without racing the video decoder.
    window.__playbackStep = (index: number) => session.renderPlaybackFrame(index);
    window.__playbackFrameCount = session.playbackFrameCount;
    markReady();
  };

  return createElement(StudioSceneNavigator, {
    sceneData: live,
    // A recording is an AR session by definition; 3D mode would drop the camera
    // background and defeat the point.
    mode: "ar" as const,
    webRendererOptions,
    arOptions: {
      playback: { videoUrl, frames, intrinsics, intrinsicsSize, intrinsicsRotation },
      showCameraBackground: true,
    },
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
  if (typeof input.scene === "string") {
    // Caller TSX over a recording. The scene declares its own navigator, so the
    // recording is handed to it through the wrapper in viroWebComponents rather
    // than as a prop the caller would have had to know to pass.
    setPlaybackSource(
      { videoUrl: input.videoUrl, frames: input.frames,
        intrinsics: input.intrinsics, intrinsicsSize: input.intrinsicsSize,
        intrinsicsRotation: input.intrinsicsRotation },
      (session: any) => {
        window.__playbackStep = (i: number) => session.renderPlaybackFrame(i);
        window.__playbackFrameCount = session.playbackFrameCount;
        markReady();
      },
    );
    createRoot(document.getElementById("root")!).render(
      createElement(TsxRoot, { code: input.scene, assetOverrides: input.assetOverrides }),
    );
  } else {
    createRoot(document.getElementById("root")!).render(
      createElement(PlaybackRoot, {
        scene: input.scene,
        videoUrl: input.videoUrl,
        frames: input.frames,
        intrinsics: input.intrinsics,
        intrinsicsSize: input.intrinsicsSize,
        intrinsicsRotation: input.intrinsicsRotation,
      }),
    );
  }
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
