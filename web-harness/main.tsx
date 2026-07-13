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
import { ViroSphere } from "../components/ViroSphere";
import { ViroSurface } from "../components/ViroSurface";
import { ViroNode } from "../components/ViroNode";
import { ViroAmbientLight } from "../components/ViroAmbientLight";
import { ViroDirectionalLight } from "../components/ViroDirectionalLight";
import { ViroMaterials } from "../components/Material/ViroMaterials";

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
        <ViroBox
          scale={[1.5, 1.5, 1.5]}
          rotation={[0, angle, 0]}
          materials={[tapped ? "redBox" : "blueBox"]}
          onClick={() => {
            console.log("[harness] box clicked");
            setTapped((t) => !t);
          }}
          onHover={(isHovering) => console.log("[harness] hover:", isHovering)}
        />
        <ViroBox
          position={[2.5, 0, 0]}
          rotation={[angle, angle, 0]}
          materials={["redBox"]}
        />
        <ViroSphere
          position={[-2.5, 0, 0]}
          radius={0.9}
          materials={["blueBox"]}
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
