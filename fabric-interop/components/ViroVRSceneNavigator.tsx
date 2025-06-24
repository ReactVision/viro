/**
 * ViroVRSceneNavigator
 *
 * A component for rendering VR scenes.
 */

import React, { useState, useEffect } from "react";
import { ViroFabricContainer } from "../ViroFabricContainer";
import { getNativeViro } from "./ViroGlobal";

export interface ViroVRSceneNavigatorProps {
  // Scene properties
  initialScene: {
    scene: React.ComponentType<any>;
  };

  // VR properties
  vrModeEnabled?: boolean;

  // Camera properties
  hdrEnabled?: boolean;
  pbrEnabled?: boolean;
  bloomEnabled?: boolean;
  shadowsEnabled?: boolean;
  multisamplingEnabled?: boolean;

  // Events
  onCameraTransformUpdate?: (transform: any) => void;
  onExitViro?: () => void;

  // Style
  style?: React.CSSProperties;
}

/**
 * ViroVRSceneNavigator is a component for rendering VR scenes.
 * It provides a container for VR scenes and handles the VR session lifecycle.
 */
export const ViroVRSceneNavigator: React.FC<ViroVRSceneNavigatorProps> = (
  props
) => {
  const [apiKey] = useState<string>(() => {
    // Generate a random API key for demo purposes
    return `viro-${Math.random().toString(36).substring(2, 15)}`;
  });

  // Initialize VR scene
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

  // Render the VR scene
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
