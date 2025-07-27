/**
 * ViroFabricContainer
 *
 * This is the main container component that Fabric manages directly.
 * It serves as a viewport for the Viro rendering engine and delegates
 * rendering to the existing native implementation.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  Platform,
  View,
  Text,
  NativeEventEmitter,
  NativeModules,
} from "react-native";

// Check if New Architecture is enabled
const isNewArchitectureEnabled = () => {
  if (global.__turboModuleProxy == null) {
    throw new Error(
      "Viro: New Architecture is not enabled. This library requires React Native New Architecture. " +
        "Please enable it in your app by following the instructions at: " +
        "https://reactnative.dev/docs/new-architecture-intro"
    );
  }

  // We're assuming the minimum supported version (0.76.9+) since this is a Fabric-only component
  return true;
};

// Check if the component exists in UIManager
const isFabricComponentAvailable = () => {
  isNewArchitectureEnabled(); // This will throw if New Architecture is not enabled

  if (
    !UIManager.getViewManagerConfig ||
    UIManager.getViewManagerConfig("ViroFabricContainerView") == null
  ) {
    throw new Error(
      "ViroFabricContainerView is not available. Make sure you have installed the native module properly."
    );
  }

  return true;
};

// Define the native component
// @ts-ignore - TypeScript doesn't know about the props of the native component
const NativeViroFabricContainer = requireNativeComponent<any>(
  "ViroFabricContainerView"
);

// Props for the container
export interface ViroFabricContainerProps {
  // General props
  debug?: boolean;
  style?: React.CSSProperties;

  // AR specific props
  arEnabled?: boolean;
  autofocus?: boolean;
  worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
  videoQuality?: "High" | "Low";

  // Event callbacks
  onInitialized?: (success: boolean) => void;
  onTrackingUpdated?: (state: any) => void;
  onCameraTransformUpdate?: (transform: any) => void;
  onARSessionFailed?: (error: string) => void;

  // Scene management callbacks
  onSceneStateChanged?: (event: { sceneId: string; state: string }) => void;
  onMemoryWarning?: (event: { memoryStats: Record<string, any> }) => void;

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroFabricContainer is the main component that hosts the Viro rendering engine.
 * It creates a native view that the Viro renderer can draw on and manages the
 * lifecycle of the Viro system.
 */
export const ViroFabricContainer: React.FC<ViroFabricContainerProps> = ({
  debug = false,
  arEnabled = false,
  worldAlignment = "Gravity",
  onInitialized,
  onTrackingUpdated,
  onCameraTransformUpdate,
  onSceneStateChanged,
  onMemoryWarning,
  children,
}) => {
  // Reference to the native component
  const containerRef = useRef<any>(null);

  // Root node ID for the scene
  const rootNodeId = useRef<string>("viro_root_scene");

  // Event callback registry
  const eventCallbacks = useRef<Record<string, (event: any) => void>>({});

  // Set up event handling for JSI and fallback event emitter approach
  useEffect(() => {
    // Set up global event handler for JSI events
    if (typeof global !== "undefined") {
      // @ts-ignore - This property will be added by the native code
      global.handleViroEvent = (callbackId: string, eventData: any) => {
        // Find the callback in the registry and call it
        const callback = eventCallbacks.current[callbackId];
        if (callback) {
          callback(eventData);
        } else {
          console.warn(`No callback found for ID: ${callbackId}`);
        }
      };
    }

    // Set up event emitter for fallback approach
    const eventEmitter = new NativeEventEmitter(
      NativeModules.ViroFabricManager
    );

    // Add the ViroEvent listener
    const subscription = eventEmitter.addListener("ViroEvent", (event) => {
      const { callbackId, data } = event;
      const callback = eventCallbacks.current[callbackId];
      if (callback) {
        callback(data);
      } else {
        console.warn(
          `No callback found for ID: ${callbackId} (via event emitter)`
        );
      }
    });

    return () => {
      // Clean up event subscription
      subscription.remove();

      // Clean up global event handler
      if (typeof global !== "undefined") {
        // @ts-ignore - This property was added by us
        delete global.handleViroEvent;
      }
    };
  }, []);

  // Initialize the Viro system when the component mounts
  useEffect(() => {
    if (containerRef.current && isFabricComponentAvailable()) {
      const nodeHandle = findNodeHandle(containerRef.current);
      if (!nodeHandle) {
        console.error("Failed to get node handle for ViroFabricContainer");
        return;
      }

      try {
        // Use the codegenNativeCommands approach for New Architecture
        const ViroFabricContainerCommands = UIManager.getViewManagerConfig(
          "ViroFabricContainerView"
        ).Commands;

        if (!ViroFabricContainerCommands) {
          console.error(
            "ViroFabricContainerView commands not found in UIManager"
          );
          return;
        }

        // Call the native method to initialize
        UIManager.dispatchViewManagerCommand(
          nodeHandle,
          ViroFabricContainerCommands.initialize,
          [debug || false, arEnabled || false, worldAlignment || "Gravity"]
        );
      } catch (error) {
        console.error("Failed to initialize ViroFabricContainer:", error);
      }
    }

    // Cleanup when unmounting
    return () => {
      if (containerRef.current) {
        const nodeHandle = findNodeHandle(containerRef.current);
        if (!nodeHandle) return;

        try {
          // Use the same approach as initialize for cleanup
          const ViroFabricContainerCommands = UIManager.getViewManagerConfig(
            "ViroFabricContainerView"
          ).Commands;

          if (
            !ViroFabricContainerCommands ||
            !ViroFabricContainerCommands.cleanup
          ) {
            console.error(
              "ViroFabricContainerView cleanup command not found in UIManager"
            );
            return;
          }

          // Call the native method to cleanup
          UIManager.dispatchViewManagerCommand(
            nodeHandle,
            ViroFabricContainerCommands.cleanup,
            []
          );
        } catch (error) {
          console.error("Failed to cleanup ViroFabricContainer:", error);
        }
      }
    };
  }, [debug, arEnabled, worldAlignment]);

  // Handle initialization event
  const handleInitialized = (event: any) => {
    if (onInitialized) {
      onInitialized(event.nativeEvent.success);
    }
  };

  // Handle tracking updated event
  const handleTrackingUpdated = (event: any) => {
    if (onTrackingUpdated) {
      onTrackingUpdated(event.nativeEvent);
    }
  };

  // Handle camera transform update event
  const handleCameraTransformUpdate = (event: any) => {
    if (onCameraTransformUpdate) {
      onCameraTransformUpdate(event.nativeEvent);
    }
  };

  // Handle scene state changed event
  const handleSceneStateChanged = (event: any) => {
    if (onSceneStateChanged) {
      onSceneStateChanged(event.nativeEvent);
    }
  };

  // Handle memory warning event
  const handleMemoryWarning = (event: any) => {
    if (onMemoryWarning) {
      onMemoryWarning(event.nativeEvent);
    }
  };

  // This will throw an error if the native component is not available or New Architecture is not enabled
  isFabricComponentAvailable();

  return (
    <NativeViroFabricContainer
      ref={containerRef}
      style={{ flex: 1 }}
      onInitialized={handleInitialized}
      onTrackingUpdated={handleTrackingUpdated}
      onCameraTransformUpdate={handleCameraTransformUpdate}
      onSceneStateChanged={handleSceneStateChanged}
      onMemoryWarning={handleMemoryWarning}
    >
      {children}
    </NativeViroFabricContainer>
  );
};
