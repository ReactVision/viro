"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroCamera = ViroCamera;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function ViroCamera(props) {
    const node = (0, useViroNode_1.useViroNode)(props);
    const scene = (0, ViroWebContext_1.useViroScene)();
    const active = props.active !== false;
    const { projection, orthographicScale } = props;
    (0, react_1.useEffect)(() => {
        scene.setNodeCamera(node);
    }, [scene, node]);
    (0, react_1.useEffect)(() => {
        if (active)
            scene.setActiveCameraNode(node);
    }, [scene, node, active]);
    // Order matters only in that the camera must exist first, which the effect
    // above guarantees — effects run in declaration order.
    (0, react_1.useEffect)(() => {
        scene.setCameraProjection(node, projection ?? "perspective");
    }, [scene, node, projection]);
    (0, react_1.useEffect)(() => {
        if (orthographicScale !== undefined) {
            scene.setCameraOrthographicScale(node, orthographicScale);
        }
    }, [scene, node, orthographicScale]);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
