"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroText = ViroText;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroFlexSlotContext_1 = require("./Web/ViroFlexSlotContext");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroColor_1 = require("./Web/viroColor");
function hAlign(v) {
    switch ((v ?? "").toLowerCase()) {
        case "right":
            return viro_web_renderer_1.ViroTextHorizontalAlignment.Right;
        case "center":
            return viro_web_renderer_1.ViroTextHorizontalAlignment.Center;
        default:
            return viro_web_renderer_1.ViroTextHorizontalAlignment.Left;
    }
}
function vAlign(v) {
    switch ((v ?? "").toLowerCase()) {
        case "bottom":
            return viro_web_renderer_1.ViroTextVerticalAlignment.Bottom;
        case "center":
            return viro_web_renderer_1.ViroTextVerticalAlignment.Center;
        default:
            return viro_web_renderer_1.ViroTextVerticalAlignment.Top;
    }
}
function lineBreak(v) {
    switch (v) {
        case "CharWrap":
            return viro_web_renderer_1.ViroLineBreakMode.CharWrap;
        case "Justify":
            return viro_web_renderer_1.ViroLineBreakMode.Justify;
        case "None":
            return viro_web_renderer_1.ViroLineBreakMode.None;
        default:
            return viro_web_renderer_1.ViroLineBreakMode.WordWrap;
    }
}
function ViroText(props) {
    const { text, maxLines = 0, style, } = props;
    // Inside a ViroFlexView the layout decides the text box, as it does natively:
    // the block still wraps and clips to it, it just no longer sizes itself.
    const slot = (0, ViroFlexSlotContext_1.useViroFlexSlot)();
    const width = slot?.width ?? props.width ?? 1;
    const height = slot?.height ?? props.height ?? 1;
    const fontSize = style?.fontSize ?? 18;
    const colorValue = props.color ?? style?.color ?? "#ffffff";
    const clip = props.textClipMode === "None" ? viro_web_renderer_1.ViroTextClipMode.None : viro_web_renderer_1.ViroTextClipMode.ClipToBounds;
    // Recreate the geometry when any text-shaping input changes.
    const key = (0, react_1.useMemo)(() => [
        text,
        width,
        height,
        fontSize,
        String(colorValue),
        style?.textAlign,
        style?.textAlignVertical,
        props.textLineBreakMode,
        props.textClipMode,
        maxLines,
    ].join("|"), [text, width, height, fontSize, colorValue, style?.textAlign, style?.textAlignVertical, props.textLineBreakMode, props.textClipMode, maxLines]);
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => {
        const [r, g, b, a] = (0, viroColor_1.parseColorToRGBA)(colorValue);
        return scene.createText(text ?? "", width, height, fontSize, hAlign(style?.textAlign), vAlign(style?.textAlignVertical), lineBreak(props.textLineBreakMode), clip, maxLines, { r, g, b, a });
    }, true, 
    // Rebuild the text geometry when shaping inputs change.
    key);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
