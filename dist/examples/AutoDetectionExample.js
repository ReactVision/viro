"use strict";
/**
 * AutoDetectionExample
 *
 * This example demonstrates how to use ViroReact with automatic architecture detection.
 * The library will automatically detect whether your app is using the New Architecture (Fabric)
 * and use the appropriate implementation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const react_viro_1 = require("@reactvision/react-viro");
// Define the AR scene component
const ARScene = () => {
    const [text, setText] = react_1.default.useState("Initializing AR...");
    // Handle tracking state updates
    const onTrackingUpdated = (state) => {
        if (state.state === react_viro_1.ViroTrackingStateConstants.TRACKING_NORMAL) {
            setText("Hello Viro!");
        }
        else if (state.state === react_viro_1.ViroTrackingStateConstants.TRACKING_NONE) {
            setText("Tracking lost. Please point the camera at a flat surface.");
        }
    };
    return (<react_viro_1.ViroARScene onTrackingUpdated={onTrackingUpdated}>
      {/* A simple 3D box floating 1 meter in front of the user */}
      <react_viro_1.ViroBox position={[0, 0, -1]} scale={[0.1, 0.1, 0.1]} materials={["grid"]}/>

      {/* Text above the box */}
      <react_viro_1.ViroText text={text} position={[0, 0.1, -1]} scale={[0.1, 0.1, 0.1]} style={{ color: "#ffffff", fontWeight: "bold", textAlign: "center" }}/>
    </react_viro_1.ViroARScene>);
};
// Main app component
const AutoDetectionExample = () => {
    const [arStarted, setArStarted] = react_1.default.useState(false);
    const startAR = () => {
        setArStarted(true);
    };
    if (arStarted) {
        return (<react_viro_1.ViroARSceneNavigator initialScene={{
                scene: ARScene,
            }} style={styles.arView}/>);
    }
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Text style={styles.title}>ViroReact Auto-Detection Example</react_native_1.Text>
      <react_native_1.Text style={styles.description}>
        This example uses the automatic architecture detection feature. The
        library will automatically use the appropriate implementation based on
        whether your app has the New Architecture enabled.
      </react_native_1.Text>
      <react_native_1.TouchableOpacity style={styles.button} onPress={startAR}>
        <react_native_1.Text style={styles.buttonText}>Start AR</react_native_1.Text>
      </react_native_1.TouchableOpacity>
    </react_native_1.View>);
};
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 20,
    },
    description: {
        fontSize: 16,
        textAlign: "center",
        marginBottom: 30,
    },
    button: {
        backgroundColor: "#1E88E5",
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 8,
    },
    buttonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
    },
    arView: {
        flex: 1,
    },
});
exports.default = AutoDetectionExample;
