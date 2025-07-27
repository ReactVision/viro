/**
 * BasicSceneExample
 *
 * A simple example demonstrating the new fabric-interop system with:
 * - Scene management and lifecycle
 * - Property system with individual setters
 * - Event system with JSI + fallback
 * - Memory management integration
 */

import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import {
  ViroFabricContainer,
  ViroScene,
  ViroBox,
  createMaterial,
  createAnimation,
  executeAnimation,
  getMemoryStats,
  performMemoryCleanup,
} from "../index";

export const BasicSceneExample: React.FC = () => {
  const [sceneActive, setSceneActive] = useState(false);
  const [memoryStats, setMemoryStats] = useState<Record<string, any> | null>(
    null
  );

  // Initialize materials and animations when component mounts
  useEffect(() => {
    // Create a red material for the box
    createMaterial("redMaterial", {
      diffuseColor: "#FF0000",
      shininess: 2.0,
      lightingModel: "Lambert",
    });

    // Create a blue material for the box
    createMaterial("blueMaterial", {
      diffuseColor: "#0000FF",
      shininess: 2.0,
      lightingModel: "Lambert",
    });

    // Create a rotation animation
    createAnimation("spinAnimation", {
      properties: {
        rotateY: "+=360",
      },
      duration: 2000,
      easing: "Linear",
    });

    // Create a scale animation
    createAnimation("pulseAnimation", {
      properties: {
        scaleX: 1.5,
        scaleY: 1.5,
        scaleZ: 1.5,
      },
      duration: 1000,
      easing: "EaseInEaseOut",
    });
  }, []);

  // Handle scene initialization
  const handleSceneInitialized = (success: boolean) => {
    console.log("Scene initialized:", success);
    setSceneActive(success);

    if (success) {
      Alert.alert("Success", "Viro scene initialized successfully!");
    } else {
      Alert.alert("Error", "Failed to initialize Viro scene");
    }
  };

  // Handle scene state changes
  const handleSceneStateChanged = (event: {
    sceneId: string;
    state: string;
  }) => {
    console.log("Scene state changed:", event);
  };

  // Handle memory warnings
  const handleMemoryWarning = (event: { memoryStats: Record<string, any> }) => {
    console.log("Memory warning received:", event.memoryStats);
    setMemoryStats(event.memoryStats);
    Alert.alert(
      "Memory Warning",
      `Memory usage: ${event.memoryStats.usedMemoryMB?.toFixed(1) || "N/A"} MB`
    );
  };

  // Handle box click
  const handleBoxClick = () => {
    Alert.alert("Box Clicked", "The red box was clicked!");

    // Execute spin animation
    executeAnimation("box1", "spinAnimation", {
      run: true,
      loop: false,
    });
  };

  // Handle box hover
  const handleBoxHover = (isHovering: boolean) => {
    console.log("Box hover:", isHovering);

    if (isHovering) {
      // Execute pulse animation on hover
      executeAnimation("box1", "pulseAnimation", {
        run: true,
        loop: false,
      });
    }
  };

  // Get current memory stats
  const checkMemoryStats = () => {
    const stats = getMemoryStats();
    setMemoryStats(stats);

    if (stats) {
      Alert.alert(
        "Memory Stats",
        `Total Scenes: ${stats.totalScenes || 0}\n` +
          `Active Scenes: ${stats.activeScenes || 0}\n` +
          `Managed Nodes: ${stats.managedNodes || 0}\n` +
          `Memory Usage: ${stats.usedMemoryMB?.toFixed(1) || "N/A"} MB`
      );
    } else {
      Alert.alert("Memory Stats", "Memory statistics not available");
    }
  };

  // Perform manual memory cleanup
  const cleanupMemory = () => {
    performMemoryCleanup();
    Alert.alert("Memory Cleanup", "Memory cleanup performed");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Viro Fabric Interop Example</Text>
      <Text style={styles.subtitle}>
        Demonstrating New Architecture compatibility
      </Text>

      <View style={styles.controls}>
        <Button
          title="Check Memory Stats"
          onPress={checkMemoryStats}
          disabled={!sceneActive}
        />
        <Button
          title="Cleanup Memory"
          onPress={cleanupMemory}
          disabled={!sceneActive}
        />
      </View>

      {memoryStats && (
        <View style={styles.stats}>
          <Text style={styles.statsTitle}>Memory Stats:</Text>
          <Text>Total Scenes: {memoryStats.totalScenes || 0}</Text>
          <Text>Active Scenes: {memoryStats.activeScenes || 0}</Text>
          <Text>Managed Nodes: {memoryStats.managedNodes || 0}</Text>
          <Text>
            Memory Usage: {memoryStats.usedMemoryMB?.toFixed(1) || "N/A"} MB
          </Text>
        </View>
      )}

      <ViroFabricContainer
        style={styles.viroContainer}
        debug={true}
        arEnabled={false}
        worldAlignment="Gravity"
        onInitialized={handleSceneInitialized}
        onSceneStateChanged={handleSceneStateChanged}
        onMemoryWarning={handleMemoryWarning}
      >
        <ViroScene
          onSceneLoadStart={() => console.log("Scene load started")}
          onSceneLoadEnd={() => console.log("Scene load ended")}
          onSceneError={(error) => console.error("Scene error:", error)}
        >
          {/* Red box with click and hover events */}
          <ViroBox
            position={[-1, 0, -3]}
            scale={[0.5, 0.5, 0.5]}
            materials={["redMaterial"]}
            onClick={handleBoxClick}
            onHover={(isHovering) => handleBoxHover(isHovering)}
            canClick={true}
            canHover={true}
          />

          {/* Blue box with different position */}
          <ViroBox
            position={[1, 0, -3]}
            scale={[0.5, 0.5, 0.5]}
            materials={["blueMaterial"]}
            onClick={() => Alert.alert("Blue Box", "Blue box clicked!")}
            canClick={true}
          />

          {/* Center box with animation */}
          <ViroBox
            position={[0, 1, -3]}
            scale={[0.3, 0.3, 0.3]}
            materials={["redMaterial"]}
            animation={{
              name: "spinAnimation",
              run: true,
              loop: true,
            }}
          />
        </ViroScene>
      </ViroFabricContainer>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Status: {sceneActive ? "Active" : "Initializing..."}
        </Text>
        <Text style={styles.footerText}>
          Features: Scene Management • Property System • Event System • Memory
          Management
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginBottom: 15,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  stats: {
    backgroundColor: "#fff",
    margin: 10,
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  statsTitle: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  viroContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  footer: {
    backgroundColor: "#333",
    padding: 10,
  },
  footerText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 12,
  },
});
