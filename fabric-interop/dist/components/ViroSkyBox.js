"use strict";
/**
 * ViroSkyBox
 *
 * A component for creating skybox environments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSkyBox = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroSkyBox is a component for creating skybox environments.
 * It uses six cube faces to create an immersive 360-degree environment.
 */
const ViroSkyBox = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        format: props.format,
        isHdr: props.isHdr,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("skyBox", nativeProps);
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
exports.ViroSkyBox = ViroSkyBox;
//# sourceMappingURL=ViroSkyBox.js.map