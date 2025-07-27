"use strict";
/**
 * ViroImage
 *
 * A component for displaying 2D images in 3D space.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroImage = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroImage is a component for displaying 2D images in 3D space.
 */
const ViroImage = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        width: props.width,
        height: props.height,
        resizeMode: props.resizeMode,
        imageClipMode: props.imageClipMode,
        stereoMode: props.stereoMode,
        format: props.format,
        mipmap: props.mipmap,
        placeholderSource: props.placeholderSource,
        materials: props.materials,
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
            : (_a = props.onFuse) === null || _a === void 0 ? void 0 : _a.callback,
        onCollision: props.onCollision,
        onTransformUpdate: props.onTransformUpdate,
    });
    // Image doesn't have children, so just return null
    return null;
};
exports.ViroImage = ViroImage;
//# sourceMappingURL=ViroImage.js.map