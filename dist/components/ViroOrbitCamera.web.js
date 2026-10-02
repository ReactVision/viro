"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroOrbitCamera = ViroOrbitCamera;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const RAD2DEG = 180 / Math.PI;
function lookAtEuler(position, focal) {
    const dx = focal[0] - position[0];
    const dy = focal[1] - position[1];
    const dz = focal[2] - position[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const nz = dz / len;
    const yaw = Math.atan2(nx, -nz) * RAD2DEG;
    const pitch = -Math.asin(Math.max(-1, Math.min(1, ny))) * RAD2DEG;
    return [pitch, yaw, 0];
}
function ViroOrbitCamera(props) {
    const position = (props.position ?? [0, 0, 0]);
    const rotation = props.focalPoint
        ? lookAtEuler(position, props.focalPoint)
        : props.rotation;
    const node = (0, useViroNode_1.useViroNode)({ ...props, rotation });
    const scene = (0, ViroWebContext_1.useViroScene)();
    const active = props.active !== false;
    (0, react_1.useEffect)(() => {
        scene.setNodeCamera(node);
    }, [scene, node]);
    (0, react_1.useEffect)(() => {
        if (active)
            scene.setActiveCameraNode(node);
    }, [scene, node, active]);
    (0, react_1.useEffect)(() => {
        scene.setCameraProjection(node, props.projection ?? "perspective");
    }, [scene, node, props.projection]);
    (0, react_1.useEffect)(() => {
        if (props.orthographicScale !== undefined) {
            scene.setCameraOrthographicScale(node, props.orthographicScale);
        }
    }, [scene, node, props.orthographicScale]);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
