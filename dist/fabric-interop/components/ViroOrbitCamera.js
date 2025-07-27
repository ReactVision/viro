"use strict";
/**
 * ViroOrbitCamera
 *
 * A component for orbital camera controls.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroOrbitCamera = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroOrbitCamera is a component for orbital camera controls.
 * It allows the camera to orbit around a focal point.
 */
const ViroOrbitCamera = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        focalPoint: props.focalPoint,
        distance: props.distance,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("orbitCamera", nativeProps);
    // Render children with this orbit camera as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroOrbitCamera = ViroOrbitCamera;
