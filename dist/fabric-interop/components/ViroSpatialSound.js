"use strict";
/**
 * ViroSpatialSound
 *
 * A component for playing 3D positioned audio in the scene.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSpatialSound = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSpatialSound is a component for playing 3D positioned audio in the scene.
 * It provides spatial audio that changes based on the listener's position relative to the sound source.
 */
const ViroSpatialSound = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        paused: props.paused,
        volume: props.volume,
        muted: props.muted,
        loop: props.loop,
        minDistance: props.minDistance,
        maxDistance: props.maxDistance,
        rolloffModel: props.rolloffModel,
        distanceRolloffFactor: props.distanceRolloffFactor,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("spatialSound", nativeProps);
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
exports.ViroSpatialSound = ViroSpatialSound;
