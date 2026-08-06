"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroOmniLight = ViroOmniLight;
/** Web implementation of ViroOmniLight. */
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroLight_1 = require("./Web/useViroLight");
function ViroOmniLight(props) {
    (0, useViroLight_1.useViroLight)(viro_web_renderer_1.ViroLightType.Omni, props);
    return null;
}
