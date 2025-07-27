"use strict";
/**
 * SimpleARExample
 *
 * A simple example of using the Viro Fabric interop layer for AR.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleARExample = void 0;
const react_1 = __importDefault(require("react"));
const components_1 = require("../components");
// Register materials
components_1.ViroMaterials.registerMaterials({
    grid: {
        diffuseColor: "#0000FF",
        diffuseTexture: require("./assets/grid_bg.jpg"),
    },
    text: {
        diffuseColor: "#FFFFFF",
    },
});
// Register AR tracking targets
components_1.ViroARTrackingTargets.registerTargets({
    logo: {
        source: require("./assets/viro_logo.png"),
        orientation: "Up",
        physicalWidth: 0.1, // 10cm
    },
});
// Main AR scene component
const ARScene = () => {
    // Handle tracking state updates
    const onTrackingUpdated = (state) => {
        console.log("Tracking state updated:", state);
    };
    // Handle anchor found event
    const onAnchorFound = () => {
        console.log("Anchor found!");
    };
    return (<components_1.ViroARScene onTrackingUpdated={onTrackingUpdated}>
      {/* A simple 3D box floating 1 meter in front of the user */}
      <components_1.ViroBox position={[0, 0, -1]} scale={[0.1, 0.1, 0.1]} materials={["grid"]}/>

      {/* Text above the box */}
      <components_1.ViroText text="Hello Viro!" position={[0, 0.1, -1]} scale={[0.1, 0.1, 0.1]} color="#FFFFFF" fontWeight="bold" materials={["text"]}/>

      {/* Image marker that places content when detected */}
      <components_1.ViroARImageMarker target="logo" onAnchorFound={onAnchorFound}>
        <components_1.ViroBox position={[0, 0.1, 0]} scale={[0.05, 0.05, 0.05]} materials={["grid"]}/>
      </components_1.ViroARImageMarker>
    </components_1.ViroARScene>);
};
// Main app component
const SimpleARExample = () => {
    return (<components_1.ViroARSceneNavigator initialScene={{
            scene: ARScene,
        }} style={{ flex: 1 }} worldAlignment="Gravity" planeDetection={{ horizontal: true, vertical: true }}/>);
};
exports.SimpleARExample = SimpleARExample;
exports.default = exports.SimpleARExample;
