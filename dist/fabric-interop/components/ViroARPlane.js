"use strict";
/**
 * ViroARPlane
 *
 * A component for rendering AR planes detected by the AR system.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARPlane = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroARPlane is a component for rendering AR planes detected by the AR system.
 * It represents a real-world surface detected by the AR system, such as a floor, table, or wall.
 */
const ViroARPlane = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        alignment: props.alignment,
        minHeight: props.minHeight,
        minWidth: props.minWidth,
        visible: props.visible,
        opacity: props.opacity,
        materials: props.materials,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("arPlane", nativeProps);
    // Register event handlers
    react_1.default.useEffect(() => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (!nativeViro)
            return;
        const eventHandlers = [
            { name: "onAnchorFound", handler: props.onAnchorFound },
            { name: "onAnchorUpdated", handler: props.onAnchorUpdated },
            { name: "onAnchorRemoved", handler: props.onAnchorRemoved },
            { name: "onHover", handler: props.onHover },
            { name: "onClick", handler: props.onClick },
            { name: "onClickState", handler: props.onClickState },
            { name: "onTouch", handler: props.onTouch },
            { name: "onDrag", handler: props.onDrag },
            { name: "onPinch", handler: props.onPinch },
            { name: "onRotate", handler: props.onRotate },
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
        props.onHover,
        props.onClick,
        props.onClickState,
        props.onTouch,
        props.onDrag,
        props.onPinch,
        props.onRotate,
    ]);
    // Render children with this AR plane as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroARPlane = ViroARPlane;
