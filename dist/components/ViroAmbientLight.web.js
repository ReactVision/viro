"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAmbientLight = ViroAmbientLight;
/** Web implementation of ViroAmbientLight. */
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroLight_1 = require("./Web/useViroLight");
function ViroAmbientLight(props) {
    (0, useViroLight_1.useViroLight)(viro_web_renderer_1.ViroLightType.Ambient, props);
    return null;
}
