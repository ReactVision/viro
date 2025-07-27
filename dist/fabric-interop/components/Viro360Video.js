"use strict";
/**
 * Viro360Video
 *
 * A component for displaying 360-degree videos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro360Video = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * Viro360Video is a component for displaying 360-degree videos.
 * It creates an immersive environment using spherical panoramic videos.
 */
const Viro360Video = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        paused: props.paused,
        loop: props.loop,
        muted: props.muted,
        volume: props.volume,
        stereoMode: props.stereoMode,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("360Video", nativeProps);
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
exports.Viro360Video = Viro360Video;
