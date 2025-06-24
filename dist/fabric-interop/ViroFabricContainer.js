"use strict";
/**
 * ViroFabricContainer
 *
 * This is the main container component that Fabric manages directly.
 * It serves as a viewport for the Viro rendering engine and delegates
 * rendering to the existing native implementation.
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
exports.ViroFabricContainer = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
// Check if New Architecture is enabled
const isNewArchitectureEnabled = () => {
    if (global.__turboModuleProxy == null) {
        throw new Error("Viro: New Architecture is not enabled. This library requires React Native New Architecture. " +
            "Please enable it in your app by following the instructions at: " +
            "https://reactnative.dev/docs/new-architecture-intro");
    }
    // We're assuming the minimum supported version (0.76.9+) since this is a Fabric-only component
    return true;
};
// Check if the component exists in UIManager
const isFabricComponentAvailable = () => {
    isNewArchitectureEnabled(); // This will throw if New Architecture is not enabled
    if (!react_native_1.UIManager.getViewManagerConfig ||
        react_native_1.UIManager.getViewManagerConfig("ViroFabricContainerView") == null) {
        throw new Error("ViroFabricContainerView is not available. Make sure you have installed the native module properly.");
    }
    return true;
};
// Define the native component
// @ts-ignore - TypeScript doesn't know about the props of the native component
const NativeViroFabricContainer = (0, react_native_1.requireNativeComponent)("ViroFabricContainerView");
/**
 * ViroFabricContainer is the main component that hosts the Viro rendering engine.
 * It creates a native view that the Viro renderer can draw on and manages the
 * lifecycle of the Viro system.
 */
const ViroFabricContainer = ({ debug = false, arEnabled = false, worldAlignment = "Gravity", onInitialized, onTrackingUpdated, onCameraTransformUpdate, onSceneStateChanged, onMemoryWarning, children, }) => {
    // Reference to the native component
    const containerRef = (0, react_1.useRef)(null);
    // Root node ID for the scene
    const rootNodeId = (0, react_1.useRef)("viro_root_scene");
    // Event callback registry
    const eventCallbacks = (0, react_1.useRef)({});
    // Set up event handling for JSI and fallback event emitter approach
    (0, react_1.useEffect)(() => {
        // Set up global event handler for JSI events
        if (typeof global !== "undefined") {
            // @ts-ignore - This property will be added by the native code
            global.handleViroEvent = (callbackId, eventData) => {
                // Find the callback in the registry and call it
                const callback = eventCallbacks.current[callbackId];
                if (callback) {
                    callback(eventData);
                }
                else {
                    console.warn(`No callback found for ID: ${callbackId}`);
                }
            };
        }
        // Set up event emitter for fallback approach
        const eventEmitter = new react_native_1.NativeEventEmitter(react_native_1.NativeModules.ViroFabricManager);
        // Add the ViroEvent listener
        const subscription = eventEmitter.addListener("ViroEvent", (event) => {
            const { callbackId, data } = event;
            const callback = eventCallbacks.current[callbackId];
            if (callback) {
                callback(data);
            }
            else {
                console.warn(`No callback found for ID: ${callbackId} (via event emitter)`);
            }
        });
        return () => {
            // Clean up event subscription
            subscription.remove();
            // Clean up global event handler
            if (typeof global !== "undefined") {
                // @ts-ignore - This property was added by us
                delete global.handleViroEvent;
            }
        };
    }, []);
    // Initialize the Viro system when the component mounts
    (0, react_1.useEffect)(() => {
        if (containerRef.current && isFabricComponentAvailable()) {
            const nodeHandle = (0, react_native_1.findNodeHandle)(containerRef.current);
            if (!nodeHandle) {
                console.error("Failed to get node handle for ViroFabricContainer");
                return;
            }
            try {
                // Use the codegenNativeCommands approach for New Architecture
                const ViroFabricContainerCommands = react_native_1.UIManager.getViewManagerConfig("ViroFabricContainerView").Commands;
                if (!ViroFabricContainerCommands) {
                    console.error("ViroFabricContainerView commands not found in UIManager");
                    return;
                }
                // Call the native method to initialize
                react_native_1.UIManager.dispatchViewManagerCommand(nodeHandle, ViroFabricContainerCommands.initialize, [debug || false, arEnabled || false, worldAlignment || "Gravity"]);
            }
            catch (error) {
                console.error("Failed to initialize ViroFabricContainer:", error);
            }
        }
        // Cleanup when unmounting
        return () => {
            if (containerRef.current) {
                const nodeHandle = (0, react_native_1.findNodeHandle)(containerRef.current);
                if (!nodeHandle)
                    return;
                try {
                    // Use the same approach as initialize for cleanup
                    const ViroFabricContainerCommands = react_native_1.UIManager.getViewManagerConfig("ViroFabricContainerView").Commands;
                    if (!ViroFabricContainerCommands ||
                        !ViroFabricContainerCommands.cleanup) {
                        console.error("ViroFabricContainerView cleanup command not found in UIManager");
                        return;
                    }
                    // Call the native method to cleanup
                    react_native_1.UIManager.dispatchViewManagerCommand(nodeHandle, ViroFabricContainerCommands.cleanup, []);
                }
                catch (error) {
                    console.error("Failed to cleanup ViroFabricContainer:", error);
                }
            }
        };
    }, [debug, arEnabled, worldAlignment]);
    // Handle initialization event
    const handleInitialized = (event) => {
        if (onInitialized) {
            onInitialized(event.nativeEvent.success);
        }
    };
    // Handle tracking updated event
    const handleTrackingUpdated = (event) => {
        if (onTrackingUpdated) {
            onTrackingUpdated(event.nativeEvent);
        }
    };
    // Handle camera transform update event
    const handleCameraTransformUpdate = (event) => {
        if (onCameraTransformUpdate) {
            onCameraTransformUpdate(event.nativeEvent);
        }
    };
    // Handle scene state changed event
    const handleSceneStateChanged = (event) => {
        if (onSceneStateChanged) {
            onSceneStateChanged(event.nativeEvent);
        }
    };
    // Handle memory warning event
    const handleMemoryWarning = (event) => {
        if (onMemoryWarning) {
            onMemoryWarning(event.nativeEvent);
        }
    };
    // This will throw an error if the native component is not available or New Architecture is not enabled
    isFabricComponentAvailable();
    return (<NativeViroFabricContainer ref={containerRef} style={{ flex: 1 }} onInitialized={handleInitialized} onTrackingUpdated={handleTrackingUpdated} onCameraTransformUpdate={handleCameraTransformUpdate} onSceneStateChanged={handleSceneStateChanged} onMemoryWarning={handleMemoryWarning}>
      {children}
    </NativeViroFabricContainer>);
};
exports.ViroFabricContainer = ViroFabricContainer;
