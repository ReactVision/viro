"use strict";
/**
 * ViroGeometry
 *
 * A component for rendering custom 3D geometry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroGeometry = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroGeometry is a component for rendering custom 3D geometry.
 * It allows you to create custom 3D shapes by specifying vertices, normals,
 * texture coordinates, and triangle indices.
 */
const ViroGeometry = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        vertices: props.vertices,
        normals: props.normals,
        texcoords: props.texcoords,
        triangleIndices: props.triangleIndices,
        materials: props.materials,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
        type: props.type,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("geometry", nativeProps);
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
exports.ViroGeometry = ViroGeometry;
//# sourceMappingURL=ViroGeometry.js.map