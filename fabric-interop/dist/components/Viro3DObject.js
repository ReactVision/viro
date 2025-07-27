"use strict";
/**
 * Viro3DObject
 *
 * A component for loading and displaying 3D models in various formats.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro3DObject = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * Viro3DObject is a component for loading and displaying 3D models in various formats.
 */
const Viro3DObject = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        resources: props.resources,
        type: props.type,
        materials: props.materials,
        morphTargets: props.morphTargets,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
        highAccuracyEvents: props.highAccuracyEvents,
        physicsBody: props.physicsBody,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("object", nativeProps);
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
    // Component doesn't have children, so just return null
    return null;
};
exports.Viro3DObject = Viro3DObject;
//# sourceMappingURL=Viro3DObject.js.map