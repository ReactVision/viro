"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroPortalScene = ViroPortalScene;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function ViroPortalScene(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const node = (0, useViroNode_1.useViroNode)(props, undefined, true, undefined, (s) => s.createPortalScene());
    (0, react_1.useEffect)(() => {
        scene.setPortalPassable(node, props.passable ?? false);
    }, [scene, node, props.passable]);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
