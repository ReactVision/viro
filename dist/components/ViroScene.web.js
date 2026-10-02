"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroScene = ViroScene;
const jsx_runtime_1 = require("react/jsx-runtime");
const useViroToneMapping_1 = require("./Web/useViroToneMapping");
function ViroScene(props) {
    (0, useViroToneMapping_1.useViroToneMapping)(props.toneMappingEnabled);
    return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: props.children });
}
