"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSpotLight = ViroSpotLight;
/** Web implementation of ViroSpotLight. */
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroLight_1 = require("./Web/useViroLight");
function ViroSpotLight(props) {
    (0, useViroLight_1.useViroLight)(viro_web_renderer_1.ViroLightType.Spot, props);
    return null;
}
