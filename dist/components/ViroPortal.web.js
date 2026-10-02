"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroPortal = ViroPortal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const DEG2RAD = Math.PI / 180;
function ViroPortal(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const portalScene = (0, ViroWebContext_1.useViroParentNode)(); // the enclosing VROPortal
    const [frame] = (0, react_1.useState)(() => scene.createPortalFrame());
    // Register as the portal scene's entrance (this also parents the frame).
    (0, react_1.useEffect)(() => {
        scene.setPortalEntrance(portalScene, frame);
        return () => scene.destroyNode(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [px, py, pz] = props.position ?? [0, 0, 0];
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = props.scale ?? [1, 1, 1];
    (0, react_1.useEffect)(() => {
        scene.setNodePosition(frame, px, py, pz);
        scene.setNodeRotation(frame, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
        scene.setNodeScale(frame, sx, sy, sz);
    }, [scene, frame, px, py, pz, rx, ry, rz, sx, sy, sz]);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: frame, children: props.children }));
}
