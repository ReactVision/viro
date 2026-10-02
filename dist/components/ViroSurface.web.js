"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSurface = ViroSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
const useViroNode_1 = require("./Web/useViroNode");
const ViroFlexSlotContext_1 = require("./Web/ViroFlexSlotContext");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function ViroSurface(props) {
    // Inside a ViroFlexView the layout decides the size, as it does natively.
    const slot = (0, ViroFlexSlotContext_1.useViroFlexSlot)();
    const width = slot?.width ?? props.width ?? 1;
    const height = slot?.height ?? props.height ?? 1;
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => scene.createSurface(width, height));
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
