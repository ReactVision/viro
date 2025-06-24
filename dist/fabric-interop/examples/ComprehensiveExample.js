"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComprehensiveExample = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const index_1 = require("../index");
const ComprehensiveExample = () => {
    const [sceneActive, setSceneActive] = (0, react_1.useState)(false);
    const [memoryStats, setMemoryStats] = (0, react_1.useState)(null);
    const [selectedObject, setSelectedObject] = (0, react_1.useState)(null);
    // Initialize materials and animations when component mounts
    (0, react_1.useEffect)(() => {
        // Create materials for different objects
        (0, index_1.createMaterial)("redMaterial", {
            diffuseColor: "#FF0000",
            shininess: 2.0,
            lightingModel: "Lambert",
        });
        (0, index_1.createMaterial)("blueMaterial", {
            diffuseColor: "#0000FF",
            shininess: 2.0,
            lightingModel: "Lambert",
        });
        (0, index_1.createMaterial)("greenMaterial", {
            diffuseColor: "#00FF00",
            shininess: 2.0,
            lightingModel: "Lambert",
        });
        (0, index_1.createMaterial)("textMaterial", {
            diffuseColor: "#FFFFFF",
            shininess: 1.0,
            lightingModel: "Lambert",
        });
        (0, index_1.createMaterial)("imageMaterial", {
            diffuseTexture: {
                uri: "https://via.placeholder.com/512x512/FF6B6B/FFFFFF?text=Viro",
            },
            lightingModel: "Lambert",
        });
        // Create animations
        (0, index_1.createAnimation)("spinAnimation", {
            properties: {
                rotateY: "+=360",
            },
            duration: 2000,
            easing: "Linear",
        });
        (0, index_1.createAnimation)("pulseAnimation", {
            properties: {
                scaleX: 1.5,
                scaleY: 1.5,
                scaleZ: 1.5,
            },
            duration: 1000,
            easing: "EaseInEaseOut",
        });
        (0, index_1.createAnimation)("bounceAnimation", {
            properties: {
                positionY: "+=0.5",
            },
            duration: 800,
            easing: "Bounce",
        });
        (0, index_1.createAnimation)("colorChangeAnimation", {
            properties: {
                materialDiffuseColor: "#FFFF00",
            },
            duration: 1500,
            easing: "EaseInEaseOut",
        });
    }, []);
    // Handle scene initialization
    const handleSceneInitialized = (success) => {
        console.log("Scene initialized:", success);
        setSceneActive(success);
        if (success) {
            react_native_1.Alert.alert("Success", "Comprehensive Viro scene initialized!");
        }
        else {
            react_native_1.Alert.alert("Error", "Failed to initialize Viro scene");
        }
    };
    // Handle object interactions
    const handleObjectClick = (objectName, objectType) => {
        setSelectedObject(objectName);
        react_native_1.Alert.alert("Object Clicked", `${objectType} "${objectName}" was clicked!`, [
            {
                text: "Spin",
                onPress: () => (0, index_1.executeAnimation)(objectName, "spinAnimation", {
                    run: true,
                    loop: false,
                }),
            },
            {
                text: "Pulse",
                onPress: () => (0, index_1.executeAnimation)(objectName, "pulseAnimation", {
                    run: true,
                    loop: false,
                }),
            },
            {
                text: "Bounce",
                onPress: () => (0, index_1.executeAnimation)(objectName, "bounceAnimation", {
                    run: true,
                    loop: false,
                }),
            },
            { text: "OK", style: "cancel" },
        ]);
    };
    const handleObjectHover = (objectName, isHovering) => {
        console.log(`${objectName} hover:`, isHovering);
        if (isHovering) {
            (0, index_1.executeAnimation)(objectName, "pulseAnimation", {
                run: true,
                loop: false,
            });
        }
    };
    // Memory management
    const checkMemoryStats = () => {
        const stats = (0, index_1.getMemoryStats)();
        setMemoryStats(stats);
        if (stats) {
            react_native_1.Alert.alert("Memory Statistics", `Total Scenes: ${stats.totalScenes || 0}\n` +
                `Active Scenes: ${stats.activeScenes || 0}\n` +
                `Managed Nodes: ${stats.managedNodes || 0}\n` +
                `Memory Usage: ${stats.usedMemoryMB?.toFixed(1) || "N/A"} MB\n` +
                `Textures: ${stats.textureCount || 0}\n` +
                `Materials: ${stats.materialCount || 0}`);
        }
        else {
            react_native_1.Alert.alert("Memory Stats", "Memory statistics not available");
        }
    };
    const cleanupMemory = () => {
        (0, index_1.performMemoryCleanup)();
        react_native_1.Alert.alert("Memory Cleanup", "Memory cleanup performed successfully");
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Text style={styles.title}>Comprehensive Viro Example</react_native_1.Text>
      <react_native_1.Text style={styles.subtitle}>
        All Components • New Architecture • Complete Integration
      </react_native_1.Text>

      <react_native_1.View style={styles.controls}>
        <react_native_1.Button title="Memory Stats" onPress={checkMemoryStats} disabled={!sceneActive}/>
        <react_native_1.Button title="Cleanup" onPress={cleanupMemory} disabled={!sceneActive}/>
      </react_native_1.View>

      {selectedObject && (<react_native_1.View style={styles.selection}>
          <react_native_1.Text style={styles.selectionText}>Selected: {selectedObject}</react_native_1.Text>
        </react_native_1.View>)}

      {memoryStats && (<react_native_1.View style={styles.stats}>
          <react_native_1.Text style={styles.statsTitle}>Memory Stats:</react_native_1.Text>
          <react_native_1.Text>
            Scenes: {memoryStats.totalScenes || 0} | Nodes:{" "}
            {memoryStats.managedNodes || 0}
          </react_native_1.Text>
          <react_native_1.Text>
            Memory: {memoryStats.usedMemoryMB?.toFixed(1) || "N/A"} MB
          </react_native_1.Text>
        </react_native_1.View>)}

      <index_1.ViroFabricContainer style={styles.viroContainer} debug={true} arEnabled={false} worldAlignment="Gravity" onInitialized={handleSceneInitialized} onMemoryWarning={(event) => {
            react_native_1.Alert.alert("Memory Warning", `Usage: ${event.memoryStats.usedMemoryMB?.toFixed(1)} MB`);
        }}>
        <index_1.ViroScene onSceneLoadStart={() => console.log("Comprehensive scene loading...")} onSceneLoadEnd={() => console.log("Comprehensive scene loaded!")}>
          {/* Lighting Setup */}
          <index_1.ViroAmbientLight color="#404040" intensity={0.4}/>
          <index_1.ViroDirectionalLight color="#FFFFFF" direction={[0, -1, -0.2]} intensity={1.0} castsShadow={true}/>

          {/* 3D Primitives Row */}
          <index_1.ViroBox position={[-2, 0, -4]} scale={[0.4, 0.4, 0.4]} materials={["redMaterial"]} onClick={() => handleObjectClick("redBox", "Box")} onHover={(isHovering) => handleObjectHover("redBox", isHovering)} canClick={true} canHover={true}/>

          <index_1.ViroSphere position={[0, 0, -4]} radius={0.3} materials={["blueMaterial"]} onClick={() => handleObjectClick("blueSphere", "Sphere")} onHover={(isHovering) => handleObjectHover("blueSphere", isHovering)} canClick={true} canHover={true}/>

          <index_1.ViroBox position={[2, 0, -4]} scale={[0.4, 0.4, 0.4]} materials={["greenMaterial"]} onClick={() => handleObjectClick("greenBox", "Box")} onHover={(isHovering) => handleObjectHover("greenBox", isHovering)} canClick={true} canHover={true}/>

          {/* Text Elements */}
          <index_1.ViroText text="Viro Fabric Interop" position={[0, 1.5, -3]} scale={[0.5, 0.5, 0.5]} materials={["textMaterial"]} fontSize={20} fontWeight="bold" textAlign="center" onClick={() => handleObjectClick("titleText", "Text")} canClick={true}/>

          <index_1.ViroText text="Click objects to interact!" position={[0, -1.5, -3]} scale={[0.3, 0.3, 0.3]} materials={["textMaterial"]} fontSize={16} textAlign="center" onClick={() => handleObjectClick("instructionText", "Text")} canClick={true}/>

          {/* Image and Quad */}
          <index_1.ViroQuad position={[-1.5, 1, -3]} width={0.8} height={0.8} materials={["imageMaterial"]} onClick={() => handleObjectClick("imageQuad", "Image Quad")} canClick={true}/>

          <index_1.ViroImage position={[1.5, 1, -3]} width={0.8} height={0.8} source={{
            uri: "https://via.placeholder.com/512x512/4ECDC4/FFFFFF?text=Image",
        }} onClick={() => handleObjectClick("viroImage", "Image")} canClick={true}/>

          {/* Animated Objects */}
          <index_1.ViroSphere position={[0, 0.8, -2]} radius={0.15} materials={["redMaterial"]} animation={{
            name: "spinAnimation",
            run: true,
            loop: true,
        }} onClick={() => handleObjectClick("spinningOrb", "Spinning Orb")} canClick={true}/>

          {/* Sound (invisible but interactive) */}
          <index_1.ViroSound position={[0, 0, -3]} source={{
            uri: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
        }} paused={true} volume={0.5} onClick={() => {
            react_native_1.Alert.alert("Sound", "Sound component clicked!");
            // Note: Sound playback would be controlled through native props
        }} canClick={true}/>
        </index_1.ViroScene>
      </index_1.ViroFabricContainer>

      <react_native_1.View style={styles.footer}>
        <react_native_1.Text style={styles.footerText}>
          Status: {sceneActive ? "Active" : "Loading..."}
        </react_native_1.Text>
        <react_native_1.Text style={styles.footerText}>
          Components: Box • Sphere • Text • Image • Quad • Lights • Sound
        </react_native_1.Text>
      </react_native_1.View>
    </react_native_1.View>);
};
exports.ComprehensiveExample = ComprehensiveExample;
const styles = react_native_1.StyleSheet.create({
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
