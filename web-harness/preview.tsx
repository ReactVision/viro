/**
 * The page a developer opens to look at their own scene: the same compile and
 * runtime as render.tsx, kept running and interactive instead of screenshotted.
 *
 * Input arrives as `window.__PREVIEW_INPUT__`, set by an inline script the
 * serving page puts ahead of this module. A scene is shown from a virtual
 * camera the viewer moves (see viroVirtualCamera.ts), an AR scene unless the URL
 * has `?ar=1`, which starts real web AR on a phone instead.
 *
 * The status is posted to the parent window as `{ type: "reactviro-preview" }`
 * messages, so a host that frames this page (an MCP Apps view) can report
 * compile and runtime errors back to the model.
 */
import * as React from "react";
import type { ArPlaneAnchor, ArPlaybackSource, ViroArSession } from "@reactvision/viro-web-renderer";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { renderState, pushWarning, markReady, markError } from "./renderState";
import { addViroExports, compileGeneratedScenes, setModelOverrides } from "./sceneModule";
import { ViroARPlaneSelector } from "../components/AR/ViroARPlaneSelector";
import { ViroARScene } from "../components/AR/ViroARScene";
import { ViroImage } from "../components/ViroImage";
import { Viro3DObject } from "../components/Viro3DObject";
import { ViroBox } from "../components/ViroBox";
import { quatToEuler } from "../components/Studio/colocation/frameMath";
import { rotateByQuaternion } from "../components/Web/viroMath";
import { ViroScene } from "../components/ViroScene";
import { contentFraming, InspectorProbe, InspectPanel, noteModelResponse, watchGpu, type ModelBudget } from "./inspector";
import { qrModules } from "./qr";
import { playSession, recordSession, type SessionTrack } from "./sessionReplay";
import { PLACEHOLDER_MODEL_URL } from "./placeholderAssets";
import { set3DNavigatorDefaults, setARNavigatorDefaults } from "./viroWebComponents";
import { ViroTelemetry } from "../components/Utilities/ViroUsagePing";
import { VIRO_VERSION } from "../components/Utilities/ViroVersion";

type PreviewInput = {
  code: string;
  assetOverrides?: Record<string, string>;
  title?: string;
  /** Text the page offers to copy for the developer's coding agent. */
  renderRequest?: string;
  /** Base URL of the server's routes for starting and listing renders of this scene. */
  /** "cjs" when `code` is already compiled to a CommonJS script, which the page then runs as it is. */
  codeFormat?: "cjs";
  /** Names `code`. Sent back with a request for updates, so one that did not change the code can leave it out. */
  codeTag?: string;
  renderApi?: string;
  /** This preview's link for camera AR on a phone. */
  arUrl?: string;
  /** The scenes the module exports, in order, when there is more than one; each one's render request replaces `renderRequest`. */
  scenes?: SceneInfo[];
  /** Which update of the preview this is, and where a newer one is asked for: the page appends the version it shows. */
  version?: number;
  updatesUrl?: string;
  /** Where the page sends feedback; absent where the server does not record it. */
  feedbackUrl?: string;
  /** Per-platform single-model budgets the inspector compares models against. */
  budgets?: ModelBudget[];
  /** Root-relative paths of the local assets drawn as stand-ins. */
  placeholders?: string[];
};

type SceneInfo = { path: string; renderRequest?: string };

/**
 * Set by a page that runs this module inside itself (an MCP Apps view) instead
 * of framing it: status goes to onStatus rather than to a parent window.
 */
type PreviewHost = {
  onStatus?(status: { ready: boolean; error: string | null; warnings: string[]; scene?: string }): void;
  /** The node selected in the inspector, as a sentence for the assistant, or null. */
  onSelect?(text: string | null): void;
  /** Opens a link outside the view, which the view's own sandbox may not allow. */
  openLink?(url: string): void;
  /** Stores a file as the local asset at `path`; the preview then updates to show it. Rejects with the reason. */
  uploadAsset?(path: string, file: Blob): Promise<void>;
};

type Vec3 = [number, number, number];
/** A camera pose for a capture: the starting one, a side of the scene's content, or a position and the point it looks at. */
type ShotView = "start" | "front" | "back" | "left" | "right" | "top" | { position: Vec3; look_at: Vec3 };

declare global {
  interface Window {
    __PREVIEW_INPUT__?: PreviewInput;
    __PREVIEW_HOST__?: PreviewHost;
    /** On a capture page: moves the camera and returns where it now is, or null when the scene has no camera to move. */
    __previewShotView?(view: ShotView): { position: Vec3; look_at: Vec3 } | null;
    /**
     * On a capture page: moves the camera to `to` over `ms`, looking at `look_at`, or keeping its heading
     * when that is null. Resolves where it ends, or null when the scene has no camera to move.
     */
    __previewShotWalk?(to: Vec3, look_at: Vec3 | null, ms: number): Promise<{ position: Vec3; look_at: Vec3 } | null>;
    /** On a capture page: where the camera is, or null when the scene has no camera the preview moves. */
    __previewShotPose?(): { position: Vec3; look_at: Vec3 } | null;
  }
}

const params = new URLSearchParams(location.search);
const liveAR = params.get("ar") === "1";
// A capture for the agent: the scene alone, from the starting camera, not following updates.
const shot = params.get("shot") === "1";
const host = window.__PREVIEW_HOST__;
// Framed by, or running inside, the MCP Apps view.
const framed = window.parent !== window;
const inspectable = !liveAR && !shot;
if (inspectable) watchGpu();

type Controls = {
  reset(): void;
  lookFrom(position: Vec3, target: Vec3): void;
  pose(): { position: Vec3; target: Vec3 };
  setFieldOfView(degrees: number | null): void;
};
let cameraControls: Controls | null = null;
// The framed device's field of view, put back on the camera an update remounts.
let framedFieldOfView: number | null = null;
// Where the developer had moved the camera, put back on the scene an update remounts.
let keptPose: { position: Vec3; target: Vec3 } | null = null;
let currentScene: string | undefined = (
  window.__PREVIEW_INPUT__?.scenes?.find((sc) => sc.path === params.get("scene")) ?? window.__PREVIEW_INPUT__?.scenes?.[0]
)?.path;
const cameraListeners = new Set<() => void>();
// The real selector, not the render path's stub: it is composed of web-capable
// parts and ViroARScene.web feeds it anchor events. Headless renders keep the
// stub, which draws the children unanchored, because there nothing can select
// a plane and the content would never appear.
// Selectors showing a plane to click and none selected: they draw no children until then.
const waitingSelectors = new Set<ViroARPlaneSelector>();
class PreviewPlaneSelector extends ViroARPlaneSelector {
  componentDidMount() {
    this.componentDidUpdate();
  }
  componentDidUpdate() {
    const { selectedPlaneId, planes } = this.state;
    const waiting = selectedPlaneId === null && planes.size > 0 && this.props.children != null && !this.props.disableClickSelection;
    if (waiting) waitingSelectors.add(this);
    else waitingSelectors.delete(this);
  }
  componentWillUnmount() {
    waitingSelectors.delete(this);
  }
}
addViroExports({ ViroARPlaneSelector: PreviewPlaneSelector });

// Unit vectors from the content's centre to the camera.
const VIEW_FROM: Record<string, Vec3> = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0] };
if (shot) {
  window.__previewShotView = (view) => {
    if (!cameraControls) return null;
    if (view === "start") {
      cameraControls.reset();
      return { position: [0, 0, 0], look_at: [0, 0, -1] };
    }
    let position: Vec3;
    let look_at: Vec3;
    if (typeof view === "string") {
      const from = VIEW_FROM[view];
      const framing = contentFraming();
      if (!from || !framing) return null;
      look_at = framing.center;
      position = [look_at[0] + from[0] * framing.distance, look_at[1] + from[1] * framing.distance, look_at[2] + from[2] * framing.distance];
    } else {
      ({ position, look_at } = view);
    }
    cameraControls.lookFrom(position, look_at);
    return { position, look_at };
  };
  window.__previewShotPose = () => {
    const pose = cameraControls?.pose();
    return pose ? { position: pose.position, look_at: pose.target } : null;
  };
  window.__previewShotWalk = (to, lookAt, ms) => {
    const controls = cameraControls;
    if (!controls) return Promise.resolve(null);
    const from = controls.pose();
    const look_at: Vec3 = lookAt ?? [to[0] + from.target[0] - from.position[0], to[1] + from.target[1] - from.position[1], to[2] + from.target[2] - from.position[2]];
    const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const start = performance.now();
    // Timers, not requestAnimationFrame, as sessionReplay.ts explains; in steps so the scene sees the camera on its way.
    return new Promise((done) => {
      const step = () => {
        const f = ms > 0 ? Math.min(1, (performance.now() - start) / ms) : 1;
        controls.lookFrom(lerp(from.position, to, f), lerp(from.target, look_at, f));
        if (f < 1) return void setTimeout(step, 16);
        done({ position: to, look_at });
      };
      step();
    });
  };
}

// The virtual camera's floor, drawn as a grid so an AR scene has a ground to read depth against.
const FLOOR_Y = -1;
let gridOn = true;
function toggleGrid() {
  gridOn = !gridOn;
  arSceneListeners.forEach((l) => l());
}

// Read once per gesture: finding it walks the whole scene, and a wheel turn asks on every event.
let orbit: { at: number; center: Vec3 | null } = { at: -Infinity, center: null };
const orbitCenter = () => {
  const now = performance.now();
  if (now - orbit.at > 250) orbit = { at: now, center: contentFraming()?.center ?? null };
  else orbit.at = now;
  return orbit.center;
};

// Points the camera at the content, or at the node selected in Inspect, from the side it is looked at now.
function frameContent() {
  const framing = contentFraming();
  if (!cameraControls || !framing) return;
  const { position, target } = cameraControls.pose();
  const back: Vec3 = [position[0] - target[0], position[1] - target[1], position[2] - target[2]];
  const length = Math.hypot(...back);
  const from: Vec3 = length ? [back[0] / length, back[1] / length, back[2] / length] : [0, 0, 1];
  const c = framing.center;
  cameraControls.lookFrom([c[0] + from[0] * framing.distance, c[1] + from[1] * framing.distance, c[2] + from[2] * framing.distance], c);
}

type ControlsSection = { title: string; note?: string; rows: [string, string][] };
function controlSections(): ControlsSection[] {
  const placing: [string, string] = [touch ? "Tap a highlighted surface" : "Click a highlighted surface", "Place the scene's content there (AR scenes)"];
  if (touch) {
    return [
      { title: "Look around", rows: [["Two-finger drag", "Orbit around the point ahead"], ["Pinch", "Zoom in and out"]] },
      { title: "Scene", rows: [["Tap", "Tap the content"], ["Drag", "Drag the content"], placing] },
      RECORD_SECTION,
    ];
  }
  const shortcuts: [string, string][] = [
    ["F", "Frame the content, or the node selected in Inspect"],
    ["R", "Reset the view"],
  ];
  if (arSceneListeners.size) shortcuts.push(["G", "Show or hide the floor grid"]);
  if (inspectable) shortcuts.push(["I", "Open or close Inspect"]);
  shortcuts.push(["?", "Show or hide this list"]);
  return [
    {
      title: "Look around",
      rows: [
        ["Right-drag", "Turn where you stand"],
        ["Alt + right-drag", "Orbit the content, or the node selected in Inspect"],
        ["Middle-drag or Shift + drag", "Pan"],
        ["Scroll or pinch", "Move toward or away from the content"],
      ],
    },
    {
      title: "Walk",
      note: "Click the view first so it receives the keys.",
      rows: [
        ["W A S D or arrow keys", "Forward, left, back, right"],
        ["Q and E", "Down and up"],
        ["Shift", "Move faster"],
      ],
    },
    { title: "Scene", rows: [["Click", "Tap the content, as a finger would"], ["Click and drag", "Drag the content"], placing] },
    RECORD_SECTION,
    { title: "Shortcuts", rows: shortcuts },
  ];
}
const RECORD_SECTION: ControlsSection = {
  title: "Record and replay",
  note: "Record once, then replay after each code change to check the same steps. A replay repeats your input, not the scene's state, so animations, physics and timers can run differently.",
  rows: [
    ["Record button", "Start the scene again and record the camera and your input in the scene, up to 5 minutes"],
    ["Replay button", "Start the scene again and repeat the recording; any click or key stops it"],
  ],
};
// Mounted AR scenes, which redraw when the grid or the surroundings change.
const arSceneListeners = new Set<() => void>();
let gridUrl: string | null = null;
function floorGridUrl(): string {
  if (gridUrl) return gridUrl;
  const size = 2048, cells = 40;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  for (let i = 0; i <= cells; i++) {
    const at = Math.round((i * size) / cells);
    // Every other line is a whole metre.
    g.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.16)";
    g.fillRect(at - 1, 0, 2, size);
    g.fillRect(0, at - 1, size, 2);
  }
  const fade = g.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size / 2);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  return (gridUrl = canvas.toDataURL("image/png"));
}

// Resolved against this module, not the document: inside a host's view the document is the view's.
const ROOMS_DIR = "../rooms/";
const roomFileUrl = (file: string) => new URL(ROOMS_DIR + file, import.meta.url).href;
const roomFiles = (name: string) => ({ glb: roomFileUrl(`${name}.glb`), planes: roomFileUrl(`${name}.planes.json`) });

// What the AR scene stands in: the planes it detects and hit-tests, and the room drawn around them.
// Empty is the virtual camera's own floor plane. A room is a GLB with the planes listed in its planes
// file. A built-in one is in vendor/rooms (served beside this harness), with its origin on the floor
// where the camera starts and the floor at `floorY`. A scan is a captured mesh of a real place, listed by
// the server at `renderApi`, with its origin where its recording started, which is where the camera
// starts; its planes file gives `floorY`. A recording is a StudioGo recording played as the camera
// feed, listed by the same server, with its routes at `recording`.
type Room = { label: string; model?: { glb: string; planes: string }; floorY?: number; scan?: boolean; recording?: string };
const ROOMS: Record<string, Room> = {
  floor: { label: "Empty" },
  living: { label: "Living room", model: roomFiles("living-room"), floorY: -1.5 },
  office: { label: "Office", model: roomFiles("office"), floorY: -1.5 },
  workshop: { label: "Workshop", model: roomFiles("workshop"), floorY: -1.5 },
};
type Surroundings = keyof typeof ROOMS;
let surroundings: Surroundings = "floor";

type ScanRow = { id: string; kind: "scan" | "merge"; location_name: string; created_at: string };
let scansRequested = false;
function loadScans(renderApi: string, onLoaded: () => void): void {
  if (scansRequested) return;
  scansRequested = true;
  // Optional: without the route, or once the sign-in has expired, the picker just has no scans.
  pageFetch(`${renderApi}/scans`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { scans: ScanRow[] } | null) => {
      for (const s of body?.scans ?? []) {
        const date = new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        ROOMS[`scan:${s.id}`] = {
          label: `${s.location_name}${s.kind === "merge" ? " (merged)" : ""}, ${date}`,
          model: { glb: `${renderApi}/scans/${s.id}/mesh.glb`, planes: `${renderApi}/scans/${s.id}/planes.json` },
          scan: true,
        };
      }
      onLoaded();
    })
    .catch(() => {});
}

let recordingsRequested = false;
function loadRecordings(renderApi: string, onLoaded: () => void): void {
  if (recordingsRequested) return;
  recordingsRequested = true;
  pageFetch(`${renderApi}/environments`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { projects: { environments: { id: string; name: string }[] }[] } | null) => {
      for (const e of (body?.projects ?? []).flatMap((p) => p.environments)) {
        ROOMS[`recording:${e.id}`] = { label: e.name, recording: `${renderApi}/recordings/${e.id}` };
      }
      onLoaded();
    })
    .catch(() => {});
}

// The recording the AR camera plays, once loaded: the camera follows its recorded poses, so the
// virtual camera is off. `size` is the video's shape, which the view is framed to.
type Feed = { source: ArPlaybackSource; size: { width: number; height: number } };
let feed: Feed | null = null;
// Loading, or why the chosen recording cannot play.
let feedNote: string | null = null;
let feedPlaying = false;
const loadedFeeds = new Map<string, Feed>();
async function loadFeed(base: string): Promise<Feed> {
  const kept = loadedFeeds.get(base);
  if (kept) return kept;
  const get = async (file: string) => {
    const r = await pageFetch(`${base}/${file}`);
    if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? `The recording did not load (HTTP ${r.status}).`);
    return r;
  };
  // A blob: URL, since the page reads the video's frames back and its opaque origin makes the route's URL cross-origin.
  const [track, video] = await Promise.all([get("track.json").then((r) => r.json()), get("video.mp4").then((r) => r.blob())]);
  const { size, intrinsics, intrinsicsSize, ...rest } = track;
  const loaded = { source: { ...rest, intrinsics: intrinsics ?? undefined, intrinsicsSize: intrinsicsSize ?? undefined, videoUrl: URL.createObjectURL(video) }, size };
  loadedFeeds.set(base, loaded);
  return loaded;
}

let stopFeed = () => {};
// Plays the recording on a loop at its own speed, skipping frames when seeking falls behind. Timers,
// not requestAnimationFrame, as sessionReplay.ts explains; one frame at a time, since each waits for its seek.
function playFeed(session: ViroArSession) {
  stopFeed();
  const frames = feed?.source.frames ?? [];
  if (!frames.length) return;
  const last = frames[frames.length - 1]!.t;
  const loop = last + (frames.length > 1 ? last / (frames.length - 1) : 0.1);
  const start = performance.now();
  let stopped = false;
  let shown = -1;
  const step = async () => {
    if (stopped) return;
    const t = ((performance.now() - start) / 1000) % loop;
    let i = shown >= 0 && frames[shown]!.t <= t ? shown : 0;
    while (i + 1 < frames.length && frames[i + 1]!.t <= t) i++;
    if (i !== shown) {
      // False once the session has stopped.
      if (!(await session.renderPlaybackFrame(i).catch(() => false))) return;
      shown = i;
    }
    setTimeout(step, 4);
  };
  void step();
  stopFeed = () => void (stopped = true);
  feedPlaying = true;
  cameraListeners.forEach((l) => l());
}

// A room file's plane: `polygon` is in the plane's own X and Z, and its local Y is the normal.
type RoomFilePlane = {
  type: "horizontal" | "vertical";
  position: { x: number; y: number; z: number };
  quaternion: [number, number, number, number];
  polygon: { x: number; y: number }[];
  label?: string;
};
function roomFilePlanes(planes: RoomFilePlane[], origin: Vec3): ArPlaneAnchor[] {
  return planes.map((p, i): ArPlaneAnchor => {
    const xs = p.polygon.map((v) => v.x), zs = p.polygon.map((v) => v.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const mid = rotateByQuaternion(p.quaternion, [(x0 + x1) / 2, 0, (z0 + z1) / 2]);
    const normal = rotateByQuaternion(p.quaternion, [0, 1, 0]);
    const at = p.position;
    return {
      id: `viro-virtual-${p.label ?? (p.type === "vertical" ? "wall" : "surface")}-${i}`,
      center: [origin[0] + at.x + mid[0], origin[1] + at.y + mid[1], origin[2] + at.z + mid[2]],
      normal,
      rotation: quatToEuler(p.quaternion),
      width: x1 - x0,
      height: z1 - z0,
      alignment: p.type === "vertical" ? "Vertical" : "HorizontalUpward",
      confidence: 1,
      polygon: p.polygon.map((v): [number, number] => [v.x - (x0 + x1) / 2, v.y - (z0 + z1) / 2]),
    };
  });
}
const roomOrigin = (room: Room): Vec3 => (room.scan ? [0, 0, 0] : [0, room.floorY ?? FLOOR_Y, 0]);
// A model room's planes, once its list has loaded.
const modelRoomPlanes = new Map<Surroundings, ArPlaneAnchor[]>();
function surroundingsPlanes(key: Surroundings): ArPlaneAnchor[] | undefined {
  return ROOMS[key]!.model ? modelRoomPlanes.get(key) ?? [] : undefined;
}
function loadRoomPlanes(key: Surroundings): void {
  const room = ROOMS[key]!;
  if (!room.model || modelRoomPlanes.has(key)) return;
  fetch(room.model.planes)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((body: { planes: RoomFilePlane[]; floorY?: number }) => {
      if (body.floorY !== undefined) room.floorY = body.floorY;
      modelRoomPlanes.set(key, roomFilePlanes(body.planes, roomOrigin(room)));
      if (surroundings !== key) return;
      applyARDefaults();
      arSceneListeners.forEach((l) => l());
    })
    .catch((e) => pushWarning(`The ${room.label} surfaces did not load: ${e instanceof Error ? e.message : String(e)}`));
}

function surroundingsShapes(key: Surroundings): React.ReactNode[] {
  const room = ROOMS[key]!;
  if (!room.model) return [];
  // Drawn with depth, so it hides content behind its furniture, which a phone without depth sensing does not.
  // Taps pass through it: its furniture's bounding boxes cover the planes and the content placed on them.
  return [createElement(Viro3DObject, { key: `viro-preview-surroundings-${key}`, source: { uri: room.model.glb }, type: "GLB", position: roomOrigin(room), ignoreEventHandling: true })];
}

function PreviewARScene(props: any) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const onChange = () => redraw((n) => n + 1);
    arSceneListeners.add(onChange);
    return () => void arSceneListeners.delete(onChange);
  }, []);
  return createElement(
    ViroARScene,
    props,
    ...React.Children.toArray(props.children),
    createElement(InspectorProbe, { key: "viro-preview-inspector" }),
    ...surroundingsShapes(surroundings),
    gridOn && !feed
      ? createElement(ViroImage, {
          key: "viro-preview-grid",
          source: { uri: floorGridUrl() },
          // Just under the floor, so content resting on it does not flicker against the lines.
          position: [0, (ROOMS[surroundings]!.floorY ?? FLOOR_Y) - 0.002, 0],
          rotation: [-90, 0, 0],
          width: 20,
          height: 20,
        })
      : null,
  );
}

function PreviewScene(props: any) {
  return createElement(ViroScene, props, ...React.Children.toArray(props.children), createElement(InspectorProbe, { key: "viro-preview-inspector" }));
}

let applyARDefaults = () => {};
if (!liveAR) {
  addViroExports({ ViroARScene: PreviewARScene, ViroScene: PreviewScene });
  const onCameraReady = (c: Controls) => {
    if (keptPose) c.lookFrom(keptPose.position, keptPose.target);
    keptPose = null;
    if (framedFieldOfView) c.setFieldOfView(framedFieldOfView);
    cameraControls = c;
    cameraListeners.forEach((l) => l());
  };
  applyARDefaults = () =>
    setARNavigatorDefaults(
      feed
        ? { arOptions: { playback: feed.source, showCameraBackground: true }, onSessionReady: playFeed }
        : { virtualCamera: { floorY: FLOOR_Y, planes: surroundingsPlanes(surroundings), onReady: onCameraReady, orbitCenter } },
    );
  applyARDefaults();
  set3DNavigatorDefaults({ virtualCamera: { onReady: onCameraReady, orbitCenter } });
}

function setSurroundings(key: Surroundings) {
  surroundings = key;
  loadRoomPlanes(key);
  applyARDefaults();
  arSceneListeners.forEach((l) => l());
}

// Into or out of a recording the AR session itself changes, so `restart` starts the scene again, once:
// a recording keeps playing until the next one has loaded.
function chooseSurroundings(key: Surroundings, restart: () => void, changed: () => void) {
  const leaveFeed = () => {
    const wasFeed = feed !== null;
    stopFeed();
    feed = null;
    feedPlaying = false;
    applyARDefaults();
    if (wasFeed) restart();
  };
  const base = ROOMS[key]!.recording;
  feedNote = base ? "Loading the recording..." : null;
  setSurroundings(key);
  if (!base) return leaveFeed();
  loadFeed(base).then(
    (loaded) => {
      if (surroundings !== key) return;
      feed = loaded;
      feedNote = null;
      applyARDefaults();
      restart();
      changed();
    },
    (e: unknown) => {
      if (surroundings !== key) return;
      feedNote = e instanceof Error ? e.message : String(e);
      leaveFeed();
      changed();
    },
  );
}

// The last recording, kept across updates so a change can be replayed against it.
type Recording = SessionTrack & { scene?: string; device: string; surroundings: Surroundings; grid: boolean };
let recording: Recording | null = null;
// Ends the recording or replay in progress; an update or a scene switch calls it.
let endSession: (() => void) | null = null;
const MAX_RECORDING_MS = 5 * 60 * 1000;
const sceneCanvas = () => document.querySelector<HTMLCanvasElement>("#root canvas");
// Calls `then` once a restarted scene is drawn and its models are in, or `failed` if it errors first; returns a cancel.
function whenSceneReady(then: () => void, failed: () => void): () => void {
  const timer = setInterval(() => {
    if (renderState.error) {
      clearInterval(timer);
      return failed();
    }
    const d = downloadProgress();
    if (!cameraControls || !renderState.ready || renderState.loading.length || (d && d.count > d.done)) return;
    clearInterval(timer);
    then();
  }, 100);
  return () => clearInterval(timer);
}
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms / 1000) % 60)).padStart(2, "0")}`;

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
// Never throws: a circular object or a BigInt must not break the scene that warned.
const warnText = (a: unknown): string => {
  if (typeof a === "string") return a;
  try {
    const json = JSON.stringify(a);
    if (json !== undefined) return json;
  } catch {}
  try {
    return String(a);
  } catch {
    return "[object]";
  }
};
console.warn = (...args: unknown[]) => {
  const text = args.map(warnText).join(" ");
  if (text.startsWith("[Viro")) pushWarning(text.slice(0, 500));
  consoleWarn(...args);
};
// Model downloads in flight, for the loading chip: bytes read so far and the size the server gave.
const modelDownloads = new Map<object, { read: number; size: number }>();
// Downloads waiting to try again, by model name.
const modelRetries = new Map<object, string>();
// What finished in this round of loading, so the chip's count and bar do not go backwards as models finish.
const round = { count: 0, read: 0, size: 0, sized: true, idleSince: 0 };
const MODEL_RE = /\.(glb|gltf|vrx|obj|fbx)$/i;
const standInHref = new URL(PLACEHOLDER_MODEL_URL, document.baseURI).href;
const fileName = (url: string) => url.split(/[?#]/)[0]!.split("/").pop()!;

function trackDownload(res: Response): Response {
  // A round ends once nothing has downloaded for a moment, not between one model and the next.
  if (!modelDownloads.size && !modelRetries.size && performance.now() - round.idleSince > 1500) {
    Object.assign(round, { count: 0, read: 0, size: 0, sized: true });
  }
  const entry = { read: 0, size: Number(res.headers.get("content-length")) || 0 };
  const key = {};
  modelDownloads.set(key, entry);
  const finish = (ok: boolean) => {
    if (!modelDownloads.delete(key)) return;
    if (ok) {
      round.count++;
      round.read += entry.read;
      // A compressed response's length is less than what is read.
      round.size += Math.max(entry.size, entry.read);
      round.sized &&= entry.size > 0;
    }
    if (!modelDownloads.size) round.idleSince = performance.now();
  };
  const reader = res.body!.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish(true);
          c.close();
        } else {
          entry.read += value.byteLength;
          c.enqueue(value);
        }
      } catch (err) {
        finish(false);
        c.error(err);
      }
    },
    cancel(reason) {
      finish(false);
      return reader.cancel(reason);
    },
  });
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

function downloadProgress(): { count: number; done: number; read: number; size: number; retrying: string[] } | null {
  if (!modelDownloads.size && !modelRetries.size) return null;
  let { read, size, sized } = round;
  for (const d of modelDownloads.values()) {
    read += d.read;
    size += Math.max(d.size, d.read);
    sized &&= d.size > 0;
  }
  return {
    count: round.count + modelDownloads.size,
    done: round.count,
    read,
    // A total only when every download gave one.
    size: sized ? size : 0,
    retrying: [...new Set(modelRetries.values())],
  };
}

// Since when the scene has had a model loading, for the chip's "Preparing" line.
let loadingSince = 0;

// The total grows as files arrive one at a time, so a bar against it would go backwards: this one only shows activity.
function ActivityBar() {
  return (
    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
      <div
        ref={(el) => {
          if (el && !el.getAnimations().length) {
            el.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(250%)" }], { duration: 1200, iterations: Infinity, easing: "ease-in-out" });
          }
        }}
        style={{ width: "40%", height: "100%", borderRadius: 2, background: "#e8e8ee" }}
      />
    </div>
  );
}

const megabytes = (n: number) => `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`;

// A preview is not an app install, so it sends no register-device ping, here
// or on a phone that opens the page outside the host's view.
ViroTelemetry.setEnabled(false);

const pageFetch = window.fetch.bind(window);

type ModelBytes = { res: Response; body: ArrayBuffer | null };
// One download per model URL: the scene runs again after every update, and a
// sandboxed page keeps little or nothing in the browser's cache, so each run
// would fetch every model again. The server gives a replaced upload a new URL,
// so one URL is always one file. Finished ones are kept while the preview uses them.
const modelFetches = new Map<string, Promise<ModelBytes>>();
const keptModels = new Map<string, ModelBytes>();
let previewAssets = new Set<string>();
const absolute = (url: string) => {
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return url;
  }
};

/** The preview's own assets, and the room shown around the scene, which every remount of the scene asks for again. */
const keeps = (href: string) => previewAssets.has(href) || href === absolute(ROOMS[surroundings]?.model?.glb ?? "");

/** Keeps the finished downloads of these assets and drops the rest. */
function keepModelsOf(assetOverrides: Record<string, string> | undefined) {
  previewAssets = new Set(Object.values(assetOverrides ?? {}).map(absolute));
  for (const href of keptModels.keys()) if (!keeps(href)) keptModels.delete(href);
}

// A gateway error or a dropped connection (a tunnel or proxy losing the request) is tried again; a refusal is not.
const RETRY_WAITS_MS = [2000, 5000];
async function downloadModel(input: RequestInfo | URL, name: string): Promise<ModelBytes> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === RETRY_WAITS_MS.length;
    try {
      const res = await pageFetch(input);
      if (res.status < 500 || last) return { res, body: res.ok && res.body ? await (shot ? res : trackDownload(res)).arrayBuffer() : null };
    } catch (err) {
      if (last) throw err;
    }
    const key = {};
    modelRetries.set(key, name);
    await new Promise((r) => setTimeout(r, RETRY_WAITS_MS[attempt]));
    modelRetries.delete(key);
    // The wait is part of this round.
    round.idleSince = performance.now();
  }
}

async function fetchModel(href: string, input: RequestInfo | URL): Promise<Response> {
  let got = keptModels.get(href);
  if (!got) {
    let shared = modelFetches.get(href);
    if (!shared) {
      shared = downloadModel(input, fileName(href));
      modelFetches.set(href, shared);
      shared.then(
        (done) => {
          modelFetches.delete(href);
          if (!done.body || !keeps(href)) return;
          // One room at a time: a scan's mesh is tens of megabytes.
          if (!previewAssets.has(href)) for (const kept of keptModels.keys()) if (!previewAssets.has(kept)) keptModels.delete(kept);
          keptModels.set(href, done);
        },
        () => modelFetches.delete(href),
      );
    }
    got = await shared;
  }
  return new Response(got.body, { status: got.res.status, statusText: got.res.statusText, headers: got.res.headers });
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const short = url.startsWith("data:") ? "a data: URL" : url.split("?")[0];
  try {
    const href = new URL(url, document.baseURI).href;
    const model = !init && !(input instanceof Request) && MODEL_RE.test(url.split(/[?#]/)[0]!) && href !== standInHref;
    const res = model ? await fetchModel(href, input) : await pageFetch(input, init);
    if (!res.ok) pushWarning(`Failed to load ${short}: HTTP ${res.status}.`);
    else if (res.ok && inspectable) noteModelResponse(url, res);
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
  whiteSpace: "nowrap",
};
const roundButton: React.CSSProperties = { ...button, width: 34, height: 34, padding: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
const settingStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, opacity: 0.9 };
const oneLine: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

// A native select draws its arrow against the border and is as wide as its longest option;
// this draws the arrow inside the padding and, where fieldSizing is supported, fits the selected one.
// With `flex` in its style it fills its row instead.
function Picker({ style, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { flex, maxWidth, ...own } = style ?? {};
  const fills = flex !== undefined;
  return (
    <span style={{ position: "relative", display: "inline-flex", minWidth: 0, flex, maxWidth }}>
      <select
        {...rest}
        style={{ ...button, appearance: "none", WebkitAppearance: "none", fieldSizing: fills ? "fixed" : "content", paddingRight: 28, minWidth: 0, textOverflow: "ellipsis", ...own, width: fills ? "100%" : undefined, maxWidth: "100%" } as React.CSSProperties}
      >
        {children}
      </select>
      <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden style={{ position: "absolute", right: 11, top: "50%", marginTop: -3, pointerEvents: "none" }}>
        <path d="M1 1l4 4 4-4" fill="none" stroke="#e8e8ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// An AR scene is laid out for a phone held upright; in a wide view the top and
// bottom of it fall outside the frustum, so the viewer can frame it like a device.
// Screen sizes in CSS pixels, portrait. A headset is one eye's panel in pixels
// and its field of view across the longer side (vertical), from Meta's specs.
type Device = { name: string; w: number; h: number; fieldOfView?: number };
const DEVICES: Array<{ group: string; devices: Device[] }> = [
  {
    group: "Phones",
    devices: [
      { name: "iPhone SE", w: 375, h: 667 },
      { name: "iPhone 16", w: 393, h: 852 },
      { name: "iPhone 16 Pro Max", w: 440, h: 956 },
      { name: "Pixel 9", w: 412, h: 924 },
      { name: "Pixel 9 Pro", w: 427, h: 952 },
      { name: "Pixel 10", w: 412, h: 924 },
      { name: "Galaxy A55", w: 360, h: 800 },
    ],
  },
  {
    group: "Foldables",
    devices: [
      { name: "iPhone Duo", w: 466, h: 678 },
      { name: "iPhone Duo, open", w: 626, h: 890 },
      { name: "Pixel 9 Pro Fold", w: 412, h: 922 },
      { name: "Pixel 9 Pro Fold, open", w: 836, h: 842 },
      { name: "Galaxy Z Fold 6", w: 412, h: 968 },
      { name: "Galaxy Z Fold 6, open", w: 744, h: 860 },
    ],
  },
  {
    group: "Tablets",
    devices: [
      { name: "iPad mini", w: 744, h: 1133 },
      { name: "iPad Pro 13", w: 1032, h: 1376 },
    ],
  },
  {
    group: "Headsets",
    devices: [
      { name: "Quest 3", w: 2064, h: 2208, fieldOfView: 96 },
      { name: "Quest 3S", w: 1832, h: 1920, fieldOfView: 90 },
    ],
  },
];
const findDevice = (name: string) => DEVICES.flatMap((g) => g.devices).find((d) => d.name === name);
// Measured against #root's parent: the page's body, or the stage of a view
// that runs this module inside itself.
const frameBox = () => document.getElementById("root")!.parentElement!;
function applyFraming(device: Device | undefined) {
  const el = document.getElementById("root")!;
  const box = frameBox();
  // Shrunk to fit, never drawn larger than the device.
  const scale = device ? Math.min(1, box.clientWidth / device.w, box.clientHeight / device.h) : 1;
  const height = device ? Math.round(device.h * scale) : 0;
  el.style.width = device ? `${Math.round(device.w * scale)}px` : "";
  el.style.height = device ? `${height}px` : "";
  el.style.margin = device ? "0 auto" : "";
  // Not a transform, which would make #root the containing block of the fixed overlay.
  el.style.position = device ? "relative" : "";
  el.style.top = device ? `${Math.floor((box.clientHeight - height) / 2)}px` : "";
  el.style.boxShadow = device ? "0 0 0 1px rgba(255,255,255,0.14)" : "";
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
  /** The same video through the preview's own server. */
  video_url?: string | null;
};
type Project = { id: string; name: string; environments: { id: string; name: string }[] };

const ACTIVE = new Set(["awaiting_upload", "queued", "processing"]);

// A view can load media from the preview's server only, and a page only over https.
const videoSrc = (r: RenderRow) =>
  r.video_url && (host || !r.output_url?.startsWith("https:")) ? r.video_url : r.output_url;

// On a phone the scene opens in camera AR on that phone: a QR code is no use
// to the device showing it. False when nothing could open the link.
function openAR(url: string): boolean {
  if (host?.openLink) host.openLink(url);
  else if (framed) return !!window.open(url, "_blank");
  else location.assign(url);
  return true;
}

function RecordHint({ duration }: { duration: number | null }) {
  return (
    <div role="tooltip" style={{ ...chip, position: "absolute", left: 0, bottom: 42, width: 290, maxWidth: "calc(100vw - 20px)", boxSizing: "border-box", padding: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, lineHeight: 1.4, pointerEvents: "none" }}>
      <span style={{ fontWeight: 600 }}>Record and replay</span>
      <span>Record starts the scene again and records the camera and what you click in it.</span>
      <span>Replay starts it again and repeats those steps, so after a code change you can check the same path without redoing it.</span>
      <span style={{ opacity: 0.75 }}>
        It repeats your input, not the scene's state: animations, physics and timers can run differently.{" "}
        {duration === null ? "Up to 5 minutes, kept until this page closes." : `Your recording is ${clock(duration)}, kept until this page closes.`}
      </span>
    </div>
  );
}

function CloseButton({ onClose }: { onClose(): void }) {
  return (
    <button type="button" aria-label="Close" title="Close" style={{ ...button, padding: 6, display: "flex" }} onClick={onClose}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

function ControlsHelp({ onClose }: { onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Controls"
        onClick={(e) => e.stopPropagation()}
        style={{ ...chip, width: "min(520px, 100%)", maxHeight: "85%", overflow: "auto", boxSizing: "border-box", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Controls</span>
          <CloseButton onClose={onClose} />
        </div>
        {controlSections().map((section) => (
          <div key={section.title}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{section.title}</div>
            {section.note ? <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>{section.note}</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 16em) 1fr", gap: "5px 12px", fontSize: 13 }}>
              {section.rows.map(([input, action]) => (
                <React.Fragment key={input}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, opacity: 0.9 }}>{input}</span>
                  <span style={{ opacity: 0.8 }}>{action}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhonePanel({ url, onClose }: { url: string; onClose(): void }) {
  const modules = useMemo(() => qrModules(url), [url]);
  const [copied, setCopied] = useState(false);
  const n = modules?.length ?? 0;
  return (
    <div style={{ ...chip, pointerEvents: "auto", alignSelf: "center", width: "min(280px, 100%)", maxHeight: "85%", overflow: "auto", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, alignSelf: "stretch" }}>
        <span style={{ fontWeight: 600 }}>Camera AR on a phone</span>
        <CloseButton onClose={onClose} />
      </div>
      {modules ? (
        <svg role="img" aria-label="QR code for this preview" viewBox={`-4 -4 ${n + 8} ${n + 8}`} width="180" height="180" shapeRendering="crispEdges" style={{ background: "#fff", borderRadius: 6, flex: "none" }}>
          <path fill="#000" d={modules.map((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")).join("")).join("")} />
        </svg>
      ) : null}
      <div style={{ opacity: 0.75, fontSize: 12, textAlign: "center" }}>Scan to place the scene through the phone's camera.</div>
      <div style={{ userSelect: "text", fontFamily: "ui-monospace, monospace", fontSize: 11, wordBreak: "break-all", textAlign: "center" }}>{url}</div>
      <button type="button" style={button} onClick={async () => setCopied(await copyText(url))}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

type FeedbackContext = { error: string | null; warnings: string[]; scene?: string; device: string; surroundings: string; page: string; viro: string };

const FEEDBACK_SENT =
  "Sent with what you write: the error and warnings shown, the scene's file name, the device and surroundings picked, your browser and the Viro version. Not your scene's code.";

function FeedbackPanel({ url, context, onClose }: { url: string; context(): FeedbackContext; onClose(): void }) {
  const [type, setType] = useState("problem");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ sending?: true; sent?: true; error?: string }>({});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const send = async () => {
    if (!message.trim() || state.sending) return;
    setState({ sending: true });
    try {
      await api(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, message, context: context() }) });
      setState({ sent: true });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    // Above the error panel, which its blur makes a layer of its own.
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1, background: "rgba(0,0,0,0.45)", pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        onClick={(e) => e.stopPropagation()}
        style={{ ...chip, width: "min(420px, 100%)", maxHeight: "85%", overflow: "auto", boxSizing: "border-box", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }} title={FEEDBACK_SENT}>Send feedback</span>
          <CloseButton onClose={onClose} />
        </div>
        {state.sent ? (
          <>
            <span>Sent. Thank you.</span>
            <button type="button" style={{ ...button, alignSelf: "flex-end" }} onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <Picker aria-label="Feedback type" style={{ flex: "0 0 auto" }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="problem">Something is wrong</option>
              <option value="idea">An idea</option>
              <option value="other">Something else</option>
            </Picker>
            <textarea
              aria-label="Feedback"
              autoFocus
              rows={5}
              maxLength={2000}
              value={message}
              placeholder={type === "problem" ? "What happened, and what did you expect?" : "What would you like to tell us?"}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && void send()}
              style={{ font: "inherit", fontSize: 13, color: "inherit", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: 8, resize: "vertical" }}
            />
            {state.error ? <span style={{ color: "#ff9b9b", fontSize: 13 }}>{state.error}</span> : null}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7, textDecoration: "underline dotted", cursor: "help" }} title={FEEDBACK_SENT}>
                What is sent
              </span>
              <button type="button" style={button} disabled={!message.trim() || state.sending} onClick={() => void send()}>
                {state.sending ? "Sending..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
        <CloseButton onClose={onClose} />
      </div>
      <div style={{ opacity: 0.8, fontSize: 12 }}>
        Plays this scene over a recorded real-world environment from your team and makes a video. Billed to your team as compute time.
      </div>
      {projects === null && !error ? <div style={{ opacity: 0.7 }}>Loading environments...</div> : null}
      {projects && projects.length === 0 ? <div>Your team has no recorded environments yet.</div> : null}
      {projects && projects.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Picker aria-label="Environment" value={choice} onChange={(e) => setChoice(e.target.value)} style={{ flex: 1, fontWeight: 400, borderRadius: 6, background: "#1d1d24", border: "1px solid rgba(255,255,255,0.18)" }}>
            {projects.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.environments.map((env) => (
                  <option key={env.id} value={`${p.id}|${env.id}`}>{env.name}</option>
                ))}
              </optgroup>
            ))}
          </Picker>
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
          {r.output_url && viewing === r.id ? <video src={videoSrc(r) ?? undefined} controls autoPlay playsInline muted style={{ width: "100%", borderRadius: 6, background: "#000" }} /> : null}
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

// The stand-in a dropped file replaces: the one with its name, else the only one with its extension.
function placeholderFor(name: string, placeholders: string[]): string | null {
  const base = (p: string) => p.split("/").pop()!.toLowerCase();
  const ext = (p: string) => base(p).split(".").pop();
  const named = placeholders.filter((p) => base(p) === name.toLowerCase());
  if (named.length) return named.length === 1 ? named[0]! : null;
  const typed = placeholders.filter((p) => ext(p) === ext(name));
  return typed.length === 1 ? typed[0]! : null;
}

function PlaceholderPanel({
  placeholders,
  uploads,
  pending,
  onFile,
  onClose,
}: {
  placeholders: string[];
  /** "uploading", "done", or why the upload failed, by path. */
  uploads: Record<string, string>;
  /** A dropped file that matched no stand-in by name. */
  pending: File | null;
  onFile(path: string, file: File): void;
  onClose(): void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const target = useRef("");
  return (
    <div style={{ ...chip, pointerEvents: "auto", alignSelf: "center", width: "min(440px, 100%)", maxHeight: "75%", overflow: "auto", display: "flex", flexDirection: "column", gap: 8, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 600 }}>Placeholders</span>
        <CloseButton onClose={onClose} />
      </div>
      <div style={{ opacity: 0.8, fontSize: 12 }}>
        {pending
          ? `Which file does ${pending.name} replace?`
          : "These local files were not sent with the code, so a stand-in is drawn for each. Choose the real file, or drop it on the preview."}
      </div>
      <input
        ref={picker}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(target.current, file);
          e.target.value = "";
        }}
      />
      {placeholders.map((rel) => {
        const state = uploads[rel];
        const busy = state === "uploading";
        return (
          <div key={rel} style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span title={rel} style={{ ...oneLine, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{rel}</span>
              <button
                type="button"
                style={{ ...button, opacity: busy ? 0.5 : 1 }}
                disabled={busy}
                onClick={() => {
                  if (pending) return onFile(rel, pending);
                  target.current = rel;
                  picker.current?.click();
                }}
              >
                {busy ? "Uploading..." : pending ? "Replace this" : "Choose file"}
              </button>
            </div>
            {state && !busy ? (
              <div style={{ fontSize: 12, color: state === "done" ? "#9be7a7" : "#ff9b9b" }}>{state === "done" ? "Uploaded." : state}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Chrome({
  title,
  renderRequest,
  renderApi,
  arUrl,
  scenes,
  index,
  onSelect,
  onRestart,
  budgets,
  placeholders = [],
  feedbackUrl,
  expired = false,
}: {
  title?: string;
  renderRequest?: string;
  renderApi?: string;
  arUrl?: string;
  scenes: SceneInfo[];
  index: number;
  onSelect(i: number): void;
  onRestart(i: number, pose: { position: Vec3; target: Vec3 } | null): void;
  budgets?: ModelBudget[];
  placeholders?: string[];
  feedbackUrl?: string;
  expired?: boolean;
}) {
  const [, tick] = useState(0);
  const [feedback, setFeedback] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [request, setRequest] = useState<"copied" | "manual" | null>(null);
  const [panel, setPanel] = useState(false);
  const [phone, setPhone] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [assets, setAssets] = useState(false);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settings) return;
    const onDown = (e: PointerEvent) => !settingsRef.current?.contains(e.target as Node) && setSettings(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSettings(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [settings]);
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<File | null>(null);
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    if (!renderApi) return;
    loadScans(renderApi, () => tick((n) => n + 1));
    loadRecordings(renderApi, () => tick((n) => n + 1));
  }, [renderApi]);
  // The scene shown now, for a restart that runs after a recording finishes loading.
  const indexRef = useRef(index);
  indexRef.current = index;
  const toggleInspect = () => {
    setPanel(false);
    setPhone(false);
    setAssets(false);
    setInspect((v) => !v);
  };
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcuts.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !cameraControls) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const key = e.key.toLowerCase();
    if (key === "r") cameraControls.reset();
    else if (key === "f") frameContent();
    else if (key === "g" && arSceneListeners.size) {
      toggleGrid();
      tick((n) => n + 1);
    }
    else if (key === "i" && inspectable) toggleInspect();
    else if (key === "?") setHelp((v) => !v);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => shortcuts.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const upload = host?.uploadAsset;
  const sendFile = async (rel: string, file: File) => {
    setPending(null);
    setUploads((u) => ({ ...u, [rel]: "uploading" }));
    try {
      await upload!(rel, file);
      setUploads((u) => ({ ...u, [rel]: "done" }));
    } catch (e) {
      setUploads((u) => ({ ...u, [rel]: e instanceof Error ? e.message : String(e) }));
    }
  };
  const placeholdersRef = useRef(placeholders);
  placeholdersRef.current = placeholders;
  // A file dropped on a framed document would otherwise replace it.
  useEffect(() => {
    if (!upload) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hasFile = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const onOver = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      setDropping(placeholdersRef.current.length > 0);
      clearTimeout(timer);
      // dragover repeats while a file is held over the page, and nothing says when it leaves.
      timer = setTimeout(() => setDropping(false), 500);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      setDropping(false);
      const file = e.dataTransfer?.files[0];
      if (!file || !placeholdersRef.current.length) return;
      const rel = placeholderFor(file.name, placeholdersRef.current);
      if (rel) return void sendFile(rel, file);
      setPending(file);
      setPanel(false);
      setPhone(false);
      setInspect(false);
      setAssets(true);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [upload]);
  // "" fills the view.
  const [device, setDevice] = useState("");
  const framedAs = findDevice(device);
  // Only an AR scene plays the recording.
  const shownFeed = arSceneListeners.size ? feed : null;
  useEffect(() => {
    // A recording is framed at its own shape, which the poses and the camera it was taken with assume.
    const shape = shownFeed ? { name: "", w: shownFeed.size.width, h: shownFeed.size.height } : framedAs;
    if (!cameraControls && !shownFeed) return;
    const frame = () => applyFraming(shape);
    frame();
    if (cameraControls) {
      framedFieldOfView = framedAs?.fieldOfView ?? null;
      cameraControls.setFieldOfView(framedFieldOfView);
    }
    const observer = new ResizeObserver(frame);
    observer.observe(frameBox());
    return () => observer.disconnect();
  }, [device, cameraControls, shownFeed]);
  const [session, setSession] = useState<{ kind: "recording" | "replaying"; elapsed: number } | null>(null);
  const [sessionNote, setSessionNote] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const startRecording = () => {
    if (!cameraControls) return;
    const at = { scene: scenes[index]?.path, device, surroundings, grid: gridOn };
    onRestart(index, cameraControls.pose());
    setSessionNote(null);
    setSession({ kind: "recording", elapsed: 0 });
    let recorder: ReturnType<typeof recordSession> | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const cancel = whenSceneReady(() => {
      const canvas = sceneCanvas();
      if (!canvas) return end();
      const started = performance.now();
      recorder = recordSession(canvas, () => cameraControls?.pose() ?? { position: [0, 0, 0], target: [0, 0, -1] });
      timer = setInterval(() => {
        const elapsed = performance.now() - started;
        if (elapsed >= MAX_RECORDING_MS) end();
        else setSession({ kind: "recording", elapsed });
      }, 250);
    }, () => end());
    const end = () => {
      cancel();
      clearInterval(timer);
      if (recorder) recording = { ...recorder.stop(), ...at };
      recorder = null;
      endSession = null;
      setSession(null);
    };
    endSession = end;
  };
  const startReplay = () => {
    const rec = recording;
    if (!rec || !cameraControls) return;
    const i = rec.scene === undefined ? index : scenes.findIndex((sc) => sc.path === rec.scene);
    if (i < 0) return setSessionNote("The recorded scene is no longer in this preview.");
    setSessionNote(null);
    setDevice(rec.device);
    if (rec.surroundings !== surroundings && ROOMS[rec.surroundings]) setSurroundings(rec.surroundings);
    if (rec.grid !== gridOn) toggleGrid();
    onRestart(i, rec.poses[0] ?? null);
    setSession({ kind: "replaying", elapsed: 0 });
    let stopPlay: (() => void) | null = null;
    // A click, key or scroll of the developer's own takes the scene back.
    const onUser = (e: Event) => e.isTrusted && end();
    const cancel = whenSceneReady(() => {
      const canvas = sceneCanvas();
      if (!canvas) return end();
      for (const type of ["pointerdown", "keydown", "wheel"]) window.addEventListener(type, onUser, true);
      stopPlay = playSession(
        rec,
        canvas,
        (position, target) => cameraControls?.lookFrom(position, target),
        // The clock shows seconds, so the page is drawn again once a second, not once a frame.
        (elapsed) => setSession((s) => (s && Math.floor(s.elapsed / 1000) === Math.floor(elapsed / 1000) ? s : { kind: "replaying", elapsed })),
        end,
      );
    }, () => end());
    const end = () => {
      cancel();
      stopPlay?.();
      for (const type of ["pointerdown", "keydown", "wheel"]) window.removeEventListener(type, onUser, true);
      endSession = null;
      setSession(null);
    };
    endSession = end;
  };
  const seen = useRef("");
  const shownDownloads = useRef(false);
  useEffect(() => {
    const onCamera = () => tick((n) => n + 1);
    cameraListeners.add(onCamera);
    const timer = setInterval(() => {
      const key = `${renderState.ready}|${renderState.error}|${renderState.warnings.length}|${waitingSelectors.size}`;
      if (key !== seen.current) {
        seen.current = key;
        postStatus();
        tick((n) => n + 1);
      } else if (modelDownloads.size || modelRetries.size || renderState.loading.length || shownDownloads.current) {
        tick((n) => n + 1);
      }
      if (!renderState.loading.length) loadingSince = 0;
      else loadingSince ||= performance.now();
      shownDownloads.current = modelDownloads.size + modelRetries.size + renderState.loading.length > 0;
    }, 300);
    return () => {
      cameraListeners.delete(onCamera);
      clearInterval(timer);
    };
  }, []);

  const issues = renderState.warnings.length + (renderState.error ? 1 : 0);
  // A scan's or recording's name is the team's own, so only its kind is sent.
  const feedbackContext = (): FeedbackContext => {
    const room = ROOMS[surroundings]!;
    return {
      error: renderState.error,
      warnings: renderState.warnings,
      scene: scenes[index]?.path ?? title,
      device: device || "Fill view",
      surroundings: !arSceneListeners.size ? "none" : room.recording ? "a recording" : room.scan ? "a scan" : room.label,
      page: host ? "view" : framed ? "framed" : "page",
      viro: VIRO_VERSION,
    };
  };
  const downloads = downloadProgress();
  const downloading = !!downloads && downloads.count > downloads.done;
  // Parsing a large model takes seconds with nothing downloading; a quick one is not worth a chip.
  const preparing = !downloading && loadingSince && performance.now() - loadingSince > 1000 ? renderState.loading.length : 0;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", padding: 10, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {/* On a narrow view the name gives way first, then the buttons wrap. */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 0", minWidth: 96, display: "flex" }}>
        {scenes.length > 1 ? (
          <Picker
            aria-label="Scene"
            value={index}
            onChange={(e) => onSelect(Number(e.target.value))}
            style={{ maxWidth: "100%" }}
          >
            {scenes.map((sc, i) => (
              <option key={sc.path} value={i} title={sc.path}>{sceneLabel(sc.path)}</option>
            ))}
          </Picker>
        ) : <div style={{ ...chip, ...oneLine }}>{title ?? "Viro Live"}{liveAR ? " · AR" : ""}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* Without renderApi the button copies a request for a coding agent, which a chat does not have. */}
          {!liveAR && renderRequest && (renderApi || !framed) ? (
            <button
              type="button"
              style={button}
              onClick={async () => {
                setPhone(false);
                setInspect(false);
                setAssets(false);
                if (renderApi) setPanel((v) => !v);
                else if (renderRequest) setRequest((await copyText(renderRequest)) ? "copied" : "manual");
              }}
            >
              Render in a real space
            </button>
          ) : null}
          {!liveAR && arUrl ? (
            <button
              type="button"
              style={button}
              onClick={() => {
                setPanel(false);
                setInspect(false);
                setAssets(false);
                if (touch && openAR(arUrl)) return;
                setPhone((v) => !v);
              }}
            >
              View in AR
            </button>
          ) : null}
          {inspectable ? (
            <button
              type="button"
              aria-pressed={inspect}
              style={button}
              onClick={toggleInspect}
            >
              Inspect
            </button>
          ) : null}
          {upload && placeholders.length ? (
            <button
              type="button"
              aria-pressed={assets}
              style={button}
              onClick={() => {
                setPanel(false);
                setPhone(false);
                setInspect(false);
                setPending(null);
                setAssets((v) => !v);
              }}
            >
              {placeholders.length} placeholder{placeholders.length === 1 ? "" : "s"}
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
      {help && cameraControls ? <ControlsHelp onClose={() => setHelp(false)} /> : null}
      {feedback && feedbackUrl ? <FeedbackPanel url={feedbackUrl} context={feedbackContext} onClose={() => setFeedback(false)} /> : null}
      {phone && arUrl ? <PhonePanel url={arUrl} onClose={() => setPhone(false)} /> : null}
      {inspect ? (
        <InspectPanel
          budgets={budgets ?? []}
          scene={scenes[index]?.path ?? title}
          onSelection={host?.onSelect ? (text) => host.onSelect!(text) : undefined}
          styles={{ chip, button }}
          copy={copyText}
          onClose={() => setInspect(false)}
        />
      ) : null}
      {assets && upload && placeholders.length ? (
        <PlaceholderPanel
          placeholders={placeholders}
          uploads={uploads}
          pending={pending}
          onFile={sendFile}
          onClose={() => {
            setAssets(false);
            setPending(null);
          }}
        />
      ) : null}
      {dropping ? (
        <div style={{ ...chip, alignSelf: "center", fontWeight: 600, border: "1px dashed rgba(255,255,255,0.5)", padding: "14px 18px" }}>
          Drop the file to replace its placeholder
        </div>
      ) : null}
      {(downloads || preparing) && !dropping ? (
        <div role="status" style={{ ...chip, alignSelf: "center", display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
          {downloading ? (
            <div style={{ fontWeight: 600 }}>
              Loading {downloads!.count} {downloads!.count === 1 ? "model" : "models"}
              {downloads!.done ? ` (${downloads!.done} done)` : ""}:{" "}
              {downloads!.size ? `${megabytes(downloads!.read)} of ${megabytes(downloads!.size)}` : `${megabytes(downloads!.read)} so far`}
            </div>
          ) : preparing ? (
            <div style={{ fontWeight: 600 }}>
              Preparing {preparing} {preparing === 1 ? "model" : "models"}...
            </div>
          ) : null}
          {downloads?.retrying.length ? <div style={{ color: "#ffd27a" }}>A download failed. Retrying {downloads.retrying.join(", ")}...</div> : null}
          {downloading || preparing ? <ActivityBar /> : null}
        </div>
      ) : null}
      {waitingSelectors.size && !dropping && !renderState.error ? (
        <div style={{ ...chip, alignSelf: "center", fontWeight: 600 }}>
          {touch ? "Tap" : "Click"} the highlighted surface to place the scene's content
        </div>
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
          {feedbackUrl ? (
            <button type="button" style={{ ...button, marginTop: 8, font: "600 13px system-ui, -apple-system, sans-serif" }} title="Tell us about this. The messages above are sent with it." onClick={() => setFeedback(true)}>
              Report this
            </button>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", minWidth: 0 }}>
        {cameraControls || feedPlaying || feedbackUrl ? (
          <div ref={settingsRef} style={{ position: "relative" }}>
            {settings ? (
              <div role="dialog" aria-label="Preview settings" style={{ ...chip, pointerEvents: "auto", position: "absolute", left: 0, bottom: 42, width: 270, maxWidth: "calc(100vw - 20px)", boxSizing: "border-box", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Preview settings</span>
                <label style={settingStyle}>
                  Device
                  <Picker
                    aria-label="Device"
                    style={{ flex: "1 1 auto" }}
                    disabled={!!shownFeed}
                    title={shownFeed ? "A recording is shown at its own shape." : framedAs ? `${framedAs.w} x ${framedAs.h}${framedAs.fieldOfView ? ` per eye, ${framedAs.fieldOfView}° field of view` : ""}` : undefined}
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                  >
                    <option value="">Fill view</option>
                    {DEVICES.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.devices.map((d) => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </Picker>
                </label>
                {/* The grid and the surroundings are the AR camera's, offered only while an AR scene listens for them. */}
                {arSceneListeners.size ? (
                  <label style={settingStyle}>
                    Surroundings
                    <Picker
                      aria-label="Surroundings"
                      style={{ flex: "1 1 auto" }}
                      value={surroundings}
                      title={
                        ROOMS[surroundings]!.recording
                          ? "The recording plays as the camera feed, and its camera moves the view. A recording has no detected surfaces, so content that waits for one does not appear."
                          : undefined
                      }
                      onChange={(e) => {
                        chooseSurroundings(e.target.value, () => onRestart(indexRef.current, null), () => tick((n) => n + 1));
                        tick((n) => n + 1);
                      }}
                    >
                      {Object.entries(ROOMS).filter(([, r]) => !r.scan && !r.recording).map(([k, r]) => (
                        <option key={k} value={k}>{r.label}</option>
                      ))}
                      {Object.values(ROOMS).some((r) => r.scan) ? (
                        <optgroup label="Your scans">
                          {Object.entries(ROOMS).filter(([, r]) => r.scan).map(([k, r]) => (
                            <option key={k} value={k}>{r.label}</option>
                          ))}
                        </optgroup>
                      ) : null}
                      {Object.values(ROOMS).some((r) => r.recording) ? (
                        <optgroup label="Your recordings">
                          {Object.entries(ROOMS).filter(([, r]) => r.recording).map(([k, r]) => (
                            <option key={k} value={k}>{r.label}</option>
                          ))}
                        </optgroup>
                      ) : null}
                    </Picker>
                    {feedNote ? <span style={{ fontSize: 12, opacity: 0.75 }}>{feedNote}</span> : null}
                  </label>
                ) : null}
                {arSceneListeners.size && !feed ? (
                  <label style={{ ...settingStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                    Floor grid
                    <input
                      type="checkbox"
                      checked={gridOn}
                      onChange={() => {
                        toggleGrid();
                        tick((n) => n + 1);
                      }}
                    />
                  </label>
                ) : null}
                {cameraControls ? (
                  <button
                    type="button"
                    style={button}
                    onClick={() => {
                      setSettings(false);
                      setHelp(true);
                    }}
                  >
                    View controls
                  </button>
                ) : null}
                {feedbackUrl ? (
                  <button
                    type="button"
                    style={button}
                    onClick={() => {
                      setSettings(false);
                      setFeedback(true);
                    }}
                  >
                    Send feedback
                  </button>
                ) : null}
              </div>
            ) : null}
            <button type="button" aria-label="Preview settings" title="Preview settings" aria-expanded={settings} style={roundButton} onClick={() => setSettings((v) => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        ) : null}
        {session ? (
          <>
            <button
              type="button"
              aria-label={session.kind === "recording" ? "Stop recording" : "Stop replay"}
              title={session.kind === "recording" ? "Stop recording" : "Stop replay"}
              style={roundButton}
              onClick={() => endSession?.()}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
              </svg>
            </button>
            <span style={{ ...chip, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {session.kind === "recording" ? `Recording ${clock(session.elapsed)}` : `Replaying ${clock(session.elapsed)} / ${clock(recording?.duration ?? 0)}`}
            </span>
          </>
        ) : cameraControls && !ROOMS[surroundings]!.recording ? (
          <>
            <div
              style={{ position: "relative", display: "flex", gap: 8 }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHint(true)}
              onPointerLeave={() => setHint(false)}
              onFocus={() => setHint(true)}
              onBlur={() => setHint(false)}
            >
            {hint ? <RecordHint duration={recording?.duration ?? null} /> : null}
            <button type="button" aria-label="Record a session" style={roundButton} onClick={() => (setHint(false), startRecording())}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" fill="#ff5a5a" />
              </svg>
            </button>
            {recording ? (
              <button type="button" aria-label="Replay the recording" style={roundButton} onClick={() => (setHint(false), startReplay())}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M4 2.5v9l7.5-4.5z" fill="currentColor" />
                </svg>
              </button>
            ) : null}
            </div>
            {sessionNote ? <span style={chip}>{sessionNote}</span> : null}
          </>
        ) : null}
        {expired ? <span style={chip}>This preview has expired and no longer updates.</span> : null}
        </div>
        {cameraControls ? (
          <button type="button" style={button} onClick={() => cameraControls?.reset()}>
            Reset view
          </button>
        ) : null}
      </div>
    </div>
  );
}

function onlyModelsChanged(was: PreviewInput, now: PreviewInput): boolean {
  if (was.code !== now.code || JSON.stringify(was.scenes) !== JSON.stringify(now.scenes)) return false;
  const a = was.assetOverrides ?? {};
  const b = now.assetOverrides ?? {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => a[k] === b[k] || MODEL_RE.test(k));
}

function Preview({ input, expired }: { input: PreviewInput; expired: boolean }) {
  // With the version it was compiled from, which keys the mounted scene.
  const [compiled, setCompiled] = useState<{ apps: React.ComponentType<any>[]; version: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  // Unresolved imports are reported while the bundle compiles, so they hold for every scene.
  const compileWarnings = useRef<string[]>([]);
  const shown = useRef<PreviewInput | null>(null);
  useEffect(() => {
    keepModelsOf(input.assetOverrides);
    // An upload only changes the file a model shows, so the running scene swaps that model in place.
    if (shown.current && onlyModelsChanged(shown.current, input)) {
      shown.current = input;
      setModelOverrides(input.assetOverrides);
      return;
    }
    // An update replaces the running scene, so its status starts over; the scene being looked at stays selected.
    if (shown.current) {
      endSession?.();
      renderState.ready = false;
      renderState.error = null;
      renderState.warnings.length = 0;
      keptPose = cameraControls?.pose() ?? keptPose;
      cameraControls = null;
    }
    shown.current = input;
    const at = Math.max(0, (input.scenes ?? []).findIndex((sc) => sc.path === currentScene));
    currentScene = input.scenes?.[at]?.path;
    setIndex(at);
    const compile = (transform?: (code: string) => string) => {
      try {
        setCompiled({ apps: compileGeneratedScenes(input.code, input.assetOverrides, transform), version: input.version ?? 0 });
        compileWarnings.current = [...renderState.warnings];
      } catch (err) {
        setCompiled(null);
        markError(err);
      }
    };
    if (input.codeFormat === "cjs") compile();
    else
      import("./transformTsx").then(
        ({ transformTsx }) => shown.current === input && compile(transformTsx),
        (err) => shown.current === input && markError(err),
      );
  }, [input]);
  const scenes = input.scenes ?? [];
  // The navigator is remounted for the new scene, so its status starts over.
  const select = (i: number) => {
    endSession?.();
    renderState.ready = false;
    renderState.error = null;
    renderState.warnings.splice(0, renderState.warnings.length, ...compileWarnings.current);
    keptPose = null;
    cameraControls = null;
    currentScene = scenes[i]?.path;
    setIndex(i);
  };
  // Starts scene `i` again with the camera at `pose`, for a recording or a replay.
  const restart = (i: number, pose: { position: Vec3; target: Vec3 } | null) => {
    select(i);
    keptPose = pose;
    setRun((n) => n + 1);
  };
  const App = compiled?.apps[index];
  return (
    <>
      {/* Keyed by the update as well: a boundary that caught the last version's crash must not hold the new one. */}
      {App ? <Scene key={`${compiled!.version}:${index}:${run}`} App={App} /> : null}
      {shot ? null : (
        <Chrome
          title={input.title}
          renderRequest={scenes.length ? scenes[index]?.renderRequest : input.renderRequest}
          renderApi={input.renderApi}
          arUrl={input.arUrl}
          scenes={scenes}
          index={index}
          onSelect={select}
          onRestart={restart}
          budgets={input.budgets}
          placeholders={input.placeholders}
          feedbackUrl={input.feedbackUrl}
          expired={expired}
        />
      )}
    </>
  );
}

/**
 * Asks the server for a version after the one shown. The server holds each
 * request until there is one, answering 204 when there is none in time.
 */
function followUpdates(first: PreviewInput, onUpdate: (input: PreviewInput) => void, onExpired: () => void): () => void {
  if (!first.updatesUrl) return () => {};
  const stop = new AbortController();
  let version = first.version ?? 1;
  let held = first;
  void (async () => {
    while (!stop.signal.aborted) {
      const asked = performance.now();
      let again = 1000;
      try {
        // pageFetch: a request the server lets time out is not a failed load to warn about.
        const tag = held.codeTag ? `&code=${encodeURIComponent(held.codeTag)}` : "";
        const res = await pageFetch(`${first.updatesUrl}${version}${tag}`, { signal: stop.signal, cache: "no-store" });
        if (res.status === 404) return onExpired();
        if (res.status === 200) {
          const got = ((await res.json()) as { input?: Omit<PreviewInput, "code"> & { code?: string } }).input;
          // Without `code`, the update changed something else and the code is the one held.
          const next = got && { ...got, code: got.code ?? held.code };
          if (next?.code) {
            version = next.version ?? version + 1;
            held = next;
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

// Uploads come in bursts, and each one that is not a model runs the scene
// again, cutting the last run off mid-load: those wait for the burst to end.
const ASSET_BURST_MS = 1500;

function Live({ first }: { first: PreviewInput }) {
  const [input, setInput] = useState(first);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (shot) return;
    let latest = first;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = followUpdates(first, (next) => {
      const assetsOnly = next.code === latest.code && JSON.stringify(next.scenes) === JSON.stringify(latest.scenes);
      const wait = assetsOnly && !onlyModelsChanged(latest, next);
      latest = next;
      clearTimeout(timer);
      if (wait) timer = setTimeout(() => setInput(next), ASSET_BURST_MS);
      else setInput(next);
    }, () => setExpired(true));
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [first]);
  return <Preview input={input} expired={expired} />;
}

const input = window.__PREVIEW_INPUT__;
const root = createRoot(document.getElementById("root")!);
if (!input) {
  markError(new Error("No scene was given to this page."));
  root.render(createElement(Chrome, { scenes: [], index: 0, onSelect: () => {}, onRestart: () => {} }));
} else {
  root.render(createElement(Live, { first: input }));
}
