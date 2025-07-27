/**
 * ViroSceneNavigator
 *
 * A component for rendering 3D scenes.
 */

import React, { useState, useEffect } from "react";
import { ViroFabricContainer } from "../ViroFabricContainer";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSceneNavigatorProps {
  // Scene properties
  initialScene: {
    scene: React.ComponentType<any>;
  };

  // Camera properties
  hdrEnabled?: boolean;
  pbrEnabled?: boolean;
  bloomEnabled?: boolean;
  shadowsEnabled?: boolean;
  multisamplingEnabled?: boolean;

  // Events
  onCameraTransformUpdate?: (transform: any) => void;

  // Style
  style?: React.CSSProperties;
}

/**
 * ViroSceneNavigator is a component for rendering 3D scenes.
 * It provides a container for 3D scenes and handles the scene lifecycle.
 */
export const ViroSceneNavigator: React.FC<ViroSceneNavigatorProps> = (
  props
) => {
  const [apiKey] = useState<string>(() => {
    // Generate a random API key for demo purposes
    return `viro-${Math.random().toString(36).substring(2, 15)}`;
  });

  // Initialize scene
  useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    // Initialize Viro
    nativeViro.initialize();

    // Cleanup when unmounting
    return () => {
      // Cleanup code here
    };
  }, []);

  // Create the scene component
  const SceneComponent = props.initialScene.scene;

  // Render the 3D scene
  return (
    <ViroFabricContainer
      style={props.style}
      debug={false}
      arEnabled={false}
      onCameraTransformUpdate={props.onCameraTransformUpdate}
    >
      <SceneComponent />
    </ViroFabricContainer>
  );
};
