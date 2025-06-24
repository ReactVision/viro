"use strict";
/**
 * ViroARImageMarker
 *
 * A component for detecting and tracking images in the real world.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARImageMarker = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroARImageMarker is a component for detecting and tracking images in the real world.
 * It allows you to attach virtual content to real-world images, such as posters, book covers, or logos.
 */
const ViroARImageMarker = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        target: props.target,
        visible: props.visible,
        opacity: props.opacity,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("arImageMarker", nativeProps);
    // Register event handlers
    react_1.default.useEffect(() => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (!nativeViro)
            return;
        const eventHandlers = [
            { name: "onAnchorFound", handler: props.onAnchorFound },
            { name: "onAnchorUpdated", handler: props.onAnchorUpdated },
            { name: "onAnchorRemoved", handler: props.onAnchorRemoved },
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
    }, [
        nodeId,
        props.onAnchorFound,
        props.onAnchorUpdated,
        props.onAnchorRemoved,
    ]);
    // Render children with this AR image marker as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroARImageMarker = ViroARImageMarker;
//# sourceMappingURL=ViroARImageMarker.js.map