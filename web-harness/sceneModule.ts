/**
 * Compiles caller-supplied scene code and runs it against the curated
 * `@reactvision/react-viro` web surface. Shared by render.tsx (the headless
 * driver's page) and preview.tsx (the page a developer opens).
 */
import * as React from "react";
import { createElement, useEffect, useRef, useSyncExternalStore } from "react";
import * as ReactNativeWeb from "react-native";
// @ts-expect-error -- @babel/standalone ships no first-party types
import * as Babel from "@babel/standalone";

import { pushWarning, renderState } from "./renderState";
import { makeCheckerDataUrl, PLACEHOLDER_MODEL_URL } from "./placeholderAssets";
import * as ViroWeb from "./viroWebComponents";

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

// A local model's require() gives a URL marked with its specifier, and
// Viro3DObject looks the specifier up here when it renders. So a model whose
// file arrives later is swapped in place, without running the scene again.
const MODEL_MARK = "#viro-preview-model=";
const MODEL_RE = /\.(glb|gltf|vrx|obj|fbx)$/i;
const liveModels = new Map<string, string>();
const liveListeners = new Set<() => void>();
let liveVersion = 0;
const subscribeLive = (fn: () => void) => {
  liveListeners.add(fn);
  return () => liveListeners.delete(fn);
};

/** The URLs local models resolve to now. */
export function setModelOverrides(overrides: Record<string, string> | undefined): void {
  liveModels.clear();
  for (const [specifier, url] of Object.entries(overrides ?? {})) if (MODEL_RE.test(specifier)) liveModels.set(specifier, url);
  liveVersion++;
  for (const fn of liveListeners) fn();
}

const modelName = (specifier: string) => specifier.replace(/^__preview__\//, "");

function resolveModel(source: any): { source: any; name: string | null } {
  const uri = source?.uri;
  if (typeof uri !== "string") return { source, name: typeof source === "string" ? source.split(/[?#]/)[0]!.split("/").pop()! : null };
  const at = uri.indexOf(MODEL_MARK);
  if (at < 0) return { source, name: uri.split(/[?#]/)[0]!.split("/").pop()! };
  const specifier = decodeURIComponent(uri.slice(at + MODEL_MARK.length));
  return { source: { ...source, uri: liveModels.get(specifier) ?? PLACEHOLDER_MODEL_URL }, name: modelName(specifier) };
}

// Models mounted with a real file that have not finished loading, by name, for the screenshot's wait.
const loadingModels = new Map<object, string>();
function syncLoading() {
  renderState.loading = [...new Set(loadingModels.values())].sort();
}

// A stand-in keeps the scale written for the model it replaces, and a model
// authored in other units has one that makes a 1 m box a speck or a wall.
const STAND_IN_SIDE = { min: 0.1, max: 1 };
function Viro3DObject(given: any) {
  useSyncExternalStore(subscribeLive, () => liveVersion);
  const { source, name } = resolveModel(given.source);
  const uri: unknown = source?.uri ?? source;
  const standIn = uri === PLACEHOLDER_MODEL_URL;
  const loading = standIn || typeof uri !== "string" ? null : (name ?? uri);
  const loaded = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!loading) return;
    const key = {};
    loadingModels.set(key, loading);
    syncLoading();
    loaded.current = () => {
      if (loadingModels.delete(key)) syncLoading();
    };
    return () => loaded.current?.();
  }, [loading, uri]);
  let props = { ...given, source };
  if (loading) {
    props.onLoadEnd = (...args: unknown[]) => {
      loaded.current?.();
      return given.onLoadEnd?.(...args);
    };
    props.onError = (...args: unknown[]) => {
      loaded.current?.();
      return given.onError?.(...args);
    };
  }
  const scale = props.scale;
  if (standIn && Array.isArray(scale)) {
    const side = Math.max(...scale.map((n: number) => Math.abs(n)));
    if (side > 0 && (side < STAND_IN_SIDE.min || side > STAND_IN_SIDE.max)) {
      const fit = Math.min(STAND_IN_SIDE.max, Math.max(STAND_IN_SIDE.min, side)) / side;
      props = { ...props, scale: scale.map((n: number) => n * fit) };
    }
  }
  // Keyed by the file: a model swapped in gets a node of its own rather than a second model in the stand-in's.
  return createElement(ViroWeb.Viro3DObject, { ...props, key: typeof uri === "string" ? uri : undefined });
}

const extraExports: Record<string, unknown> = { Viro3DObject };

/** Adds names to the `@reactvision/react-viro` the caller's code sees, ahead of the stub fallback. */
export function addViroExports(extra: Record<string, unknown>): void {
  Object.assign(extraExports, extra);
}

// Each component the caller's code takes from the module, by the name it took it under.
const viroNames = new Map<unknown, string>();
const named = <T>(name: string, value: T): T => {
  viroNames.set(value, name);
  return value;
};

const viroReactModule = new Proxy(ViroWeb as Record<string, unknown>, {
  get(target, prop) {
    if (typeof prop === "string" && prop in extraExports) return named(prop, extraExports[prop]);
    if (typeof prop === "string" && prop in target) return named(prop, target[prop]);
    if (typeof prop === "string") return makeUnsupportedStub(prop);
    return undefined;
  },
});

/** Where a Viro element was written, as the preview bundler's JSX runtime stamps it on the element's props. */
export type ViroSource = { name: string; file: string; line: number };
export const VIRO_SOURCE_PROP = "__viroPreviewSource";

// The preview bundler compiles JSX against this runtime (its jsxImportSource),
// which passes each element's file and line. Only Viro components are stamped:
// on anything else the extra prop could reach the DOM.
const previewJsxRuntime = {
  Fragment: React.Fragment,
  jsxDEV(type: any, props: Record<string, unknown>, key: unknown, _isStatic: boolean, source?: { fileName?: string; lineNumber?: number }) {
    const config: Record<string, unknown> = { ...props };
    if (key !== undefined) config.key = key;
    const name = viroNames.get(type);
    if (name && source?.fileName) config[VIRO_SOURCE_PROP] = { name, file: source.fileName, line: source.lineNumber ?? 0 } satisfies ViroSource;
    return createElement(type, config);
  },
};

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
    if (specifier === "@reactvision/react-viro/preview/jsx-dev-runtime") return previewJsxRuntime;
    const override = assetOverrides?.[specifier];
    if (MODEL_RE.test(specifier)) return { uri: `${override ?? PLACEHOLDER_MODEL_URL}${MODEL_MARK}${encodeURIComponent(specifier)}` };
    if (override) return { uri: override };
    const ext = specifier.split(".").pop()?.toLowerCase() ?? "";
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) return { uri: checkerUrl };
    if (["mp3", "wav", "m4a", "ogg", "mp4", "mov", "webm"].includes(ext)) {
      pushWarning(`Skipped local media asset "${specifier}" — no placeholder audio/video.`);
      return null;
    }
    pushWarning(`Unresolved import "${specifier}" — using a null placeholder.`);
    return null;
  };
}

export function compileGeneratedScene(code: string, assetOverrides: Record<string, string> | undefined): React.ComponentType<any> {
  return compileGeneratedScenes(code, assetOverrides)[0]!;
}

/** Every scene a multi-scene module exports as `__viroPreviewScenes`, or just its default export. */
export function compileGeneratedScenes(code: string, assetOverrides: Record<string, string> | undefined): React.ComponentType<any>[] {
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
  setModelOverrides(assetOverrides);
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
  const scenes = moduleObj.exports?.__viroPreviewScenes;
  return Array.isArray(scenes) && scenes.length ? scenes : [exported];
}

