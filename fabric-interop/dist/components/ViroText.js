"use strict";
/**
 * ViroText
 *
 * A component for rendering 3D text in the Viro scene.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroText = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroText is a component for rendering 3D text in the Viro scene.
 */
const ViroText = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        text: props.text,
        color: props.color,
        fontFamily: props.fontFamily,
        fontSize: props.fontSize,
        fontWeight: props.fontWeight,
        fontStyle: props.fontStyle,
        textAlign: props.textAlign,
        textAlignVertical: props.textAlignVertical,
        textLineBreakMode: props.textLineBreakMode,
        textClipMode: props.textClipMode,
        width: props.width,
        height: props.height,
        maxWidth: props.maxWidth,
        maxHeight: props.maxHeight,
        materials: props.materials,
        extrusionDepth: props.extrusionDepth,
        outerStroke: props.outerStroke,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("text", nativeProps);
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
    // Text doesn't have children, so just return null
    return null;
};
exports.ViroText = ViroText;
//# sourceMappingURL=ViroText.js.map