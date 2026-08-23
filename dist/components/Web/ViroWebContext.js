"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroParentNodeContext = exports.ViroARPlaneClaimsContext = exports.ViroARContext = exports.ViroRendererContext = void 0;
exports.useViroAR = useViroAR;
exports.useViroRenderer = useViroRenderer;
exports.useViroScene = useViroScene;
exports.useViroParentNode = useViroParentNode;
/**
 * Web bridge contexts. The renderer host (Viro3DSceneNavigator.web) provides the
 * ViroWebRenderer; each node component provides its own handle as the parent for
 * its children, so the React tree maps onto the native scene graph.
 */
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
exports.ViroRendererContext = (0, react_1.createContext)(null);
exports.ViroARContext = (0, react_1.createContext)({
    session: null,
    anchors: [],
    trackingState: viro_web_renderer_1.ViroTrackingState.Unavailable,
});
function useViroAR() {
    return (0, react_1.useContext)(exports.ViroARContext);
}
exports.ViroARPlaneClaimsContext = (0, react_1.createContext)(null);
/** The parent node handle for the current subtree (0 = scene root not yet available). */
exports.ViroParentNodeContext = (0, react_1.createContext)(0);
function useViroRenderer() {
    const renderer = (0, react_1.useContext)(exports.ViroRendererContext);
    if (!renderer) {
        throw new Error("Viro web components must be rendered inside a Viro scene navigator (no renderer in context).");
    }
    return renderer;
}
function useViroScene() {
    return useViroRenderer().scene;
}
function useViroParentNode() {
    return (0, react_1.useContext)(exports.ViroParentNodeContext);
}
