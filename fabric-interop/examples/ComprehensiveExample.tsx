/**
 * ComprehensiveExample
 *
 * A comprehensive example demonstrating the updated fabric-interop system with:
 * - Multiple component types (3D primitives, lights, text, images)
 * - Scene management and lifecycle
 * - Property system with individual setters
 * - Event system with JSI + fallback
 * - Memory management integration
 * - Material and animation management
 */

import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import {
  ViroFabricContainer,
  ViroScene,
  ViroBox,
  ViroSphere,
  ViroText,
  ViroImage,
  ViroQuad,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroSound,
  createMaterial,
  createAnimation,
  executeAnimation,
  getMemoryStats,
  performMemoryCleanup,
} from "../index";

export const ComprehensiveExample: React.FC = () => {
  const [sceneActive, setSceneActive] = useState(false);
  const [memoryStats, setMemoryStats] = useState<Record<string, any> | null>(
    null
  );
  const [selectedObject, setSelectedObject] = useState<string | null>(null);

  // Initialize materials and animations when component mounts
  useEffect(() => {
    // Create materials for different objects
    createMaterial("redMaterial", {
      diffuseColor: "#FF0000",
      shininess: 2.0,
      lightingModel: "Lambert",
    });

    createMaterial("blueMaterial", {
      diffuseColor: "#0000FF",
      shininess: 2.0,
      lightingModel: "Lambert",
    });

    createMaterial("greenMaterial", {
      diffuseColor: "#00FF00",
      shininess: 2.0,
      lightingModel: "Lambert",
    });

    createMaterial("textMaterial", {
      diffuseColor: "#FFFFFF",
      shininess: 1.0,
      lightingModel: "Lambert",
    });

    createMaterial("imageMaterial", {
      diffuseTexture: {
        uri: "https://via.placeholder.com/512x512/FF6B6B/FFFFFF?text=Viro",
      },
      lightingModel: "Lambert",
    });

    // Create animations
    createAnimation("spinAnimation", {
      properties: {
        rotateY: "+=360",
      },
      duration: 2000,
      easing: "Linear",
    });

    createAnimation("pulseAnimation", {
      properties: {
        scaleX: 1.5,
        scaleY: 1.5,
        scaleZ: 1.5,
      },
      duration: 1000,
      easing: "EaseInEaseOut",
    });

    createAnimation("bounceAnimation", {
      properties: {
        positionY: "+=0.5",
      },
      duration: 800,
      easing: "Bounce",
    });

    createAnimation("colorChangeAnimation", {
      properties: {
        materialDiffuseColor: "#FFFF00",
      },
      duration: 1500,
      easing: "EaseInEaseOut",
    });
  }, []);

  // Handle scene initialization
  const handleSceneInitialized = (success: boolean) => {
    console.log("Scene initialized:", success);
    setSceneActive(success);

    if (success) {
      Alert.alert("Success", "Comprehensive Viro scene initialized!");
    } else {
      Alert.alert("Error", "Failed to initialize Viro scene");
    }
  };

  // Handle object interactions
  const handleObjectClick = (objectName: string, objectType: string) => {
    setSelectedObject(objectName);
    Alert.alert(
      "Object Clicked",
      `${objectType} "${objectName}" was clicked!`,
      [
        {
          text: "Spin",
          onPress: () =>
            executeAnimation(objectName, "spinAnimation", {
              run: true,
              loop: false,
            }),
        },
        {
          text: "Pulse",
          onPress: () =>
            executeAnimation(objectName, "pulseAnimation", {
              run: true,
              loop: false,
            }),
        },
        {
          text: "Bounce",
          onPress: () =>
            executeAnimation(objectName, "bounceAnimation", {
              run: true,
              loop: false,
            }),
        },
        { text: "OK", style: "cancel" },
      ]
    );
  };

  const handleObjectHover = (objectName: string, isHovering: boolean) => {
    console.log(`${objectName} hover:`, isHovering);
    if (isHovering) {
      executeAnimation(objectName, "pulseAnimation", {
        run: true,
        loop: false,
      });
    }
  };

  // Memory management
  const checkMemoryStats = () => {
    const stats = getMemoryStats();
    setMemoryStats(stats);

    if (stats) {
      Alert.alert(
        "Memory Statistics",
        `Total Scenes: ${stats.totalScenes || 0}\n` +
          `Active Scenes: ${stats.activeScenes || 0}\n` +
          `Managed Nodes: ${stats.managedNodes || 0}\n` +
          `Memory Usage: ${stats.usedMemoryMB?.toFixed(1) || "N/A"} MB\n` +
          `Textures: ${stats.textureCount || 0}\n` +
          `Materials: ${stats.materialCount || 0}`
      );
    } else {
      Alert.alert("Memory Stats", "Memory statistics not available");
    }
  };

  const cleanupMemory = () => {
    performMemoryCleanup();
    Alert.alert("Memory Cleanup", "Memory cleanup performed successfully");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comprehensive Viro Example</Text>
      <Text style={styles.subtitle}>
        All Components • New Architecture • Complete Integration
      </Text>

      <View style={styles.controls}>
        <Button
          title="Memory Stats"
          onPress={checkMemoryStats}
          disabled={!sceneActive}
        />
        <Button
          title="Cleanup"
          onPress={cleanupMemory}
          disabled={!sceneActive}
        />
      </View>

      {selectedObject && (
        <View style={styles.selection}>
          <Text style={styles.selectionText}>Selected: {selectedObject}</Text>
        </View>
      )}

      {memoryStats && (
        <View style={styles.stats}>
          <Text style={styles.statsTitle}>Memory Stats:</Text>
          <Text>
            Scenes: {memoryStats.totalScenes || 0} | Nodes:{" "}
            {memoryStats.managedNodes || 0}
          </Text>
          <Text>
            Memory: {memoryStats.usedMemoryMB?.toFixed(1) || "N/A"} MB
          </Text>
        </View>
      )}

      <ViroFabricContainer
        style={styles.viroContainer}
        debug={true}
        arEnabled={false}
        worldAlignment="Gravity"
        onInitialized={handleSceneInitialized}
        onMemoryWarning={(event) => {
          Alert.alert(
            "Memory Warning",
            `Usage: ${event.memoryStats.usedMemoryMB?.toFixed(1)} MB`
          );
        }}
      >
        <ViroScene
          onSceneLoadStart={() => console.log("Comprehensive scene loading...")}
          onSceneLoadEnd={() => console.log("Comprehensive scene loaded!")}
        >
          {/* Lighting Setup */}
          <ViroAmbientLight color="#404040" intensity={0.4} />
          <ViroDirectionalLight
            color="#FFFFFF"
            direction={[0, -1, -0.2]}
            intensity={1.0}
            castsShadow={true}
          />

          {/* 3D Primitives Row */}
          <ViroBox
            position={[-2, 0, -4]}
            scale={[0.4, 0.4, 0.4]}
            materials={["redMaterial"]}
            onClick={() => handleObjectClick("redBox", "Box")}
            onHover={(isHovering) => handleObjectHover("redBox", isHovering)}
            canClick={true}
            canHover={true}
          />

          <ViroSphere
            position={[0, 0, -4]}
            radius={0.3}
            materials={["blueMaterial"]}
            onClick={() => handleObjectClick("blueSphere", "Sphere")}
            onHover={(isHovering) =>
              handleObjectHover("blueSphere", isHovering)
            }
            canClick={true}
            canHover={true}
          />

          <ViroBox
            position={[2, 0, -4]}
            scale={[0.4, 0.4, 0.4]}
            materials={["greenMaterial"]}
            onClick={() => handleObjectClick("greenBox", "Box")}
            onHover={(isHovering) => handleObjectHover("greenBox", isHovering)}
            canClick={true}
            canHover={true}
          />

          {/* Text Elements */}
          <ViroText
            text="Viro Fabric Interop"
            position={[0, 1.5, -3]}
            scale={[0.5, 0.5, 0.5]}
            materials={["textMaterial"]}
            fontSize={20}
            fontWeight="bold"
            textAlign="center"
            onClick={() => handleObjectClick("titleText", "Text")}
            canClick={true}
          />

          <ViroText
            text="Click objects to interact!"
            position={[0, -1.5, -3]}
            scale={[0.3, 0.3, 0.3]}
            materials={["textMaterial"]}
            fontSize={16}
            textAlign="center"
            onClick={() => handleObjectClick("instructionText", "Text")}
            canClick={true}
          />

          {/* Image and Quad */}
          <ViroQuad
            position={[-1.5, 1, -3]}
            width={0.8}
            height={0.8}
            materials={["imageMaterial"]}
            onClick={() => handleObjectClick("imageQuad", "Image Quad")}
            canClick={true}
          />

          <ViroImage
            position={[1.5, 1, -3]}
            width={0.8}
            height={0.8}
            source={{
              uri: "https://via.placeholder.com/512x512/4ECDC4/FFFFFF?text=Image",
            }}
            onClick={() => handleObjectClick("viroImage", "Image")}
            canClick={true}
          />

          {/* Animated Objects */}
          <ViroSphere
            position={[0, 0.8, -2]}
            radius={0.15}
            materials={["redMaterial"]}
            animation={{
              name: "spinAnimation",
              run: true,
              loop: true,
            }}
            onClick={() => handleObjectClick("spinningOrb", "Spinning Orb")}
            canClick={true}
          />

          {/* Sound (invisible but interactive) */}
          <ViroSound
            position={[0, 0, -3]}
            source={{
              uri: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
            }}
            paused={true}
            volume={0.5}
            onClick={() => {
              Alert.alert("Sound", "Sound component clicked!");
              // Note: Sound playback would be controlled through native props
            }}
            canClick={true}
          />
        </ViroScene>
      </ViroFabricContainer>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Status: {sceneActive ? "Active" : "Loading..."}
        </Text>
        <Text style={styles.footerText}>
          Components: Box • Sphere • Text • Image • Quad • Lights • Sound
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 5,
    color: "#333",
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
  selection: {
    backgroundColor: "#4ECDC4",
    margin: 10,
    padding: 8,
    borderRadius: 5,
    alignItems: "center",
  },
  selectionText: {
    color: "#fff",
    fontWeight: "bold",
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
    color: "#333",
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
