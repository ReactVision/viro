/**
 * The page a developer opens to look at their own scene: the same compile and
 * runtime as render.tsx, kept running and interactive instead of screenshotted.
 *
 * Input arrives as `window.__PREVIEW_INPUT__`, set by an inline script the
 * serving page puts ahead of this module. An AR scene is shown from a virtual
 * camera the viewer moves (see viroVirtualCamera.ts) unless the URL has `?ar=1`,
 * which starts real web AR on a phone instead.
 *
 * The status is posted to the parent window as `{ type: "reactviro-preview" }`
 * messages, so a host that frames this page (an MCP Apps view) can report
 * compile and runtime errors back to the model.
 */
import * as React from "react";
import { createElement, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { renderState, pushWarning, markReady, markError } from "./renderState";
import { addViroExports, compileGeneratedScenes } from "./sceneModule";
import { ViroARPlaneSelector } from "../components/AR/ViroARPlaneSelector";
import { setARNavigatorDefaults } from "./viroWebComponents";

type PreviewInput = {
  code: string;
  assetOverrides?: Record<string, string>;
  title?: string;
  /** Text the page offers to copy for the developer's coding agent. */
  renderRequest?: string;
  /** Base URL of the server's routes for starting and listing renders of this scene. */
  renderApi?: string;
  /** The scenes the module exports, in order, when there is more than one; each one's render request replaces `renderRequest`. */
  scenes?: SceneInfo[];
  /** Which update of the preview this is, and where a newer one is asked for: the page appends the version it shows. */
  version?: number;
  updatesUrl?: string;
};

type SceneInfo = { path: string; renderRequest?: string };

/**
 * Set by a page that runs this module inside itself (an MCP Apps view) instead
 * of framing it: status goes to onStatus rather than to a parent window.
 */
type PreviewHost = {
  onStatus?(status: { ready: boolean; error: string | null; warnings: string[]; scene?: string }): void;
};

declare global {
  interface Window {
    __PREVIEW_INPUT__?: PreviewInput;
    __PREVIEW_HOST__?: PreviewHost;
  }
}

const params = new URLSearchParams(location.search);
const liveAR = params.get("ar") === "1";
const host = window.__PREVIEW_HOST__;
// Framed by, or running inside, the MCP Apps view.
const framed = window.parent !== window;

type Controls = { reset(): void };
let cameraControls: Controls | null = null;
let currentScene: string | undefined = window.__PREVIEW_INPUT__?.scenes?.[0]?.path;
const cameraListeners = new Set<() => void>();
// The real selector, not the render path's stub: it is composed of web-capable
// parts and ViroARScene.web feeds it anchor events. Headless renders keep the
// stub, which draws the children unanchored, because there nothing can select
// a plane and the content would never appear.
addViroExports({ ViroARPlaneSelector });

if (!liveAR) {
  setARNavigatorDefaults({
    virtualCamera: {
      onReady: (c: Controls) => {
        cameraControls = c;
        cameraListeners.forEach((l) => l());
      },
    },
  });
}

// Emscripten reports an abort only on the console, and the canvas just stops
// drawing; surface it the way runScene.ts does for the headless path.
const consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const text = args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ");
  const abort = /Aborted\((.*)\)/.exec(text);
  if (abort) markError(new Error(`The renderer aborted: ${abort[1] || "unknown reason"}`));
  else if (text.trim()) pushWarning(text.slice(0, 500));
  consoleError(...args);
};

// The view asks again whenever it may have missed an update (it mounts the
// frame before it listens, or a host drops a message).
window.addEventListener("message", (e) => {
  if (e.source === window.parent && (e.data as { type?: string })?.type === "reactviro-preview-ping") postStatus();
});

// A model that fails to load only reaches the scene's own onError, and an
// image only its <img>; neither says anything on the page. Report both.
const consoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const text = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a) ?? String(a))).join(" ");
  if (text.startsWith("[Viro")) pushWarning(text.slice(0, 500));
  consoleWarn(...args);
};
const pageFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const short = url.startsWith("data:") ? "a data: URL" : url.split("?")[0];
  try {
    const res = await pageFetch(input, init);
    if (!res.ok) pushWarning(`Failed to load ${short}: HTTP ${res.status}.`);
    return res;
  } catch (err) {
    pushWarning(`Failed to load ${short}: ${err instanceof Error ? err.message : String(err)}.`);
    throw err;
  }
};
document.addEventListener(
  "error",
  (e) => {
    const el = e.target as HTMLElement | null;
    if (el instanceof HTMLImageElement || el instanceof HTMLMediaElement) {
      pushWarning(`Failed to load ${(el.currentSrc || el.getAttribute("src") || "an image").split("?")[0]}.`);
    }
  },
  true,
);

function postStatus() {
  if (host) {
    host.onStatus?.({ ready: renderState.ready, error: renderState.error, warnings: renderState.warnings, scene: currentScene });
    return;
  }
  if (window.parent === window) return;
  window.parent.postMessage(
    {
      type: "reactviro-preview",
      ready: renderState.ready,
      error: renderState.error,
      warnings: renderState.warnings,
      scene: currentScene,
    },
    "*",
  );
}

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    markError(err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Scene({ App }: { App: React.ComponentType<any> }) {
  // A timer, not requestAnimationFrame: a browser may hold rAF back in a
  // cross-origin frame nested in a host's view.
  useEffect(() => {
    if (!App) return;
    const start = performance.now();
    const timer = setInterval(() => {
      if (renderState.ready) clearInterval(timer);
      else if (document.querySelector("canvas") && performance.now() - start > 600) {
        markReady();
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [App]);

  return createElement(Boundary, null, createElement(App));
}

const sceneLabel = (path: string) => path.split("/").pop()!.replace(/\.[cm]?[jt]sx?$/, "");

const chip: React.CSSProperties = {
  background: "rgba(10,10,14,0.72)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "#e8e8ee",
  backdropFilter: "blur(6px)",
};
const button: React.CSSProperties = {
  ...chip,
  cursor: "pointer",
  font: "inherit",
  fontWeight: 600,
  pointerEvents: "auto",
};

// An AR scene is laid out for a phone held upright; in a wide view the top and
// bottom of it fall outside the frustum. Frame it like one unless asked not to.
// Measured against #root's parent: the page's body, or the stage of a view
// that runs this module inside itself.
const PHONE_ASPECT = 9 / 19.5;
const frameBox = () => document.getElementById("root")!.parentElement!;
function applyFraming(phone: boolean) {
  const el = document.getElementById("root")!;
  el.style.width = phone ? `min(100%, ${Math.round(frameBox().clientHeight * PHONE_ASPECT)}px)` : "";
  el.style.margin = phone ? "0 auto" : "";
  el.style.boxShadow = phone ? "0 0 0 1px rgba(255,255,255,0.14)" : "";
}

// The page is a sandboxed document, where the async clipboard can be refused;
// a selected textarea is the older path that still works there.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}


type RenderRow = {
  id: string;
  scene?: string | null;
  status: string;
  progress: number | null;
  environment_name: string | null;
  error: string | null;
  output_url: string | null;
};
type Project = { id: string; name: string; environments: { id: string; name: string }[] };

const ACTIVE = new Set(["awaiting_upload", "queued", "processing"]);

function statusText(r: RenderRow): string {
  if (r.status === "processing") return r.progress != null ? `Rendering ${r.progress}%` : "Rendering";
  if (r.status === "queued") return "Queued";
  if (r.status === "awaiting_upload") return "Not started";
  if (r.status === "completed") return "Done";
  if (r.status === "failed") return "Failed";
  return r.status;
}

// Through the unpatched fetch: the panel shows its own errors, which are not the scene's.
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await pageFetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

function RenderPanel({ renderApi, renderRequest, scene, onClose }: { renderApi: string; renderRequest?: string; scene?: string; onClose(): void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [stubbed, setStubbed] = useState<string[]>([]);
  const [renders, setRenders] = useState<RenderRow[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);

  const loadRenders = () =>
    api<{ renders: RenderRow[]; remaining: number }>(`${renderApi}/renders`)
      .then((r) => {
        setRenders(r.renders);
        setRemaining(r.remaining);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    api<{ projects: Project[]; stubbed_assets: string[]; remaining: number }>(`${renderApi}/environments`)
      .then((r) => {
        setProjects(r.projects);
        setStubbed(r.stubbed_assets);
        setRemaining(r.remaining);
        const first = r.projects[0]?.environments[0];
        if (first) setChoice(`${r.projects[0]!.id}|${first.id}`);
      })
      .catch((e: Error) => setError(e.message));
    void loadRenders();
  }, []);

  const active = renders.some((r) => ACTIVE.has(r.status));
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(loadRenders, 4000);
    return () => clearInterval(timer);
  }, [active]);

  const start = async () => {
    const [project_id, environment_id] = choice.split("|");
    setBusy(true);
    setError(null);
    try {
      const started = await api<{ stubbed?: string[] }>(`${renderApi}/renders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id, environment_id, scene }),
      });
      setFallbacks(started.stubbed ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
    await loadRenders();
    setBusy(false);
  };

  return (
    <div style={{ ...chip, pointerEvents: "auto", alignSelf: "center", width: "min(520px, 100%)", maxHeight: "75%", overflow: "auto", display: "flex", flexDirection: "column", gap: 10, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 600 }}>Render {scene ? sceneLabel(scene) : "in a real space"}</div>
        <button type="button" aria-label="Close" title="Close" style={{ ...button, padding: 6, display: "flex" }} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <div style={{ opacity: 0.8, fontSize: 12 }}>
        Plays this scene over a recorded real-world environment from your team and makes a video. Billed to your team as compute time.
      </div>
      {projects === null && !error ? <div style={{ opacity: 0.7 }}>Loading environments...</div> : null}
      {projects && projects.length === 0 ? <div>Your team has no recorded environments yet.</div> : null}
      {projects && projects.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ flex: 1, minWidth: 0, font: "inherit", padding: "5px 6px", borderRadius: 6, background: "#1d1d24", color: "inherit", border: "1px solid rgba(255,255,255,0.18)" }}>
            {projects.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.environments.map((env) => (
                  <option key={env.id} value={`${p.id}|${env.id}`}>{env.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" style={{ ...button, opacity: busy || remaining <= 0 || !choice ? 0.5 : 1 }} disabled={busy || remaining <= 0 || !choice} onClick={start}>
            {busy ? "Starting..." : "Start render"}
          </button>
        </div>
      ) : null}
      {projects && projects.length > 0 ? (
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {remaining > 0 ? `${remaining} render${remaining === 1 ? "" : "s"} left for this preview.` : "No renders left for this preview. Preview the scene again for more."}
          {stubbed.length ? ` Drawn as boxes, since only their paths were sent: ${stubbed.join(", ")}.` : ""}
        </div>
      ) : null}
      {error ? <div style={{ color: "#ff9b9b" }}>{error}</div> : null}
      {fallbacks.length ? <div style={{ color: "#ffd27a", fontSize: 12 }}>Drawn as boxes in the last render: {fallbacks.join(", ")}.</div> : null}
      {renders.map((r) => (
        <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span>{r.scene && scene ? `${sceneLabel(r.scene)} · ` : ""}{r.environment_name ?? "Environment"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: r.status === "failed" ? "#ff9b9b" : r.status === "completed" ? "#9be7a7" : "#ffd27a" }}>{statusText(r)}</span>
              {r.output_url ? (
                <button type="button" style={button} onClick={() => setViewing(viewing === r.id ? null : r.id)}>
                  {viewing === r.id ? "Hide" : "View"}
                </button>
              ) : null}
            </span>
          </div>
          {r.status === "failed" && r.error ? <div style={{ fontSize: 12, color: "#ff9b9b" }}>{r.error}</div> : null}
          {r.output_url && viewing === r.id ? <video src={r.output_url} controls autoPlay playsInline muted style={{ width: "100%", borderRadius: 6, background: "#000" }} /> : null}
        </div>
      ))}
      {renderRequest && !framed ? (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, fontSize: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ opacity: 0.8 }}>For the real models, ask your coding agent to render it.</span>
          <button type="button" style={button} onClick={async () => setCopied(await copyText(renderRequest))}>
            {copied ? "Copied" : "Copy request"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Chrome({
  title,
  renderRequest,
  renderApi,
  scenes,
  index,
  onSelect,
}: {
  title?: string;
  renderRequest?: string;
  renderApi?: string;
  scenes: SceneInfo[];
  index: number;
  onSelect(i: number): void;
}) {
  const [, tick] = useState(0);
  const [showIssues, setShowIssues] = useState(false);
  const [request, setRequest] = useState<"copied" | "manual" | null>(null);
  const [panel, setPanel] = useState(false);
  const [phone, setPhone] = useState(() => frameBox().clientWidth > frameBox().clientHeight);
  useEffect(() => {
    if (!cameraControls) return;
    applyFraming(phone);
    const observer = new ResizeObserver(() => applyFraming(phone));
    observer.observe(frameBox());
    return () => observer.disconnect();
  }, [phone, cameraControls]);
  const seen = useRef("");
  useEffect(() => {
    const onCamera = () => tick((n) => n + 1);
    cameraListeners.add(onCamera);
    const timer = setInterval(() => {
      const key = `${renderState.ready}|${renderState.error}|${renderState.warnings.length}`;
      if (key !== seen.current) {
        seen.current = key;
        postStatus();
        tick((n) => n + 1);
      }
    }, 300);
    return () => {
      cameraListeners.delete(onCamera);
      clearInterval(timer);
    };
  }, []);

  const issues = renderState.warnings.length + (renderState.error ? 1 : 0);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", padding: 10, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
        {scenes.length > 1 ? (
          <select
            aria-label="Scene"
            value={index}
            onChange={(e) => onSelect(Number(e.target.value))}
            style={{ ...button, fontWeight: 600, maxWidth: "50%" }}
          >
            {scenes.map((sc, i) => (
              <option key={sc.path} value={i} title={sc.path}>{sceneLabel(sc.path)}</option>
            ))}
          </select>
        ) : <div style={chip}>{title ?? "Viro Live"}{liveAR ? " · AR" : ""}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          {/* Without renderApi the button copies a request for a coding agent, which a chat does not have. */}
          {!liveAR && renderRequest && (renderApi || !framed) ? (
            <button
              type="button"
              style={button}
              onClick={async () => {
                if (renderApi) setPanel((v) => !v);
                else if (renderRequest) setRequest((await copyText(renderRequest)) ? "copied" : "manual");
              }}
            >
              Render in a real space
            </button>
          ) : null}
          {issues > 0 ? (
            <button type="button" style={{ ...button, color: renderState.error ? "#ff9b9b" : "#ffd27a" }} onClick={() => setShowIssues((v) => !v)}>
              {renderState.error ? "Error" : `${issues} warning${issues === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      </div>
      {panel && renderApi && renderRequest ? (
        <RenderPanel
          renderApi={renderApi}
          renderRequest={renderRequest}
          scene={scenes.length > 1 ? scenes[index]?.path : undefined}
          onClose={() => setPanel(false)}
        />
      ) : null}
      {request && renderRequest ? (
        <div style={{ ...chip, pointerEvents: "auto", alignSelf: "center", maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>
            {request === "copied" ? "Copied. Paste it to your coding agent." : "Copy this and paste it to your coding agent."}
          </div>
          <div style={{ userSelect: "text", fontFamily: "ui-monospace, monospace", fontSize: 12, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: 8 }}>
            {renderRequest}
          </div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Your agent renders the scene over a recorded real-world space, and checks with you before it starts.
          </div>
          <button type="button" style={{ ...button, alignSelf: "flex-end" }} onClick={() => setRequest(null)}>
            Close
          </button>
        </div>
      ) : null}
      {showIssues || renderState.error ? (
        <div style={{ ...chip, pointerEvents: "auto", alignSelf: "center", maxWidth: 640, maxHeight: "45%", overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
          {renderState.error ? <div style={{ color: "#ff9b9b", marginBottom: 8 }}>{renderState.error}</div> : null}
          {renderState.warnings.map((w) => (
            <div key={w} style={{ color: "#ffd27a" }}>{w}</div>
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "space-between" }}>
        {cameraControls ? (
          <div style={{ ...chip, opacity: 0.85 }}>
            Right-drag: look around · Shift-drag: pan · Scroll: zoom · Click: tap
          </div>
        ) : <span />}
        <div style={{ display: "flex", gap: 8 }}>
          {cameraControls ? (
            <>
              <button type="button" style={button} onClick={() => setPhone((v) => !v)}>
                {phone ? "Fill width" : "Phone frame"}
              </button>
              <button type="button" style={button} onClick={() => cameraControls?.reset()}>
                Reset view
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Preview({ input }: { input: PreviewInput }) {
  // With the version it was compiled from, which keys the mounted scene.
  const [compiled, setCompiled] = useState<{ apps: React.ComponentType<any>[]; version: number } | null>(null);
  const [index, setIndex] = useState(0);
  // Unresolved imports are reported while the bundle compiles, so they hold for every scene.
  const compileWarnings = useRef<string[]>([]);
  const shown = useRef<PreviewInput | null>(null);
  useEffect(() => {
    // An update replaces the running scene, so its status starts over; the scene being looked at stays selected.
    if (shown.current) {
      renderState.ready = false;
      renderState.error = null;
      renderState.warnings.length = 0;
      cameraControls = null;
    }
    shown.current = input;
    const at = Math.max(0, (input.scenes ?? []).findIndex((sc) => sc.path === currentScene));
    currentScene = input.scenes?.[at]?.path;
    setIndex(at);
    try {
      setCompiled({ apps: compileGeneratedScenes(input.code, input.assetOverrides), version: input.version ?? 0 });
      compileWarnings.current = [...renderState.warnings];
    } catch (err) {
      setCompiled(null);
      markError(err);
    }
  }, [input]);
  const scenes = input.scenes ?? [];
  // The navigator is remounted for the new scene, so its status starts over.
  const select = (i: number) => {
    renderState.ready = false;
    renderState.error = null;
    renderState.warnings.splice(0, renderState.warnings.length, ...compileWarnings.current);
    cameraControls = null;
    currentScene = scenes[i]?.path;
    setIndex(i);
  };
  const App = compiled?.apps[index];
  return (
    <>
      {/* Keyed by the update as well: a boundary that caught the last version's crash must not hold the new one. */}
      {App ? <Scene key={`${compiled!.version}:${index}`} App={App} /> : null}
      <Chrome
        title={input.title}
        renderRequest={scenes.length ? scenes[index]?.renderRequest : input.renderRequest}
        renderApi={input.renderApi}
        scenes={scenes}
        index={index}
        onSelect={select}
      />
    </>
  );
}

/**
 * Asks the server for a version after the one shown. The server holds each
 * request until there is one, answering 204 when there is none in time.
 */
function followUpdates(first: PreviewInput, onUpdate: (input: PreviewInput) => void): () => void {
  if (!first.updatesUrl) return () => {};
  const stop = new AbortController();
  let version = first.version ?? 1;
  void (async () => {
    while (!stop.signal.aborted) {
      const asked = performance.now();
      let again = 1000;
      try {
        // pageFetch: a request the server lets time out is not a failed load to warn about.
        const res = await pageFetch(`${first.updatesUrl}${version}`, { signal: stop.signal, cache: "no-store" });
        if (res.status === 404) return;
        if (res.status === 200) {
          const next = ((await res.json()) as { input?: PreviewInput }).input;
          if (next?.code) {
            version = next.version ?? version + 1;
            onUpdate(next);
          }
        } else if (res.status !== 204) again = 5000;
      } catch {
        again = 5000;
      }
      // Something in between that answers at once instead of holding the request would otherwise spin.
      const wait = again - (performance.now() - asked);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  })();
  return () => stop.abort();
}

function Live({ first }: { first: PreviewInput }) {
  const [input, setInput] = useState(first);
  useEffect(() => followUpdates(first, setInput), [first]);
  return <Preview input={input} />;
}

const input = window.__PREVIEW_INPUT__;
const root = createRoot(document.getElementById("root")!);
if (!input) {
  markError(new Error("No scene was given to this page."));
  root.render(createElement(Chrome, { scenes: [], index: 0, onSelect: () => {} }));
} else {
  root.render(createElement(Live, { first: input }));
}
