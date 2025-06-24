"use strict";
/**
 * BasicSceneExample
 *
 * A simple example demonstrating the new fabric-interop system with:
 * - Scene management and lifecycle
 * - Property system with individual setters
 * - Event system with JSI + fallback
 * - Memory management integration
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
exports.BasicSceneExample = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const index_1 = require("../index");
const BasicSceneExample = () => {
    const [sceneActive, setSceneActive] = (0, react_1.useState)(false);
    const [memoryStats, setMemoryStats] = (0, react_1.useState)(null);
    // Initialize materials and animations when component mounts
    (0, react_1.useEffect)(() => {
        // Create a red material for the box
        (0, index_1.createMaterial)("redMaterial", {
            diffuseColor: "#FF0000",
            shininess: 2.0,
            lightingModel: "Lambert",
        });
        // Create a blue material for the box
        (0, index_1.createMaterial)("blueMaterial", {
            diffuseColor: "#0000FF",
            shininess: 2.0,
            lightingModel: "Lambert",
        });
        // Create a rotation animation
        (0, index_1.createAnimation)("spinAnimation", {
            properties: {
                rotateY: "+=360",
            },
            duration: 2000,
            easing: "Linear",
        });
        // Create a scale animation
        (0, index_1.createAnimation)("pulseAnimation", {
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
    const handleSceneInitialized = (success) => {
        console.log("Scene initialized:", success);
        setSceneActive(success);
        if (success) {
            react_native_1.Alert.alert("Success", "Viro scene initialized successfully!");
        }
        else {
            react_native_1.Alert.alert("Error", "Failed to initialize Viro scene");
        }
    };
    // Handle scene state changes
    const handleSceneStateChanged = (event) => {
        console.log("Scene state changed:", event);
    };
    // Handle memory warnings
    const handleMemoryWarning = (event) => {
        console.log("Memory warning received:", event.memoryStats);
        setMemoryStats(event.memoryStats);
        react_native_1.Alert.alert("Memory Warning", `Memory usage: ${event.memoryStats.usedMemoryMB?.toFixed(1) || "N/A"} MB`);
    };
    // Handle box click
    const handleBoxClick = () => {
        react_native_1.Alert.alert("Box Clicked", "The red box was clicked!");
        // Execute spin animation
        (0, index_1.executeAnimation)("box1", "spinAnimation", {
            run: true,
            loop: false,
        });
    };
    // Handle box hover
    const handleBoxHover = (isHovering) => {
        console.log("Box hover:", isHovering);
        if (isHovering) {
            // Execute pulse animation on hover
            (0, index_1.executeAnimation)("box1", "pulseAnimation", {
                run: true,
                loop: false,
            });
        }
    };
    // Get current memory stats
    const checkMemoryStats = () => {
        const stats = (0, index_1.getMemoryStats)();
        setMemoryStats(stats);
        if (stats) {
            react_native_1.Alert.alert("Memory Stats", `Total Scenes: ${stats.totalScenes || 0}\n` +
                `Active Scenes: ${stats.activeScenes || 0}\n` +
                `Managed Nodes: ${stats.managedNodes || 0}\n` +
                `Memory Usage: ${stats.usedMemoryMB?.toFixed(1) || "N/A"} MB`);
        }
        else {
            react_native_1.Alert.alert("Memory Stats", "Memory statistics not available");
        }
    };
    // Perform manual memory cleanup
    const cleanupMemory = () => {
        (0, index_1.performMemoryCleanup)();
        react_native_1.Alert.alert("Memory Cleanup", "Memory cleanup performed");
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Text style={styles.title}>Viro Fabric Interop Example</react_native_1.Text>
      <react_native_1.Text style={styles.subtitle}>
        Demonstrating New Architecture compatibility
      </react_native_1.Text>

      <react_native_1.View style={styles.controls}>
        <react_native_1.Button title="Check Memory Stats" onPress={checkMemoryStats} disabled={!sceneActive}/>
        <react_native_1.Button title="Cleanup Memory" onPress={cleanupMemory} disabled={!sceneActive}/>
      </react_native_1.View>

      {memoryStats && (<react_native_1.View style={styles.stats}>
          <react_native_1.Text style={styles.statsTitle}>Memory Stats:</react_native_1.Text>
          <react_native_1.Text>Total Scenes: {memoryStats.totalScenes || 0}</react_native_1.Text>
          <react_native_1.Text>Active Scenes: {memoryStats.activeScenes || 0}</react_native_1.Text>
          <react_native_1.Text>Managed Nodes: {memoryStats.managedNodes || 0}</react_native_1.Text>
          <react_native_1.Text>
            Memory Usage: {memoryStats.usedMemoryMB?.toFixed(1) || "N/A"} MB
          </react_native_1.Text>
        </react_native_1.View>)}

      <index_1.ViroFabricContainer style={styles.viroContainer} debug={true} arEnabled={false} worldAlignment="Gravity" onInitialized={handleSceneInitialized} onSceneStateChanged={handleSceneStateChanged} onMemoryWarning={handleMemoryWarning}>
        <index_1.ViroScene onSceneLoadStart={() => console.log("Scene load started")} onSceneLoadEnd={() => console.log("Scene load ended")} onSceneError={(error) => console.error("Scene error:", error)}>
          {/* Red box with click and hover events */}
          <index_1.ViroBox position={[-1, 0, -3]} scale={[0.5, 0.5, 0.5]} materials={["redMaterial"]} onClick={handleBoxClick} onHover={(isHovering) => handleBoxHover(isHovering)} canClick={true} canHover={true}/>

          {/* Blue box with different position */}
          <index_1.ViroBox position={[1, 0, -3]} scale={[0.5, 0.5, 0.5]} materials={["blueMaterial"]} onClick={() => react_native_1.Alert.alert("Blue Box", "Blue box clicked!")} canClick={true}/>

          {/* Center box with animation */}
          <index_1.ViroBox position={[0, 1, -3]} scale={[0.3, 0.3, 0.3]} materials={["redMaterial"]} animation={{
            name: "spinAnimation",
            run: true,
            loop: true,
        }}/>
        </index_1.ViroScene>
      </index_1.ViroFabricContainer>

      <react_native_1.View style={styles.footer}>
        <react_native_1.Text style={styles.footerText}>
          Status: {sceneActive ? "Active" : "Initializing..."}
        </react_native_1.Text>
        <react_native_1.Text style={styles.footerText}>
          Features: Scene Management • Property System • Event System • Memory
          Management
        </react_native_1.Text>
      </react_native_1.View>
    </react_native_1.View>);
};
exports.BasicSceneExample = BasicSceneExample;
const styles = react_native_1.StyleSheet.create({
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
