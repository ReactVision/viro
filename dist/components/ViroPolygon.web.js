"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroPolygon = ViroPolygon;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function flatten(points) {
    const flat = [];
    for (const p of points) {
        flat.push(p[0], p[1], 0);
    }
    return flat;
}
function ViroPolygon(props) {
    const vertices = props.vertices ?? [];
    const key = (0, react_1.useMemo)(() => flatten(vertices).join(","), [vertices]);
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => scene.createPolygon(flatten(vertices)), true, key);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
