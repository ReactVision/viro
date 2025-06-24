"use strict";
/**
 * ViroSurface
 *
 * A component for rendering a flat surface in 3D space.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSurface = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSurface is a component for rendering a flat surface in 3D space.
 * It's similar to ViroQuad but with additional properties for more flexibility.
 */
const ViroSurface = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        width: props.width ?? 1,
        height: props.height ?? 1,
        uvCoordinates: props.uvCoordinates,
        materials: props.materials,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
        arShadowReceiver: props.arShadowReceiver,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("surface", nativeProps);
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
exports.ViroSurface = ViroSurface;
