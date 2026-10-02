"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroNode = ViroNode;
const jsx_runtime_1 = require("react/jsx-runtime");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function ViroNode(props) {
    const node = (0, useViroNode_1.useViroNode)(props);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
