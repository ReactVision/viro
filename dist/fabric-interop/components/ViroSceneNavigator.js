"use strict";
/**
 * ViroSceneNavigator
 *
 * A component for rendering 3D scenes.
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
exports.ViroSceneNavigator = void 0;
const react_1 = __importStar(require("react"));
const ViroFabricContainer_1 = require("../ViroFabricContainer");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroSceneNavigator is a component for rendering 3D scenes.
 * It provides a container for 3D scenes and handles the scene lifecycle.
 */
const ViroSceneNavigator = (props) => {
    const [apiKey] = (0, react_1.useState)(() => {
        // Generate a random API key for demo purposes
        return `viro-${Math.random().toString(36).substring(2, 15)}`;
    });
    // Initialize scene
    (0, react_1.useEffect)(() => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (!nativeViro)
            return;
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
    return (<ViroFabricContainer_1.ViroFabricContainer style={props.style} debug={false} arEnabled={false} onCameraTransformUpdate={props.onCameraTransformUpdate}>
      <SceneComponent />
    </ViroFabricContainer_1.ViroFabricContainer>);
};
exports.ViroSceneNavigator = ViroSceneNavigator;
