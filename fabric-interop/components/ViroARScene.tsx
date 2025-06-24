/**
 * ViroARScene
 *
 * A specialized scene for AR content that uses the device's camera as a background.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroARSceneProps extends ViroCommonProps {
  // AR-specific props
  anchorDetectionTypes?: ("PlanesHorizontal" | "PlanesVertical" | "Faces")[];
  planeDetectionEnabled?: boolean;

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Physics props
  physicsWorld?: {
    gravity?: [number, number, number];
  };

  // Post-processing props
  postProcessEffects?: string[];

  // Event callbacks
  onTrackingUpdated?: (event: any) => void;
  onAmbientLightUpdate?: (event: any) => void;
  onPlatformUpdate?: (event: any) => void;
  onCameraTransformUpdate?: (event: any) => void;
  onAnchorFound?: (event: any) => void;
  onAnchorUpdated?: (event: any) => void;
  onAnchorRemoved?: (event: any) => void;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroARScene is a specialized scene for AR content that uses the device's camera as a background.
 */
export const ViroARScene: React.FC<ViroARSceneProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    anchorDetectionTypes: props.anchorDetectionTypes,
    planeDetectionEnabled: props.planeDetectionEnabled,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
    physicsWorld: props.physicsWorld,
    postProcessEffects: props.postProcessEffects,
    onTrackingUpdated: props.onTrackingUpdated ? true : undefined,
    onAmbientLightUpdate: props.onAmbientLightUpdate ? true : undefined,
    onPlatformUpdate: props.onPlatformUpdate ? true : undefined,
    onCameraTransformUpdate: props.onCameraTransformUpdate ? true : undefined,
    onAnchorFound: props.onAnchorFound ? true : undefined,
    onAnchorUpdated: props.onAnchorUpdated ? true : undefined,
    onAnchorRemoved: props.onAnchorRemoved ? true : undefined,
  };

  // Create the AR scene node - this is a root node, so no parent
  const nodeId = useViroNode("arScene", nativeProps);

  // Register event handlers
  React.useEffect(() => {
    const nativeViro = getNativeViro();
    if (!nativeViro) return;

    // Register event handlers if provided
    const eventHandlers = [
      { name: "onTrackingUpdated", handler: props.onTrackingUpdated },
      { name: "onAmbientLightUpdate", handler: props.onAmbientLightUpdate },
      { name: "onPlatformUpdate", handler: props.onPlatformUpdate },
      {
        name: "onCameraTransformUpdate",
        handler: props.onCameraTransformUpdate,
      },
      { name: "onAnchorFound", handler: props.onAnchorFound },
      { name: "onAnchorUpdated", handler: props.onAnchorUpdated },
      { name: "onAnchorRemoved", handler: props.onAnchorRemoved },
    ];

    // Register all event handlers
    const registeredCallbacks = eventHandlers
      .filter(({ handler }) => !!handler)
      .map(({ name, handler }) => {
        const callbackId = `${nodeId}_${name}`;
        nativeViro.registerEventCallback(nodeId, name, callbackId);
        return { name, callbackId };
      });

    // Cleanup when unmounting
    return () => {
      const nativeViro = getNativeViro();
      if (!nativeViro) return;

      // Unregister all event handlers
      registeredCallbacks.forEach(({ name, callbackId }) => {
        nativeViro.unregisterEventCallback(nodeId, name, callbackId);
      });
    };
  }, [
    nodeId,
    props.onTrackingUpdated,
    props.onAmbientLightUpdate,
    props.onPlatformUpdate,
    props.onCameraTransformUpdate,
    props.onAnchorFound,
    props.onAnchorUpdated,
    props.onAnchorRemoved,
  ]);

  // Render children with this scene as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};

// Import ViroContextProvider at the top level to avoid circular dependencies
import { ViroContextProvider } from "./ViroUtils";
