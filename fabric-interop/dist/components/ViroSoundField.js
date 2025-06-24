"use strict";
/**
 * ViroSoundField
 *
 * A component for playing ambient audio field in the scene.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSoundField = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSoundField is a component for playing ambient audio field in the scene.
 * It provides 360-degree ambient audio that surrounds the listener.
 */
const ViroSoundField = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        paused: props.paused,
        volume: props.volume,
        muted: props.muted,
        loop: props.loop,
        rotation: props.rotation,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("soundField", nativeProps);
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
exports.ViroSoundField = ViroSoundField;
//# sourceMappingURL=ViroSoundField.js.map