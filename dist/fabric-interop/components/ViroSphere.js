"use strict";
/**
 * ViroSphere
 *
 * A 3D sphere component with customizable radius and materials.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSphere = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSphere is a 3D sphere component with customizable radius and materials.
 */
const ViroSphere = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        radius: props.radius ?? 1,
        facesCount: props.facesCount,
        segmentCount: props.segmentCount,
        widthSegmentCount: props.widthSegmentCount,
        heightSegmentCount: props.heightSegmentCount,
        materials: props.materials,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
        highAccuracyEvents: props.highAccuracyEvents,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("sphere", nativeProps);
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
    // Sphere doesn't have children, so just return null
    return null;
};
exports.ViroSphere = ViroSphere;
