"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSphere = ViroSphere;
const jsx_runtime_1 = require("react/jsx-runtime");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function ViroSphere(props) {
    const radius = props.radius ?? 1;
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => scene.createSphere(radius));
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
