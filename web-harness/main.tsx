/**
 * Web bridge harness: renders a Viro3DSceneNavigator with a ViroBox through the
 * real Viro component bridge (.web.tsx) → WASM C API. Validates the vertical
 * slice end-to-end. Import components directly (not the package index) to avoid
 * pulling in native-only modules.
 */
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

// WASM asset-loading options for Vite (?url + importGlue/locateFile). Shared
// with render.tsx — see wasmOptions.ts.
import { webRendererOptions } from "./wasmOptions";

import { Viro3DSceneNavigator } from "../components/Viro3DSceneNavigator";
import { ViroARSceneNavigator } from "../components/AR/ViroARSceneNavigator";
import { ViroARScene } from "../components/AR/ViroARScene";
import { ViroARPlane } from "../components/AR/ViroARPlane";
import { ViroScene } from "../components/ViroScene";
import { ViroBox } from "../components/ViroBox";
import { ViroSurface } from "../components/ViroSurface";
import { ViroNode } from "../components/ViroNode";
import { Viro3DObject } from "../components/Viro3DObject";
import { ViroImage } from "../components/ViroImage";
import { ViroText } from "../components/ViroText";
import { ViroPolyline } from "../components/ViroPolyline";
import { ViroPolygon } from "../components/ViroPolygon";
import { ViroGeometry } from "../components/ViroGeometry";
import { Viro360Image } from "../components/Viro360Image";
import { ViroParticleEmitter } from "../components/ViroParticleEmitter";
import { ViroPortalScene } from "../components/ViroPortalScene";
import { ViroPortal } from "../components/ViroPortal";
import { StudioSceneNavigator } from "../components/Studio/StudioSceneNavigator";
import { ViroSceneNavigator } from "../components/ViroSceneNavigator";
import { ViroAnimatedImage } from "../components/ViroAnimatedImage";
import { ViroCameraTexture } from "../components/ViroCameraTexture";
import { ViroVirtualJoystick } from "../components/ViroVirtualJoystick";
import { ViroVirtualButton } from "../components/ViroVirtualButton";
import { useVirtualController } from "../components/Web/viroVirtualController";
import { ViroQuad } from "../components/ViroQuad";
import { makeStudioScene } from "./studioFixture";
import {
  makeCheckerDataUrl,
  makeAnimatedGifDataUrl,
  makeTransparentBorderPngDataUrl,
} from "./placeholderAssets";
import type { StudioSceneResponse } from "../components/Studio/types";
import { ViroAmbientLight } from "../components/ViroAmbientLight";
import { ViroDirectionalLight } from "../components/ViroDirectionalLight";
import { ViroMaterials } from "../components/Material/ViroMaterials";
import { ViroAnimations } from "../components/Animation/ViroAnimations";
import { HarnessPanels, clearStatus, herr, hlog, setStatus } from "./harnessLog";

import helmetUrl from "./models/DamagedHelmet.glb?url";

// VRX + its external PNG textures are served unhashed from public/ so the names
// match what the .vrx references.
const dragonBase = "/models/dragon";
const dragonUrl = `${dragonBase}/object_dragon_pbr_anim.vrx`;
const dragonResources = [
  `${dragonBase}/object_dragon_pbr_Base_Color.png`,
  `${dragonBase}/object_dragon_pbr_Metallic.png`,
  `${dragonBase}/object_dragon_pbr_Roughness.png`,
  `${dragonBase}/object_dragon_pbr_Mixed_AO.png`,
  `${dragonBase}/object_dragon_pbr_Normal_OpenGL.png`,
];

// Procedural checkerboard texture (data URL) to exercise the texture pipeline
// without shipping an image asset. Shared with render.tsx.
const checkerUrl = makeCheckerDataUrl();

// Procedural animated GIF (2-frame loop) for the ViroAnimatedImage demo.
const animatedGifUrl = makeAnimatedGifDataUrl();

ViroMaterials.createMaterials({
  blueBox: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
  redBox: { lightingModel: "Blinn", diffuseColor: "#ff5533" },
  checker: { lightingModel: "Lambert", diffuseTexture: makeCheckerDataUrl() },
  // ViroCameraTexture writes the live camera feed onto this material's diffuse;
  // it only needs a lightingModel (the texture is supplied at runtime).
  cameraFeed: { lightingModel: "Constant" },
});

// Declarative animation: spin + bob, looping.
ViroAnimations.registerAnimations({
  // rotateY 0->360 loops seamlessly (360 == 0). A smooth up/down bob needs an
  // animation chain (sequence up + down), which isn't supported on web yet.
  spin: {
    duration: 2000,
    easing: "Linear",
    properties: { rotateY: 360 },
  },
});

// URL params (see README.md): ?mode= picks the initial mode; the rest feed the
// individual modes.
const params = new URLSearchParams(window.location.search);
/** ?glb=<url>: a model to load in 3D mode (replacing the helmet) and Studio mode. */
const glbParam = params.get("glb");
/** ?glbScale=<n>: uniform scale for the ?glb model in 3D mode. */
const glbScale = Number(params.get("glbScale")) || 1.6;

function shortUrl(url: string): string {
  if (url.startsWith("data:")) return url.slice(0, 24) + "…";
  return url.length > 60 ? "…" + url.slice(-57) : url;
}

/** Bytes of a fetched model: resource timing first, a HEAD request second. */
async function modelSizeBytes(url: string): Promise<number | null> {
  if (url.startsWith("data:") || url.startsWith("blob:")) return null;
  const abs = new URL(url, window.location.href).href;
  const entry = performance.getEntriesByName(abs).pop() as PerformanceResourceTiming | undefined;
  const timed = entry ? entry.decodedBodySize || entry.encodedBodySize : 0;
  if (timed > 0) return timed;
  try {
    const r = await fetch(abs, { method: "HEAD" });
    const n = Number(r.headers.get("content-length"));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * onLoadStart/onLoadEnd/onError for a Viro3DObject that log elapsed time and
 * the model size. Built once per model so a re-rendering scene hands the
 * component the same functions.
 */
function modelLoadHandlers(tag: string, url: string) {
  let start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  return {
    onLoadStart: () => {
      start = performance.now();
      hlog(tag, "load start", shortUrl(url));
    },
    onLoadEnd: () => {
      const ms = elapsed();
      void modelSizeBytes(url).then((b) =>
        hlog(tag, `loaded in ${ms} ms`, b ? `(${(b / 1048576).toFixed(2)} MB)` : "(size unknown)"),
      );
    },
    onError: (e: unknown) => herr(tag, `error after ${elapsed()} ms:`, e),
  };
}

const mainModelUrl = glbParam ?? helmetUrl;
const mainModelHandlers = modelLoadHandlers(glbParam ? "glb" : "helmet", mainModelUrl);

function DemoScene() {
  const [angle, setAngle] = useState(0);
  const [tapped, setTapped] = useState(false);
  const [taps, setTaps] = useState(0);
  const tapsRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => setAngle((a) => a + 2), 16);
    return () => clearInterval(id);
  }, []);
  useEffect(() => setStatus("3D taps", `${taps} (box upper-right)`), [taps]);

  return (
    <ViroScene>
      {/* Viro360Image: equirect sphere background (checker as a smoke test). */}
      <Viro360Image source={{ uri: checkerUrl }} onLoadEnd={() => console.log("[harness] 360 loaded")} />
      <ViroAmbientLight color="#ffffff" intensity={300} />
      <ViroDirectionalLight
        color="#ffffff"
        intensity={1000}
        direction={[0, -1, -0.6]}
        castsShadow
      />
      {/* Tap target (W2): fixed, off both screen centres and in front of the
          spinning content, so a tap mirrored in x or y lands on nothing. */}
      <ViroBox
        position={[0.9, 0.7, -2.5]}
        scale={[0.35, 0.35, 0.35]}
        materials={[taps % 2 ? "redBox" : "blueBox"]}
        onClick={() => {
          tapsRef.current += 1;
          hlog("3D", `tap #${tapsRef.current} on upper-right box`);
          setTaps(tapsRef.current);
        }}
      />
      <ViroText
        position={[0.9, 1.05, -2.5]}
        width={1.2}
        height={0.3}
        text={`taps: ${taps}`}
        style={{ fontSize: 18, color: "#ffffff", textAlign: "Center" }}
      />
      <ViroNode position={[0, 0, -5]} rotation={[0, angle * 0.4, 0]}>
        {/* Loaded GLB model (PBR, self-contained) at the center — or ?glb=. */}
        <Viro3DObject
          source={{ uri: mainModelUrl }}
          type="GLB"
          scale={glbParam ? [glbScale, glbScale, glbScale] : [1.6, 1.6, 1.6]}
          rotation={[0, angle, 0]}
          {...mainModelHandlers}
        />
        {/* VRX model (FBX/protobuf/gzip path) to the side. */}
        <Viro3DObject
          source={{ uri: dragonUrl }}
          type="VRX"
          resources={dragonResources.map((uri) => ({ uri }))}
          position={[3.5, -1.5, 0]}
          scale={[0.2, 0.2, 0.2]}
          animation={{ name: "*", run: true, loop: true, onStart: () => console.log("[harness] dragon anim start") }}
          onLoadEnd={() => console.log("[harness] dragon loaded")}
          onError={(e) => console.error("[harness] dragon error", e)}
        />
        {/* A tappable cube to the side, animated with a declarative ViroAnimation. */}
        <ViroBox
          position={[-3, 0, 0]}
          materials={[tapped ? "redBox" : "blueBox"]}
          animation={{ name: "spin", run: true, loop: true }}
          onClick={() => {
            console.log("[harness] box clicked");
            setTapped((t) => !t);
          }}
        />
        <ViroSurface
          position={[0, -1.8, 0]}
          rotation={[-90, 0, 0]}
          width={8}
          height={8}
          materials={["checker"]}
        />
        {/* ViroImage: textured surface from an image source (checker data URL). */}
        <ViroImage
          position={[3, 2, 0]}
          width={1.5}
          height={1.5}
          source={{ uri: checkerUrl }}
          onLoadEnd={() => console.log("[harness] image loaded")}
        />
        {/* ViroAnimatedImage: a looping GIF (yellow dot bouncing) re-sampled per
            frame onto a surface — proves the animated-image pipeline. */}
        <ViroAnimatedImage
          position={[5, 2, 0]}
          width={1.5}
          height={1.5}
          source={{ uri: animatedGifUrl }}
          onLoadEnd={() => console.log("[harness] animated image loaded")}
        />
        {/* ViroText: font pipeline (preloaded Roboto). */}
        <ViroText
          position={[-3, 3, 0]}
          width={4}
          height={1}
          text="Hello Viro Web"
          style={{ fontSize: 36, color: "#ffdd44", textAlign: "Center" }}
        />
        {/* ViroPolyline: a zig-zag line. */}
        <ViroPolyline
          position={[-3, -3, 0]}
          thickness={0.05}
          points={[
            [0, 0, 0],
            [1, 0.6, 0],
            [2, 0, 0],
            [3, 0.6, 0],
          ]}
          materials={["redBox"]}
        />
        {/* ViroPolygon: a filled triangle. */}
        <ViroPolygon
          position={[3, -3, 0]}
          vertices={[
            [0, 0],
            [1, 0],
            [0.5, 1],
          ]}
          materials={["blueBox"]}
        />
        {/* ViroGeometry: a custom quad mesh (two triangles) with normals + UVs. */}
        <ViroGeometry
          position={[0, -3, 0]}
          vertices={[
            [-0.5, -0.5, 0],
            [0.5, -0.5, 0],
            [0.5, 0.5, 0],
            [-0.5, 0.5, 0],
          ]}
          normals={[
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
          ]}
          texcoords={[
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ]}
          triangleIndices={[
            [0, 1, 2],
            [0, 2, 3],
          ]}
          materials={["checker"]}
        />
        {/* ViroParticleEmitter: a fountain of checker sprites. */}
        <ViroParticleEmitter
          position={[0, 2, 0]}
          image={{ source: { uri: checkerUrl }, width: 0.1, height: 0.1 }}
          run
          spawnBehavior={{
            emissionRatePerSecond: [20, 30],
            particleLifetime: [1500, 2500],
            maxParticles: 300,
            spawnVolume: { shape: "Box", params: [0.2, 0, 0.2] },
          }}
          particlePhysics={{ velocity: { min: [-0.2, 1, -0.2], max: [0.2, 2, 0.2] } }}
        />
        {/* ViroPortalScene: a doorway (surface) with a box visible through it. */}
        <ViroPortalScene passable={false}>
          <ViroPortal position={[6, 0, 0]}>
            <ViroSurface width={1.4} height={2} materials={["checker"]} />
          </ViroPortal>
          <ViroBox position={[6, 0, -2]} scale={[0.6, 0.6, 0.6]} materials={["redBox"]} />
        </ViroPortalScene>
      </ViroNode>
    </ViroScene>
  );
}

// ─── AR diagnostics (shared by AR mode and Studio scenes that open in AR) ───

const TRACKING_NAMES: Record<number, string> = { 1: "UNAVAILABLE", 2: "LIMITED", 3: "NORMAL" };
let lastTracking: { name: string; at: number } | null = null;

/** Tracking state on screen, plus each transition and how long the previous state held (W3). */
function reportTracking(state: number) {
  const name = TRACKING_NAMES[state] ?? `state ${state}`;
  const now = performance.now();
  if (lastTracking?.name === name) return;
  const held = lastTracking ? ` after ${((now - lastTracking.at) / 1000).toFixed(1)}s` : "";
  hlog("AR", `tracking ${lastTracking?.name ?? "—"} → ${name}${held}`);
  lastTracking = { name, at: now };
  setStatus("tracking", `${name} (since ${(now / 1000).toFixed(1)}s)`);
}

/**
 * The <video> an AR session reads the camera from. ViroArSession keeps it in a
 * private field and also attaches it, hidden, to <body>; the field is tried
 * first so a second video on the page can't be picked by mistake.
 */
function arVideoOf(session: any): HTMLVideoElement | null {
  const own = session?.video;
  if (own instanceof HTMLVideoElement) return own;
  return (
    document.querySelector<HTMLVideoElement>('body > video[aria-hidden="true"]') ??
    document.querySelector<HTMLVideoElement>("video")
  );
}

let stopFeedWatch: (() => void) | null = null;

/** Shows the camera feed size (videoWidth x videoHeight) once the session runs (W5). */
function watchFeedSize(session: any) {
  stopFeedWatch?.();
  let last = "";
  const tick = () => {
    const v = arVideoOf(session);
    const size = v && v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : "(no video yet)";
    if (size === last) return;
    last = size;
    setStatus("feed", size);
    const settings = session?.stream?.getVideoTracks?.()[0]?.getSettings?.();
    hlog(
      "AR",
      `camera feed ${size}`,
      settings ? `track ${settings.width}x${settings.height}@${settings.frameRate ?? "?"}fps` : "",
    );
  };
  tick();
  const id = setInterval(tick, 1000);
  stopFeedWatch = () => {
    clearInterval(id);
    stopFeedWatch = null;
  };
}

function onARSessionReady(session: any) {
  hlog("AR", "session ready");
  watchFeedSize(session);
}

function onMotionUnavailable(reason: string) {
  herr("AR", `motion unavailable: ${reason}`);
  setStatus("motion", reason);
}

// AR demo: a cube fixed 1m ahead (proves pose tracking) + a ViroARPlane that
// binds to the first detected plane and drops a red box on it (proves the
// declarative plane API: slam planes → anchors → matched node transform), and
// a tap target off to the upper right so a mirrored tap would miss it (W2).
function ARDemoScene() {
  const [taps, setTaps] = useState(0);
  const tapsRef = useRef(0);
  useEffect(() => setStatus("AR taps", `${taps} (box upper-right)`), [taps]);
  return (
    <ViroARScene
      onTrackingUpdated={(state: number) => reportTracking(state)}
      onAnchorFound={(a: any) => hlog("AR", "anchor found", a.anchorId, a.alignment)}
      onAnchorRemoved={(a: any) => hlog("AR", "anchor removed", a.anchorId)}
    >
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroDirectionalLight color="#ffffff" intensity={1000} direction={[0, -1, -0.6]} />
      {/* World-fixed cube for pose validation. */}
      <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} materials={["blueBox"]} />
      {/* Tap target: up and to the right of the pose cube. */}
      <ViroBox
        position={[0.3, 0.2, -1]}
        scale={[0.12, 0.12, 0.12]}
        materials={[taps % 2 ? "blueBox" : "redBox"]}
        onClick={() => {
          tapsRef.current += 1;
          hlog("AR", `tap #${tapsRef.current} on upper-right box`);
          setTaps(tapsRef.current);
        }}
      />
      {/* Auto-bound plane: a box sits at the plane origin once detected. */}
      <ViroARPlane
        minWidth={0.1}
        minHeight={0.1}
        onAnchorFound={(a: any) => hlog("AR", "plane bound", a.anchorId, a.width, a.height)}
      >
        <ViroBox position={[0, 0.05, 0]} scale={[0.1, 0.1, 0.1]} materials={["redBox"]} />
      </ViroARPlane>
    </ViroARScene>
  );
}

// Input demo — driven by ViroSceneNavigator (a real scene stack) plus the
// virtual joystick/button DOM overlays. The scene reads the shared controller
// state via useVirtualController: the left stick moves the box, button "A"
// recolors it. A tappable "next" box pushes a second scene to exercise
// push/pop navigation.
function InputSceneA(props: { sceneNavigator?: any }) {
  const controller = useVirtualController("p1");
  const { x, y } = controller.left;
  const pressedA = !!controller.buttons.A;
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroDirectionalLight color="#ffffff" intensity={900} direction={[0, -1, -0.6]} />
      {/* Joystick-driven box (moves with the left stick, recolors on button A). */}
      <ViroBox
        position={[x * 2.5, y * 2.5, -5]}
        scale={[0.6, 0.6, 0.6]}
        materials={[pressedA ? "redBox" : "blueBox"]}
      />
      {/* Tappable box → push scene B (demonstrates the navigator's scene stack). */}
      <ViroBox
        position={[0, -2.5, -5]}
        scale={[0.4, 0.4, 0.4]}
        materials={["checker"]}
        onClick={() => {
          console.log("[harness input] push scene B");
          props.sceneNavigator?.push({ scene: InputSceneB });
        }}
      />
      <ViroText
        position={[0, 3, -5]}
        width={6}
        height={1}
        text="Scene A — joystick moves the box, tap bottom box to push"
        style={{ fontSize: 22, color: "#ffffff", textAlign: "Center" }}
      />
    </ViroScene>
  );
}

function InputSceneB(props: { sceneNavigator?: any }) {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroDirectionalLight color="#ffffff" intensity={900} direction={[0, -1, -0.6]} />
      <ViroBox
        position={[0, 0, -5]}
        materials={["redBox"]}
        animation={{ name: "spin", run: true, loop: true }}
        onClick={() => {
          console.log("[harness input] pop back to scene A");
          props.sceneNavigator?.pop();
        }}
      />
      <ViroText
        position={[0, 2.5, -5]}
        width={6}
        height={1}
        text="Scene B — tap the box to pop back"
        style={{ fontSize: 22, color: "#ffdd44", textAlign: "Center" }}
      />
    </ViroScene>
  );
}

// Minimal imperative-handle shape for the camera capture API (the full type,
// ViroCameraTextureHandle, lives in the .web module which tsc doesn't resolve
// from the extension-less import here).
type CameraHandle = {
  capturePhoto(): Promise<{ success: boolean; url?: string; error?: string }>;
  startRecording(): Promise<{ success: boolean; url?: string; error?: string }>;
  stopRecording(): Promise<{ success: boolean; url?: string; error?: string }>;
};

// Camera demo — ViroCameraTexture binds the live feed to the "cameraFeed"
// material shown on a quad; the capture buttons (DOM overlay) call the
// component's imperative API through a ref passed in via viroAppProps.
function CameraScene(props: { cameraRef?: React.Ref<CameraHandle> }) {
  return (
    <ViroScene>
      <ViroQuad position={[0, 0, -2.2]} width={1.8} height={2.4} materials={["cameraFeed"]} />
      <ViroCameraTexture
        ref={props.cameraRef}
        material="cameraFeed"
        cameraPosition="front"
        onCameraReady={() => console.log("[harness camera] camera ready")}
        onError={(e) => console.error("[harness camera] error", e.nativeEvent.error)}
      />
    </ViroScene>
  );
}

const MODES = ["3d", "ar", "studio", "input", "camera"] as const;
type Mode = (typeof MODES)[number];

const paramMode = params.get("mode")?.toLowerCase();
const initialMode: Mode = MODES.includes(paramMode as Mode) ? (paramMode as Mode) : "3d";
const MODE_LABEL: Record<Mode, string> = {
  "3d": "3D",
  ar: "AR",
  studio: "Studio",
  input: "Input",
  camera: "Camera",
};

// Studio scene fixture (no backend): rendered through the web host to validate
// that Studio-authored scenes play on web via our renderer + runtime.
// Studio mode. Without ?scene= it renders the local fixture (no backend); with
// ?scene=<uuid>&key=<apiKey> it fetches the real scene the way native does.
const sceneParam = params.get("scene");
const apiKeyParam = params.get("key");
/** ?base=<url>: platform origin, for staging. Native's is fixed to production. */
const platformBase = (params.get("base") ?? "https://platform.reactvision.xyz").replace(/\/+$/, "");
/** ?ticker=1: start the parent re-render ticker on load. */
const tickerOnLoad = params.get("ticker") === "1";

const studioScene = makeStudioScene({
  modelUrl: helmetUrl,
  imageUrl: checkerUrl,
  alphaImageUrl: makeTransparentBorderPngDataUrl(),
  // A path under /models/ with an extension, so Vite answers 404 rather than
  // the SPA fallback page.
  missingModelUrl: "/models/__missing__.glb",
  extraModelUrl: glbParam ?? undefined,
});

/** Fetch failures that never reach an HTTP status: CORS or the network. */
function describeFetchFailure(url: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    `fetch ${shortUrl(url)} failed with no HTTP status (${msg}). ` +
    `From a browser that is almost always CORS: the platform did not allow ` +
    `this origin or the x-api-key header in its preflight.`
  );
}

/**
 * Mirrors native VRTStudioModule.rvGetScene: GET
 * {base}/functions/v1/scenes/{id} with `x-api-key: <RVApiKey>`, body is the
 * StudioSceneResponse JSON. Also serves NAVIGATION to other scenes.
 */
async function fetchStudioScene(sceneId: string): Promise<StudioSceneResponse> {
  const url = `${platformBase}/functions/v1/scenes/${encodeURIComponent(sceneId)}`;
  if (!apiKeyParam) {
    const e = new Error("?scene= needs ?key=<apiKey> as well");
    herr("studio", e.message);
    throw e;
  }
  hlog("studio", `GET ${url}`);
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(url, { headers: { "x-api-key": apiKeyParam } });
  } catch (e) {
    herr("studio", describeFetchFailure(url, e));
    throw e;
  }
  const body = await res.text();
  const ms = Math.round(performance.now() - started);
  hlog("studio", `HTTP ${res.status} in ${ms} ms, ${body.length} bytes`);
  if (!res.ok) {
    herr("studio", body.slice(0, 240));
    throw new Error(`GET scene ${sceneId}: HTTP ${res.status}`);
  }
  const data = JSON.parse(body) as StudioSceneResponse;
  hlog(
    "studio",
    `scene "${data.scene?.name}": ${data.assets?.length ?? 0} assets, plane_detection ${data.scene?.plane_detection}`,
  );
  return data;
}

/**
 * API_REQUEST transport. With a key it mirrors native rvStudioApiRequest (POST
 * {base}/functions/v1/scene-api-request, {function_id, variables}); without
 * one (the fixture) it answers a canned success.
 */
async function studioApiRequestExecutor(
  functionId: string,
  variables: Record<string, boolean | number | string>,
) {
  if (!apiKeyParam) {
    hlog("studio", `API_REQUEST ${functionId} (stubbed)`);
    return { ok: true, status: 200, body: {} };
  }
  const url = `${platformBase}/functions/v1/scene-api-request`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKeyParam },
      body: JSON.stringify({ function_id: functionId, variables }),
    });
    hlog("studio", `API_REQUEST ${functionId}: HTTP ${res.status}`);
    const envelope = await res.json().catch(() => ({}));
    return {
      ok: envelope.ok === true,
      status: typeof envelope.status === "number" ? envelope.status : null,
      body: envelope.body,
      error_code: envelope.error_code ?? (res.ok ? null : "NETWORK_ERROR"),
      error_message: envelope.error_message ?? null,
    };
  } catch (e) {
    herr("studio", describeFetchFailure(url, e));
    return { ok: false, status: null, error_code: "NETWORK_ERROR", error_message: String(e) };
  }
}

/**
 * Studio mode host. The ticker re-renders this component (and so hands the
 * navigator fresh inline callbacks) every 500 ms; the scene must still mount
 * exactly once (W8). Two counters make that visible: onSceneReady, which the
 * scene fires from its mount effect, and <canvas> elements added under the
 * navigator, which counts renderer remounts.
 */
function StudioHost() {
  const [ticking, setTicking] = useState(tickerOnLoad);
  const [renders, setRenders] = useState(0);
  const [ready, setReady] = useState(0);
  const [canvases, setCanvases] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setRenders((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const count = (nodes: NodeList) => {
      let n = 0;
      nodes.forEach((node) => {
        if (node instanceof HTMLCanvasElement) n++;
        else if (node instanceof Element) n += node.querySelectorAll("canvas").length;
      });
      return n;
    };
    setCanvases(el.querySelectorAll("canvas").length);
    const mo = new MutationObserver((records) => {
      let added = 0;
      for (const r of records) added += count(r.addedNodes);
      if (added) setCanvases((n) => n + added);
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    setStatus("scene mounts", `${ready} (onSceneReady; must stay 1)`);
    setStatus("canvas mounts", canvases);
    setStatus("parent renders", `${renders} (ticker ${ticking ? "on" : "off"})`);
  }, [ready, canvases, renders, ticking]);

  // Passed straight through; StudioSceneNavigator.web may not forward it yet.
  const passThrough: Record<string, unknown> = { onMotionUnavailable };

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
      <button
        data-testid="ticker-toggle"
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          padding: "8px 14px",
          borderRadius: 999,
          border: "none",
          background: ticking ? "#b23" : "#111",
          color: "#fff",
          font: "600 13px system-ui, sans-serif",
        }}
        onClick={() => setTicking((t) => !t)}
      >
        {ticking ? "ticker: on" : "ticker: off"}
      </button>
      <StudioSceneNavigator
        {...(sceneParam
          ? { sceneId: sceneParam, loadScene: fetchStudioScene }
          : { sceneData: studioScene, loadScene: async () => studioScene })}
        apiRequestExecutor={studioApiRequestExecutor}
        webRendererOptions={webRendererOptions}
        slamScriptUrl="/tinyvio-slam.js"
        onSessionReady={onARSessionReady}
        onSceneReady={() => {
          setReady((n) => n + 1);
          hlog("studio", "onSceneReady");
        }}
        onSceneLoaded={(d: StudioSceneResponse) => hlog("studio", `loaded "${d.scene?.name}"`)}
        onSceneChange={(id: string, name: string) => hlog("studio", `scene change → ${name} (${id})`)}
        onError={(e: Error) => herr("studio", "scene error:", e)}
        onAssetError={(asset: any, error: Error) =>
          herr("studio", `onAssetError "${asset?.name}" (${shortUrl(asset?.file_url ?? "")}):`, error)
        }
        onRendererAbort={(err: Error) => herr("studio", "onRendererAbort:", err)}
        onUnsupported={(f: string[]) => hlog("studio", "unsupported:", f.join(", "))}
        renderError={(e: Error) => (
          <div style={{ color: "#ff8a80", padding: 60, font: "500 14px system-ui" }}>
            Studio error: {e.message}
          </div>
        )}
        {...passThrough}
      />
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => {
    clearStatus();
    stopFeedWatch?.();
    lastTracking = null;
    hlog("mode", mode);
    // Keep the URL in step so a reload (or a copied link) lands on this mode.
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState(null, "", url);
  }, [mode]);
  const cameraRef = useRef<CameraHandle>(null);
  const [captureMsg, setCaptureMsg] = useState<string>("");

  const overlayBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    font: "600 13px system-ui, sans-serif",
    cursor: "pointer",
  };

  const onCapturePhoto = async () => {
    const r = await cameraRef.current?.capturePhoto();
    setCaptureMsg(r?.success ? `foto: ${(r.url ?? "").slice(0, 32)}…` : `error: ${r?.error}`);
    console.log("[harness camera] capturePhoto", r);
  };
  const onStartRec = async () => {
    const r = await cameraRef.current?.startRecording();
    setCaptureMsg(r?.success ? "grabando…" : `error: ${r?.error}`);
    console.log("[harness camera] startRecording", r);
  };
  const onStopRec = async () => {
    const r = await cameraRef.current?.stopRecording();
    setCaptureMsg(r?.success ? `video: ${(r.url ?? "").slice(0, 32)}…` : `error: ${r?.error}`);
    console.log("[harness camera] stopRecording", r);
  };

  const toggle: React.CSSProperties = {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    padding: "8px 16px",
    borderRadius: 999,
    border: "none",
    background: "#111",
    color: "#fff",
    font: "600 13px system-ui, sans-serif",
    cursor: "pointer",
  };

  const next = () => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <button style={toggle} onClick={next}>
        {`Modo: ${MODE_LABEL[mode]} →`}
      </button>
      <HarnessPanels />
      {mode === "3d" && (
        <Viro3DSceneNavigator initialScene={{ scene: DemoScene }} webRendererOptions={webRendererOptions} />
      )}
      {mode === "ar" && (
        <ViroARSceneNavigator
          initialScene={{ scene: ARDemoScene }}
          webRendererOptions={webRendererOptions}
          slamScriptUrl="/tinyvio-slam.js"
          arOptions={{ detectPlanes: true }}
          onSessionReady={onARSessionReady}
          onMotionUnavailable={onMotionUnavailable}
        />
      )}
      {mode === "studio" && (
        <StudioHost />
      )}
      {mode === "input" && (
        <>
          <ViroSceneNavigator
            initialScene={{ scene: InputSceneA }}
            webRendererOptions={webRendererOptions}
          />
          {/* DOM overlays: write to controller "p1", read by the scene's hook. */}
          <ViroVirtualJoystick
            controllerId="p1"
            stickSide="left"
            radius={60}
            style={{ position: "absolute", bottom: 40, left: 40, zIndex: 20 }}
          />
          <ViroVirtualButton
            controllerId="p1"
            button="A"
            size={64}
            style={{ position: "absolute", bottom: 56, right: 56, zIndex: 20 }}
          />
        </>
      )}
      {mode === "camera" && (
        <>
          <Viro3DSceneNavigator
            initialScene={{ scene: CameraScene }}
            viroAppProps={{ cameraRef }}
            webRendererOptions={webRendererOptions}
          />
          <div
            style={{
              position: "absolute",
              bottom: 32,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 12,
              alignItems: "center",
              zIndex: 20,
            }}
          >
            <button style={overlayBtn} onClick={onCapturePhoto}>
              📸 Foto
            </button>
            <button style={overlayBtn} onClick={onStartRec}>
              ⏺ Grabar
            </button>
            <button style={overlayBtn} onClick={onStopRec}>
              ⏹ Detener
            </button>
            {captureMsg && (
              <span style={{ color: "#fff", font: "500 12px system-ui", opacity: 0.8 }}>
                {captureMsg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
