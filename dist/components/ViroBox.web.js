"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroBox = ViroBox;
const jsx_runtime_1 = require("react/jsx-runtime");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function ViroBox(props) {
    const width = props.width ?? 1;
    const height = props.height ?? 1;
    const length = props.length ?? 1;
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => scene.createBox(width, height, length));
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
