"use strict";
/**
 * ViroNode
 *
 * A component that serves as a container for other Viro components.
 * It doesn't render anything itself but provides a coordinate system for its children.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroNode = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroNode is a component that serves as a container for other Viro components.
 * It doesn't render anything itself but provides a coordinate system for its children.
 */
const ViroNode = (props) => {
    // Parent will be determined by context automatically
    // Convert common props to the format expected by the native code
    const nativeProps = (0, ViroUtils_1.convertCommonProps)(props);
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("node", nativeProps);
    // Render children with this node as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroNode = ViroNode;
