"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroText = ViroText;
/**
 * Web implementation of ViroText — a text geometry rendered by the WASM font
 * pipeline (freetype + preloaded Helvetica). Maps `text`, `style` (fontSize,
 * color), `width`/`height`, alignment, line-break, clip and `maxLines` onto the
 * `viroCreateText` C API.
 *
 * MVP scope: single typeface (preloaded system font); custom `fontFamily`,
 * `extrusionDepth` and `outerStroke` are follow-ups.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
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
    const { text, width = 1, height = 1, maxLines = 0, style, } = props;
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
    return (<ViroWebContext_1.ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroWebContext_1.ViroParentNodeContext.Provider>);
}
