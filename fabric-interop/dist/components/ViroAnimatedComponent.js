"use strict";
/**
 * ViroAnimatedComponent
 *
 * A component wrapper for adding animations to Viro components.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAnimatedComponent = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroAnimatedComponent is a wrapper for adding animations to Viro components.
 * It provides animation capabilities to its children.
 */
const ViroAnimatedComponent = (props) => {
    var _a, _b;
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        animation: props.animation,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("animatedComponent", nativeProps);
    // Register animation event handlers
    react_1.default.useEffect(() => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (!nativeViro || !props.animation)
            return;
        const eventHandlers = [
            { name: "onAnimationStart", handler: props.animation.onStart },
            { name: "onAnimationFinish", handler: props.animation.onFinish },
        ];
        // Register all event handlers and store callback IDs for cleanup
        const registeredCallbacks = eventHandlers
            .filter(({ handler }) => !!handler)
            .map(({ name, handler }) => {
            const callbackId = `${nodeId}_${name}`;
            // Register the callback in the global registry
            if (typeof global !== "undefined" && global.registerViroEventCallback) {
                global.registerViroEventCallback(callbackId, handler);
            }
            // Register with native code
            nativeViro.registerEventCallback(nodeId, name, callbackId);
            return { name, callbackId };
        });
        // Cleanup when unmounting
        return () => {
            const nativeViro = (0, ViroGlobal_1.getNativeViro)();
            if (!nativeViro)
                return;
            // Unregister all event handlers
            registeredCallbacks.forEach(({ name, callbackId }) => {
                nativeViro.unregisterEventCallback(nodeId, name, callbackId);
            });
        };
    }, [nodeId, (_a = props.animation) === null || _a === void 0 ? void 0 : _a.onStart, (_b = props.animation) === null || _b === void 0 ? void 0 : _b.onFinish]);
    // Render children with this animated component as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroAnimatedComponent = ViroAnimatedComponent;
//# sourceMappingURL=ViroAnimatedComponent.js.map