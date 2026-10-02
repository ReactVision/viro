"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroButton = ViroButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroImage_web_1 = require("./ViroImage.web");
function ViroButton(props) {
    const [hovering, setHovering] = (0, react_1.useState)(false);
    const [pressed, setPressed] = (0, react_1.useState)(false);
    const hoverSource = props.hoverSource ?? props.gazeSource;
    const clickSource = props.clickSource ?? props.tapSource;
    const source = pressed && clickSource ? clickSource : hovering && hoverSource ? hoverSource : props.source;
    return ((0, jsx_runtime_1.jsx)(ViroImage_web_1.ViroImage, { ...props, source: source, onHover: (isHovering) => setHovering(isHovering), onClickState: (clickState) => {
            setPressed(clickState === viro_web_renderer_1.ViroClickState.ClickDown);
        }, onClick: props.onClick }));
}
