"use strict";
/**
 * ViroARScene
 *
 * A specialized scene for AR content that uses the device's camera as a background.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARScene = void 0;
const react_1 = __importDefault(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * ViroARScene is a specialized scene for AR content that uses the device's camera as a background.
 */
const ViroARScene = (props) => {
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        anchorDetectionTypes: props.anchorDetectionTypes,
        planeDetectionEnabled: props.planeDetectionEnabled,
        lightReceivingBitMask: props.lightReceivingBitMask,
        shadowCastingBitMask: props.shadowCastingBitMask,
        physicsWorld: props.physicsWorld,
        postProcessEffects: props.postProcessEffects,
        onTrackingUpdated: props.onTrackingUpdated ? true : undefined,
        onAmbientLightUpdate: props.onAmbientLightUpdate ? true : undefined,
        onPlatformUpdate: props.onPlatformUpdate ? true : undefined,
        onCameraTransformUpdate: props.onCameraTransformUpdate ? true : undefined,
        onAnchorFound: props.onAnchorFound ? true : undefined,
        onAnchorUpdated: props.onAnchorUpdated ? true : undefined,
        onAnchorRemoved: props.onAnchorRemoved ? true : undefined,
    };
    // Create the AR scene node - this is a root node, so no parent
    const nodeId = (0, ViroUtils_1.useViroNode)("arScene", nativeProps);
    // Register event handlers
    react_1.default.useEffect(() => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (!nativeViro)
            return;
        // Register event handlers if provided
        const eventHandlers = [
            { name: "onTrackingUpdated", handler: props.onTrackingUpdated },
            { name: "onAmbientLightUpdate", handler: props.onAmbientLightUpdate },
            { name: "onPlatformUpdate", handler: props.onPlatformUpdate },
            {
                name: "onCameraTransformUpdate",
                handler: props.onCameraTransformUpdate,
            },
            { name: "onAnchorFound", handler: props.onAnchorFound },
            { name: "onAnchorUpdated", handler: props.onAnchorUpdated },
            { name: "onAnchorRemoved", handler: props.onAnchorRemoved },
        ];
        // Register all event handlers
        const registeredCallbacks = eventHandlers
            .filter(({ handler }) => !!handler)
            .map(({ name, handler }) => {
            const callbackId = `${nodeId}_${name}`;
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
        props.onTrackingUpdated,
        props.onAmbientLightUpdate,
        props.onPlatformUpdate,
        props.onCameraTransformUpdate,
        props.onAnchorFound,
        props.onAnchorUpdated,
        props.onAnchorRemoved,
    ]);
    // Render children with this scene as their parent
    return (<ViroUtils_2.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_2.ViroContextProvider>);
};
exports.ViroARScene = ViroARScene;
// Import ViroContextProvider at the top level to avoid circular dependencies
const ViroUtils_2 = require("./ViroUtils");
