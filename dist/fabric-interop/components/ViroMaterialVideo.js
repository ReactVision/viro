"use strict";
/**
 * ViroMaterialVideo
 *
 * A component for using video as a material texture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroMaterialVideo = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroMaterialVideo is a component for using video as a material texture.
 * It allows video content to be applied as a texture to 3D objects.
 */
const ViroMaterialVideo = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        material: props.material,
        source: props.source,
        paused: props.paused,
        loop: props.loop,
        muted: props.muted,
        volume: props.volume,
        stereoMode: props.stereoMode,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("materialVideo", nativeProps);
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
exports.ViroMaterialVideo = ViroMaterialVideo;
