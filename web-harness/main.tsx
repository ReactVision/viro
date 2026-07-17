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
import { ViroScene } from "../components/ViroScene";
import { ViroBox } from "../components/ViroBox";
import { ViroSurface } from "../components/ViroSurface";
import { ViroNode } from "../components/ViroNode";
import { Viro3DObject } from "../components/Viro3DObject";
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
      </ViroNode>
    </ViroScene>
  );
}

function App() {
  return (
    <Viro3DSceneNavigator
      initialScene={{ scene: DemoScene }}
      webRendererOptions={webRendererOptions}
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
