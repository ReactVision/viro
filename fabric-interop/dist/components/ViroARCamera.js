"use strict";
/**
 * ViroARCamera
 *
 * A component for controlling the camera in an AR scene.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARCamera = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroARCamera is a component for controlling the camera in an AR scene.
 * It provides information about the camera's position and orientation in the real world,
 * as well as tracking state updates.
 */
const ViroARCamera = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        active: props.active,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("arCamera", nativeProps);
    // Register event handlers
    react_1.default.useEffect(() => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (!nativeViro)
            return;
        const eventHandlers = [
            { name: "onTransformUpdate", handler: props.onTransformUpdate },
            { name: "onTrackingUpdated", handler: props.onTrackingUpdated },
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
    }, [nodeId, props.onTransformUpdate, props.onTrackingUpdated]);
    // Render children with this AR camera as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroARCamera = ViroARCamera;
//# sourceMappingURL=ViroARCamera.js.map