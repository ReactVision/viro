"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroDirectionalLight = ViroDirectionalLight;
/** Web implementation of ViroDirectionalLight. */
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroLight_1 = require("./Web/useViroLight");
function ViroDirectionalLight(props) {
    (0, useViroLight_1.useViroLight)(viro_web_renderer_1.ViroLightType.Directional, props);
    return null;
}
