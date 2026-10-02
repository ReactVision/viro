"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroPolyline = ViroPolyline;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function flatten(points) {
    const flat = [];
    for (const p of points) {
        flat.push(p[0], p[1], p[2] ?? 0);
    }
    return flat;
}
function ViroPolyline(props) {
    const points = props.points ?? [];
    const thickness = props.thickness ?? 0.1;
    const key = (0, react_1.useMemo)(() => `${thickness}:${flatten(points).join(",")}`, [points, thickness]);
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => scene.createPolyline(flatten(points), thickness), true, key);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
