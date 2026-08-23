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
import { makeCheckerDataUrl, makeAnimatedGifDataUrl } from "./placeholderAssets";
import { ViroAmbientLight } from "../components/ViroAmbientLight";
import { ViroDirectionalLight } from "../components/ViroDirectionalLight";
import { ViroMaterials } from "../components/Material/ViroMaterials";
import { ViroAnimations } from "../components/Animation/ViroAnimations";

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

function DemoScene() {
  const [angle, setAngle] = useState(0);
  const [tapped, setTapped] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setAngle((a) => a + 2), 16);
    return () => clearInterval(id);
  }, []);

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
      <ViroNode position={[0, 0, -5]} rotation={[0, angle * 0.4, 0]}>
        {/* Loaded GLB model (PBR, self-contained) at the center. */}
        <Viro3DObject
          source={{ uri: helmetUrl }}
          type="GLB"
          scale={[1.6, 1.6, 1.6]}
          rotation={[0, angle, 0]}
          onLoadEnd={() => console.log("[harness] helmet loaded")}
          onError={(e) => console.error("[harness] helmet error", e)}
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
        {/* ViroText: font pipeline (preloaded Helvetica). */}
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

// AR demo: a cube fixed 1m ahead (proves pose tracking) + a ViroARPlane that
// binds to the first detected plane and drops a red box on it (proves the
// declarative plane API: slam planes → anchors → matched node transform).
function ARDemoScene() {
  return (
    <ViroARScene
      onTrackingUpdated={(state, reason) =>
        console.log("[harness AR] tracking", state, reason)
      }
      onAnchorFound={(a) => console.log("[harness AR] anchor found", a.anchorId, a.alignment)}
      onAnchorRemoved={(a) => console.log("[harness AR] anchor removed", a.anchorId)}
    >
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroDirectionalLight color="#ffffff" intensity={1000} direction={[0, -1, -0.6]} />
      {/* World-fixed cube for pose validation. */}
      <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} materials={["blueBox"]} />
      {/* Auto-bound plane: a box sits at the plane origin once detected. */}
      <ViroARPlane
        minWidth={0.1}
        minHeight={0.1}
        onAnchorFound={(a) => console.log("[harness AR] plane bound", a.anchorId, a.width, a.height)}
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
const MODE_LABEL: Record<Mode, string> = {
  "3d": "3D",
  ar: "AR",
  studio: "Studio",
  input: "Input",
  camera: "Camera",
};

// Studio scene fixture (no backend): rendered through the web host to validate
// that Studio-authored scenes play on web via our renderer + runtime.
const studioScene = makeStudioScene({ modelUrl: helmetUrl, imageUrl: checkerUrl });
const studioApiRequestExecutor = async () => ({ ok: true, status: 200, body: {} });

function App() {
  const [mode, setMode] = useState<Mode>("3d");
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
      {mode === "3d" && (
        <Viro3DSceneNavigator initialScene={{ scene: DemoScene }} webRendererOptions={webRendererOptions} />
      )}
      {mode === "ar" && (
        <ViroARSceneNavigator
          initialScene={{ scene: ARDemoScene }}
          webRendererOptions={webRendererOptions}
          slamScriptUrl="/tinyvio-slam.js"
          arOptions={{ detectPlanes: true }}
        />
      )}
      {mode === "studio" && (
        <StudioSceneNavigator
          sceneData={studioScene}
          loadScene={async () => studioScene}
          apiRequestExecutor={studioApiRequestExecutor}
          webRendererOptions={webRendererOptions}
          onSceneReady={() => console.log("[harness] studio scene ready")}
          onUnsupported={(f) => console.log("[harness] studio unsupported:", f)}
        />
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
