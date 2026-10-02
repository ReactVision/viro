"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroGeometry = ViroGeometry;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const flat3 = (pts) => (pts ?? []).flatMap((p) => [p[0], p[1], p[2]]);
const flat2 = (pts) => (pts ?? []).flatMap((p) => [p[0], p[1]]);
function ViroGeometry(props) {
    const vertices = (0, react_1.useMemo)(() => flat3(props.vertices), [props.vertices]);
    const normals = (0, react_1.useMemo)(() => flat3(props.normals), [props.normals]);
    const texcoords = (0, react_1.useMemo)(() => flat2(props.texcoords), [props.texcoords]);
    const indices = (0, react_1.useMemo)(() => flat3(props.triangleIndices), [props.triangleIndices]);
    const key = (0, react_1.useMemo)(() => `${vertices.length}:${normals.length}:${texcoords.length}:${indices.length}:${indices.join(",")}`, [vertices, normals, texcoords, indices]);
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => scene.createGeometry(vertices, normals, texcoords, indices), true, key);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
