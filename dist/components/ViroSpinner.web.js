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
exports.ViroSpinner = ViroSpinner;
/**
 * Web implementation of ViroSpinner — two layered spinner images rotating in
 * opposite directions (matches native's look). `type` ("Dark"/"Light") picks the
 * bundled asset variant; a custom `source`/`sourceReverse` overrides it.
 *
 * Asset note: the built-in spinner PNGs are `require()`d (native parity); this
 * resolves under Metro/webpack (react-native-web). A custom `source` avoids any
 * bundler-specific asset handling.
 */
const React = __importStar(require("react"));
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
    return (<ViroNode_web_1.ViroNode {...props}>
      <ViroImage_web_1.ViroImage source={base} width={width} height={height} animation={{ name: "_viroSpinnerClockwise", run: true, loop: true }}/>
      <ViroImage_web_1.ViroImage source={overlay} width={width} height={height} position={[0, 0, 0.001]} animation={{ name: "_viroSpinnerCounter", run: true, loop: true }}/>
    </ViroNode_web_1.ViroNode>);
}
