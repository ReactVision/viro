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
exports.ViroButton = ViroButton;
/**
 * Web implementation of ViroButton — a ViroImage whose source swaps on
 * hover/click and forwards onClick. Mirrors native: hoverSource (a.k.a.
 * gazeSource) and clickSource (a.k.a. tapSource) fall back to `source`.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroImage_web_1 = require("./ViroImage.web");
function ViroButton(props) {
    const [hovering, setHovering] = (0, react_1.useState)(false);
    const [pressed, setPressed] = (0, react_1.useState)(false);
    const hoverSource = props.hoverSource ?? props.gazeSource;
    const clickSource = props.clickSource ?? props.tapSource;
    const source = pressed && clickSource ? clickSource : hovering && hoverSource ? hoverSource : props.source;
    return (<ViroImage_web_1.ViroImage {...props} source={source} onHover={(isHovering) => setHovering(isHovering)} onClickState={(clickState) => {
            setPressed(clickState === viro_web_renderer_1.ViroClickState.ClickDown);
        }} onClick={props.onClick}/>);
}
