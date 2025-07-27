"use strict";
/**
 * ViroSpotLight
 *
 * A component for adding spot lighting to a scene.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSpotLight = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSpotLight is a component for adding spot lighting to a scene.
 * Spot light is a type of light that illuminates objects in a cone-shaped area,
 * similar to a flashlight or stage spotlight.
 */
const ViroSpotLight = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        color: props.color,
        intensity: props.intensity,
        temperature: props.temperature,
        direction: props.direction,
        innerAngle: props.innerAngle,
        outerAngle: props.outerAngle,
        attenuationStartDistance: props.attenuationStartDistance,
        attenuationEndDistance: props.attenuationEndDistance,
        influenceBitMask: props.influenceBitMask,
        castsShadow: props.castsShadow,
        shadowOpacity: props.shadowOpacity,
        shadowMapSize: props.shadowMapSize,
        shadowBias: props.shadowBias,
        shadowNearZ: props.shadowNearZ,
        shadowFarZ: props.shadowFarZ,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("spotLight", nativeProps);
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
            : props.onFuse?.callback,
        onCollision: props.onCollision,
        onTransformUpdate: props.onTransformUpdate,
    });
    // Component doesn't have children, so just return null
    return null;
};
exports.ViroSpotLight = ViroSpotLight;
