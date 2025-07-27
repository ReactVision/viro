"use strict";
/**
 * ViroAnimatedImage
 *
 * A component for displaying animated images.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAnimatedImage = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroAnimatedImage is a component for displaying animated images.
 * It can be used to create simple animations by cycling through a series of images.
 */
const ViroAnimatedImage = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        loop: props.loop,
        delay: props.delay,
        visible: props.visible,
        opacity: props.opacity,
        width: props.width,
        height: props.height,
        materials: props.materials,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("animatedImage", nativeProps);
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
exports.ViroAnimatedImage = ViroAnimatedImage;
