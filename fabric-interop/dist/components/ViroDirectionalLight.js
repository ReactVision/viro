"use strict";
/**
 * ViroDirectionalLight
 *
 * A component for adding directional lighting to a scene.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroDirectionalLight = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroDirectionalLight is a component for adding directional lighting to a scene.
 * Directional light is a type of light that illuminates all objects in the scene
 * from a specific direction, similar to sunlight.
 */
const ViroDirectionalLight = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        color: props.color,
        intensity: props.intensity,
        temperature: props.temperature,
        direction: props.direction,
        influenceBitMask: props.influenceBitMask,
        castsShadow: props.castsShadow,
        shadowOpacity: props.shadowOpacity,
        shadowOrthographicSize: props.shadowOrthographicSize,
        shadowOrthographicPosition: props.shadowOrthographicPosition,
        shadowMapSize: props.shadowMapSize,
        shadowBias: props.shadowBias,
        shadowNearZ: props.shadowNearZ,
        shadowFarZ: props.shadowFarZ,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("directionalLight", nativeProps);
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
exports.ViroDirectionalLight = ViroDirectionalLight;
//# sourceMappingURL=ViroDirectionalLight.js.map