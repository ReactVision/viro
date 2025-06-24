"use strict";
/**
 * Viro360Image
 *
 * A component for displaying 360-degree images.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro360Image = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * Viro360Image is a component for displaying 360-degree images.
 * It creates an immersive environment using spherical panoramic images.
 */
const Viro360Image = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        stereoMode: props.stereoMode,
        format: props.format,
        isHdr: props.isHdr,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("360Image", nativeProps);
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
exports.Viro360Image = Viro360Image;
