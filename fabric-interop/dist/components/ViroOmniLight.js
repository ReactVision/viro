"use strict";
/**
 * ViroOmniLight
 *
 * A component for adding omnidirectional lighting to a scene.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroOmniLight = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroOmniLight is a component for adding omnidirectional lighting to a scene.
 * Omni light is a type of light that illuminates objects in all directions
 * from a single point, similar to a light bulb.
 */
const ViroOmniLight = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        color: props.color,
        intensity: props.intensity,
        temperature: props.temperature,
        attenuationStartDistance: props.attenuationStartDistance,
        attenuationEndDistance: props.attenuationEndDistance,
        influenceBitMask: props.influenceBitMask,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("omniLight", nativeProps);
    // Register event handlers using our new event system
    (0, ViroUtils_1.useViroEventListeners)(nodeId, {
        onHover: props.onHover,
        onClick: props.onClick,
        onClickState: props.onClickState,
        onTouch: props.onTouch,
        onScroll: props.onScroll,
        onSwipe: props.onSwipe,
        onDrag: props.onDrag,
        onPinch: props.onPinch,
        onRotate: props.onRotate,
        onFuse: typeof props.onFuse === "function"
            ? props.onFuse
            : (_a = props.onFuse) === null || _a === void 0 ? void 0 : _a.callback,
        onCollision: props.onCollision,
        onTransformUpdate: props.onTransformUpdate,
    });
    // Component doesn't have children, so just return null
    return null;
};
exports.ViroOmniLight = ViroOmniLight;
//# sourceMappingURL=ViroOmniLight.js.map