"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSpinner = ViroSpinner;
const jsx_runtime_1 = require("react/jsx-runtime");
const ViroNode_web_1 = require("./ViroNode.web");
const ViroImage_web_1 = require("./ViroImage.web");
const ViroAnimations_web_1 = require("./Animation/ViroAnimations.web");
const ViroSpinner_1 = require("./Resources/viro_spinner_1.png");
const ViroSpinner_1a = require("./Resources/viro_spinner_1a.png");
const ViroSpinner_1_w = require("./Resources/viro_spinner_1_w.png");
const ViroSpinner_1a_w = require("./Resources/viro_spinner_1a_w.png");
ViroAnimations_web_1.ViroAnimations.registerAnimations({
    _viroSpinnerClockwise: { duration: 1000, easing: "Linear", properties: { rotateZ: -360 } },
    _viroSpinnerCounter: { duration: 1000, easing: "Linear", properties: { rotateZ: 360 } },
});
function ViroSpinner(props) {
    const isLight = (props.type ?? "Dark").toUpperCase() === "LIGHT";
    const base = props.source ?? (isLight ? ViroSpinner_1_w : ViroSpinner_1);
    const overlay = props.sourceReverse ?? (isLight ? ViroSpinner_1a_w : ViroSpinner_1a);
    const width = props.width ?? 1;
    const height = props.height ?? 1;
    return ((0, jsx_runtime_1.jsxs)(ViroNode_web_1.ViroNode, { ...props, children: [(0, jsx_runtime_1.jsx)(ViroImage_web_1.ViroImage, { source: base, width: width, height: height, animation: { name: "_viroSpinnerClockwise", run: true, loop: true } }), (0, jsx_runtime_1.jsx)(ViroImage_web_1.ViroImage, { source: overlay, width: width, height: height, position: [0, 0, 0.001], animation: { name: "_viroSpinnerCounter", run: true, loop: true } })] }));
}
