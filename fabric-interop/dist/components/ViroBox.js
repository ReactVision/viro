"use strict";
/**
 * ViroBox
 *
 * A 3D box component with customizable dimensions and materials.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroBox = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroBox is a 3D box component with customizable dimensions and materials.
 */
const ViroBox = (props) => {
    var _a, _b, _c, _d;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        width: (_a = props.width) !== null && _a !== void 0 ? _a : 1,
        height: (_b = props.height) !== null && _b !== void 0 ? _b : 1,
        length: (_c = props.length) !== null && _c !== void 0 ? _c : 1,
        materials: props.materials,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
        highAccuracyEvents: props.highAccuracyEvents,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("box", nativeProps);
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
            : (_d = props.onFuse) === null || _d === void 0 ? void 0 : _d.callback,
        onCollision: props.onCollision,
        onTransformUpdate: props.onTransformUpdate,
    });
    // Box doesn't have children, so just return null
    return null;
};
exports.ViroBox = ViroBox;
//# sourceMappingURL=ViroBox.js.map