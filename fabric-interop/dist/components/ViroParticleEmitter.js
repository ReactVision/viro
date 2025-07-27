"use strict";
/**
 * ViroParticleEmitter
 *
 * A component for creating particle effects.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroParticleEmitter = void 0;
const ViroUtils_1 = require("./ViroUtils");
/**
 * ViroParticleEmitter is a component for creating particle effects.
 * It provides a flexible system for creating various particle-based visual effects.
 */
const ViroParticleEmitter = (props) => {
    var _a;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        duration: props.duration,
        delay: props.delay,
        loop: props.loop,
        run: props.run,
        fixedToEmitter: props.fixedToEmitter,
        image: props.image,
        spawnBehavior: props.spawnBehavior,
        particleAppearance: props.particleAppearance,
        particlePhysics: props.particlePhysics,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("particle", nativeProps);
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
exports.ViroParticleEmitter = ViroParticleEmitter;
//# sourceMappingURL=ViroParticleEmitter.js.map