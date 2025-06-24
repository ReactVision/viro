"use strict";
/**
 * ViroSpinner
 *
 * A component for displaying loading spinners in 3D space.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSpinner = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSpinner is a component for displaying loading spinners in 3D space.
 * It provides visual feedback during loading operations.
 */
const ViroSpinner = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        type: props.type,
        size: props.size,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("image", nativeProps);
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
exports.ViroSpinner = ViroSpinner;
