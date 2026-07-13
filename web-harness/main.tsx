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
import { ViroNode } from "../components/ViroNode";
import { ViroMaterials } from "../components/Material/ViroMaterials";

ViroMaterials.createMaterials({
  blueBox: { lightingModel: "Blinn", diffuseColor: "#3399ff" },
  redBox: { lightingModel: "Blinn", diffuseColor: "#ff5533" },
});

function DemoScene() {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAngle((a) => a + 2), 16);
    return () => clearInterval(id);
  }, []);

  return (
    <ViroScene>
      <ViroNode position={[0, 0, -5]}>
        <ViroBox
          scale={[1.5, 1.5, 1.5]}
          rotation={[0, angle, 0]}
          materials={["blueBox"]}
        />
        <ViroBox
          position={[2.5, 0, 0]}
          rotation={[angle, angle, 0]}
          materials={["redBox"]}
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
