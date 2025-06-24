"use strict";
/**
 * ViroUtils
 *
 * Common utility functions and hooks for Viro components.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroContextProvider = exports.useViroParent = exports.ViroContext = void 0;
exports.useViroNode = useViroNode;
exports.useViroChildren = useViroChildren;
exports.convertCommonProps = convertCommonProps;
exports.useViroEventListeners = useViroEventListeners;
const react_1 = __importStar(require("react"));
const NativeViro_1 = require("../NativeViro");
// Create a proper React Context to pass parent node IDs down the component tree
exports.ViroContext = react_1.default.createContext("viro_root_scene");
// Hook to get the current parent node ID
const useViroParent = () => {
    return react_1.default.useContext(exports.ViroContext);
};
exports.useViroParent = useViroParent;
// Hook to manage a node's lifecycle
function useViroNode(nodeType, props, explicitParentId) {
    const nodeId = (0, react_1.useRef)((0, NativeViro_1.generateNodeId)());
    const contextParentId = (0, exports.useViroParent)();
    // Use explicit parent ID if provided, otherwise use context
    const parentId = explicitParentId || contextParentId;
    (0, react_1.useEffect)(() => {
        // Create the node when the component mounts using our enhanced functions
        (0, NativeViro_1.createNode)(nodeId.current, nodeType, props);
        // Add to parent if specified
        if (parentId) {
            (0, NativeViro_1.addChild)(parentId, nodeId.current);
        }
        // Clean up when the component unmounts
        return () => {
            // Remove from parent if specified
            if (parentId) {
                (0, NativeViro_1.removeChild)(parentId, nodeId.current);
            }
            // Delete the node
            (0, NativeViro_1.deleteNode)(nodeId.current);
        };
    }, [nodeType, parentId]);
    // Update props when they change
    (0, react_1.useEffect)(() => {
        (0, NativeViro_1.updateNode)(nodeId.current, props);
    }, [props]);
    return nodeId.current;
}
// Hook to manage a node's children
function useViroChildren(nodeId, children) {
    // Create a context provider to pass the parent ID to children
    return children;
}
// Helper to convert common props to the format expected by the native code
function convertCommonProps(props) {
    const { position, rotation, scale, transformBehaviors, opacity, visible, animation, ...rest } = props;
    const convertedProps = {
        ...rest,
    };
    if (position)
        convertedProps.position = position;
    if (rotation)
        convertedProps.rotation = rotation;
    if (scale !== undefined) {
        if (typeof scale === "number") {
            convertedProps.scale = [scale, scale, scale];
        }
        else {
            convertedProps.scale = scale;
        }
    }
    if (transformBehaviors)
        convertedProps.transformBehaviors = transformBehaviors;
    if (opacity !== undefined)
        convertedProps.opacity = opacity;
    if (visible !== undefined)
        convertedProps.visible = visible;
    if (animation)
        convertedProps.animation = animation;
    return convertedProps;
}
// Hook to manage event listeners for a node
function useViroEventListeners(nodeId, eventHandlers) {
    (0, react_1.useEffect)(() => {
        // Register all event handlers and store callback IDs for cleanup
        const registeredCallbacks = [];
        Object.entries(eventHandlers).forEach(([eventName, handler]) => {
            if (handler) {
                const callbackId = (0, NativeViro_1.registerEventListener)(nodeId, eventName, handler);
                registeredCallbacks.push({ name: eventName, callbackId });
            }
        });
        // Cleanup when unmounting or dependencies change
        return () => {
            registeredCallbacks.forEach(({ name, callbackId }) => {
                (0, NativeViro_1.unregisterEventListener)(nodeId, name, callbackId);
            });
        };
    }, [nodeId, ...Object.values(eventHandlers)]);
}
// Provider component for ViroContext
const ViroContextProvider = ({ value, children, }) => {
    return react_1.default.createElement(exports.ViroContext.Provider, { value }, children);
};
exports.ViroContextProvider = ViroContextProvider;
