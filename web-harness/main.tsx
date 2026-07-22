/**
 * Web bridge harness: renders a Viro3DSceneNavigator with a ViroBox through the
 * real Viro component bridge (.web.tsx) → WASM C API. Validates the vertical
 * slice end-to-end. Import components directly (not the package index) to avoid
 * pulling in native-only modules.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// Load the WASM assets the Vite way: ?url gives each file's served URL without
// transforming it. importGlue dynamically imports the glue module from its URL;
// locateFile points the glue at the .wasm/.data URLs.
import glueUrl from "./wasm/viro-web.js?url";
import wasmUrl from "./wasm/viro-web.wasm?url";
import dataUrl from "./wasm/viro-web.data?url";

const webRendererOptions = {
  importGlue: () => import(/* @vite-ignore */ glueUrl),
  locateFile: (path: string) => {
    if (path.endsWith(".wasm")) return wasmUrl;
    if (path.endsWith(".data")) return dataUrl;
    return path;
  },
};

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
import { makeStudioScene } from "./studioFixture";
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
// without shipping an image asset.
function makeCheckerDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const cells = 8;
  const s = canvas.width / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#ffffff" : "#3399ff";
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  return canvas.toDataURL();
}

const checkerUrl = makeCheckerDataUrl();

ViroMaterials.createMaterials({
  blueBox: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
  redBox: { lightingModel: "Blinn", diffuseColor: "#ff5533" },
  checker: { lightingModel: "Lambert", diffuseTexture: makeCheckerDataUrl() },
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

const MODES = ["3d", "ar", "studio"] as const;
type Mode = (typeof MODES)[number];
const MODE_LABEL: Record<Mode, string> = { "3d": "3D", ar: "AR", studio: "Studio" };

// Studio scene fixture (no backend): rendered through the web host to validate
// that Studio-authored scenes play on web via our renderer + runtime.
const studioScene = makeStudioScene({ modelUrl: helmetUrl, imageUrl: checkerUrl });
const studioApiRequestExecutor = async () => ({ ok: true, status: 200, body: {} });

function App() {
  const [mode, setMode] = useState<Mode>("3d");

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
          slamScriptUrl="/slam_wasm.js"
          // renderWhileLimited: desktop has no IMU so slam stays "Limited"; force
          // render so the scene shows. On a real mobile device, drop this.
          arOptions={{ detectPlanes: true, renderWhileLimited: true }}
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
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
