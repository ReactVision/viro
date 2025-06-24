"use strict";
/**
 * ViroFlexView
 *
 * A component for creating flexible layouts in 3D space.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroFlexView = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroFlexView is a component for creating flexible layouts in 3D space.
 * It allows you to arrange child components using flexbox-like layout rules.
 */
const ViroFlexView = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        width: props.width,
        height: props.height,
        flex: props.flex,
        flexDirection: props.flexDirection,
        justifyContent: props.justifyContent,
        alignItems: props.alignItems,
        padding: props.padding,
        paddingTop: props.paddingTop,
        paddingBottom: props.paddingBottom,
        paddingLeft: props.paddingLeft,
        paddingRight: props.paddingRight,
        margin: props.margin,
        marginTop: props.marginTop,
        marginBottom: props.marginBottom,
        marginLeft: props.marginLeft,
        marginRight: props.marginRight,
        backgroundColor: props.backgroundColor,
        borderRadius: props.borderRadius,
        borderWidth: props.borderWidth,
        borderColor: props.borderColor,
        materials: props.materials,
    };
    // Create the node (parent will be determined by context)
    const nodeId = (0, ViroUtils_1.useViroNode)("flexView", nativeProps);
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
    ]);
    // Render children with this flex view as their parent
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroFlexView = ViroFlexView;
//# sourceMappingURL=ViroFlexView.js.map