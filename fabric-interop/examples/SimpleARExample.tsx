/**
 * SimpleARExample
 *
 * A simple example of using the Viro Fabric interop layer for AR.
 */

import React, { useEffect } from "react";
import {
  ViroARSceneNavigator,
  ViroARScene,
  ViroBox,
  ViroText,
  ViroMaterials,
  ViroARTrackingTargets,
  ViroARImageMarker,
} from "../components";

// Register materials
ViroMaterials.registerMaterials({
  grid: {
    diffuseColor: "#0000FF",
    diffuseTexture: require("./assets/grid_bg.jpg"),
  },
  text: {
    diffuseColor: "#FFFFFF",
  },
});

// Register AR tracking targets
ViroARTrackingTargets.registerTargets({
  logo: {
    source: require("./assets/viro_logo.png"),
    orientation: "Up",
    physicalWidth: 0.1, // 10cm
  },
});

// Main AR scene component
const ARScene = () => {
  // Handle tracking state updates
  const onTrackingUpdated = (state: { state: string; reason?: string }) => {
    console.log("Tracking state updated:", state);
  };

  // Handle anchor found event
  const onAnchorFound = () => {
    console.log("Anchor found!");
  };

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      {/* A simple 3D box floating 1 meter in front of the user */}
      <ViroBox
        position={[0, 0, -1]}
        scale={[0.1, 0.1, 0.1]}
        materials={["grid"]}
      />

      {/* Text above the box */}
      <ViroText
        text="Hello Viro!"
        position={[0, 0.1, -1]}
        scale={[0.1, 0.1, 0.1]}
        color="#FFFFFF"
        fontWeight="bold"
        materials={["text"]}
      />

      {/* Image marker that places content when detected */}
      <ViroARImageMarker target="logo" onAnchorFound={onAnchorFound}>
        <ViroBox
          position={[0, 0.1, 0]}
          scale={[0.05, 0.05, 0.05]}
          materials={["grid"]}
        />
      </ViroARImageMarker>
    </ViroARScene>
  );
};

// Main app component
export const SimpleARExample = () => {
  return (
    <ViroARSceneNavigator
      initialScene={{
        scene: ARScene,
      }}
      style={{ flex: 1 }}
      worldAlignment="Gravity"
      planeDetection={{ horizontal: true, vertical: true }}
    />
  );
};

export default SimpleARExample;
