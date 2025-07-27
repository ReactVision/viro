"use strict";
/**
 * ViroLightingEnvironment
 *
 * A component for setting up environment-based lighting using HDR images.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroLightingEnvironment = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroLightingEnvironment is a component for setting up environment-based lighting using HDR images.
 * It provides realistic lighting and reflections based on a 360-degree HDR environment map.
 */
const ViroLightingEnvironment = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        intensity: props.intensity,
        rotation: props.rotation,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("lightingEnvironment", nativeProps);
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
exports.ViroLightingEnvironment = ViroLightingEnvironment;
