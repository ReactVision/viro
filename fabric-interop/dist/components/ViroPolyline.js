"use strict";
/**
 * ViroPolyline
 *
 * A component for rendering a 3D polyline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroPolyline = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroPolyline is a component for rendering a 3D polyline.
 * It allows you to create a line that connects a series of points in 3D space.
 */
const ViroPolyline = (props) => {
    var _a, _b;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        points: props.points,
        thickness: (_a = props.thickness) !== null && _a !== void 0 ? _a : 0.1,
        materials: props.materials,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("polyline", nativeProps);
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
            : (_b = props.onFuse) === null || _b === void 0 ? void 0 : _b.callback,
        onCollision: props.onCollision,
        onTransformUpdate: props.onTransformUpdate,
    });
    // Component doesn't have children, so just return null
    return null;
};
exports.ViroPolyline = ViroPolyline;
//# sourceMappingURL=ViroPolyline.js.map