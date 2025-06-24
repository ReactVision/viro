"use strict";
/**
 * ViroButton
 *
 * A component for creating interactive buttons in 3D space.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroButton = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroButton is a component for creating interactive buttons in 3D space.
 * It provides visual feedback for different interaction states.
 */
const ViroButton = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        source: props.source,
        hoverSource: props.hoverSource,
        clickSource: props.clickSource,
        gazeSource: props.gazeSource,
        width: props.width,
        height: props.height,
        materials: props.materials,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("button", nativeProps);
    // Register event handlers
    react_1.default.useEffect(() => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (!nativeViro)
            return;
        const eventHandlers = [
            { name: "onHover", handler: props.onHover },
            { name: "onClick", handler: props.onClick },
            { name: "onClickState", handler: props.onClickState },
            { name: "onTouch", handler: props.onTouch },
            { name: "onDrag", handler: props.onDrag },
            { name: "onPinch", handler: props.onPinch },
            { name: "onRotate", handler: props.onRotate },
            {
                name: "onFuse",
                handler: typeof props.onFuse === "function"
                    ? props.onFuse
                    : props.onFuse?.callback,
            },
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
        props.onHover,
        props.onClick,
        props.onClickState,
        props.onTouch,
        props.onDrag,
        props.onPinch,
        props.onRotate,
        props.onFuse,
    ]);
    // Render children with this button as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroButton = ViroButton;
