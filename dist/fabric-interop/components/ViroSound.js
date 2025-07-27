"use strict";
/**
 * ViroSound
 *
 * A component for playing audio in the scene.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSound = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSound is a component for playing audio in the scene.
 * It provides basic audio playback functionality.
 */
const ViroSound = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        paused: props.paused,
        volume: props.volume,
        muted: props.muted,
        loop: props.loop,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("sound", nativeProps);
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
exports.ViroSound = ViroSound;
