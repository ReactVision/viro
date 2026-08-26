"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroLight = useViroLight;
/**
 * Lifecycle hook for web light components. A light is a VROLight (not a node):
 * it's created via the C API, added to the enclosing node, updated as props
 * change, and removed on unmount.
 */
const react_1 = require("react");
const ViroWebContext_1 = require("./ViroWebContext");
const viroColor_1 = require("./viroColor");
function useViroLight(type, props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const parent = (0, ViroWebContext_1.useViroParentNode)();
    const [light] = (0, react_1.useState)(() => scene.createLight(type));
    (0, react_1.useEffect)(() => {
        scene.addLightToNode(parent, light);
        return () => {
            scene.removeLightFromNode(parent, light);
            scene.destroyLight(light);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { color, intensity, temperature, direction, position, attenuationStartDistance, attenuationEndDistance, innerAngle, outerAngle, castsShadow, } = props;
    const dirKey = direction ? direction.join(",") : "";
    const posKey = position ? position.join(",") : "";
    (0, react_1.useEffect)(() => {
        if (color !== undefined) {
            const [r, g, b] = (0, viroColor_1.parseColorToRGBA)(color);
            scene.setLightColor(light, r, g, b);
        }
        if (intensity !== undefined)
            scene.setLightIntensity(light, intensity);
        if (temperature !== undefined)
            scene.setLightTemperature(light, temperature);
        if (direction)
            scene.setLightDirection(light, direction[0], direction[1], direction[2]);
        if (position)
            scene.setLightPosition(light, position[0], position[1], position[2]);
        if (attenuationStartDistance !== undefined && attenuationEndDistance !== undefined) {
            scene.setLightAttenuation(light, attenuationStartDistance, attenuationEndDistance);
        }
        if (innerAngle !== undefined && outerAngle !== undefined) {
            scene.setLightSpotAngles(light, innerAngle, outerAngle);
        }
        if (castsShadow !== undefined)
            scene.setLightCastsShadow(light, castsShadow);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        light,
        color,
        intensity,
        temperature,
        dirKey,
        posKey,
        attenuationStartDistance,
        attenuationEndDistance,
        innerAngle,
        outerAngle,
        castsShadow,
    ]);
    return light;
}
