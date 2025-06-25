package com.viromedia.bridge.fabric;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.component.node.VRTNode;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viro.core.EventDelegate;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.lang.ref.WeakReference;

/**
 * ViroFabricEventDelegate handles all event management for the Fabric interop layer.
 * It manages event registration, callback handling, and memory cleanup.
 */
public class ViroFabricEventDelegate {
    
    private static final String TAG = "ViroFabricEventDelegate";
    
    // Event callback registry - maps event keys to callback IDs
    private final Map<String, String> mEventCallbackRegistry = new ConcurrentHashMap<>();
    
    // Component event delegates - for integration with existing VRT event system
    private final Map<String, WeakReference<ComponentEventDelegate>> mComponentDelegates = new ConcurrentHashMap<>();
    
    // Managed nodes for memory cleanup
    private final List<WeakReference<VRTNode>> mManagedNodes = new ArrayList<>();
    
    // Container reference
    private final WeakReference<ViroFabricContainer> mContainer;
    private final ThemedReactContext mReactContext;
    private final int mContainerId;
    
    // Event types that we support
    private static final String[] SUPPORTED_EVENTS = {
        "onClick", "onTouch", "onHover", "onScroll", "onSwipe", "onDrag", 
        "onFuse", "onPinch", "onRotate", "onCollision", "onTransformUpdate",
        "onLoadStart", "onLoadEnd", "onError", "onAnimationStart", 
        "onAnimationFinish", "onSoundFinish"
    };
    
    public ViroFabricEventDelegate(ViroFabricContainer container, ThemedReactContext reactContext, int containerId) {
        mContainer = new WeakReference<>(container);
        mReactContext = reactContext;
        mContainerId = containerId;
    }
    
    /**
     * Register an event callback for a specific component and event.
     */
    public void registerEventCallback(String callbackId, String eventName, String componentId) {
        Log.d(TAG, "Registering event callback: " + callbackId + " for event: " + eventName + " on component: " + componentId);
        
        try {
            // Create event key
            String eventKey = componentId + "_" + eventName;
            
            // Store the callback mapping
            mEventCallbackRegistry.put(eventKey, callbackId);
            
            // Set up the actual event listener on the component
            setupComponentEventListener(componentId, eventName, callbackId);
            
            Log.d(TAG, "Successfully registered event callback for " + eventKey);
        } catch (Exception e) {
            Log.e(TAG, "Error registering event callback: " + e.getMessage(), e);
        }
    }
    
    /**
     * Unregister an event callback.
     */
    public void unregisterEventCallback(String callbackId, String eventName, String componentId) {
        Log.d(TAG, "Unregistering event callback: " + callbackId + " for event: " + eventName + " on component: " + componentId);
        
        try {
            // Create event key
            String eventKey = componentId + "_" + eventName;
            
            // Remove the callback mapping
            mEventCallbackRegistry.remove(eventKey);
            
            // Remove the actual event listener from the component
            removeComponentEventListener(componentId, eventName);
            
            Log.d(TAG, "Successfully unregistered event callback for " + eventKey);
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering event callback: " + e.getMessage(), e);
        }
    }
    
    /**
     * Dispatch an event to JavaScript.
     */
    public void dispatchEvent(String componentId, String eventName, WritableMap eventData) {
        Log.d(TAG, "Dispatching event: " + eventName + " for component: " + componentId);
        
        try {
            // Get the callback ID for this event
            String eventKey = componentId + "_" + eventName;
            String callbackId = mEventCallbackRegistry.get(eventKey);
            
            if (callbackId == null) {
                Log.w(TAG, "No callback registered for event: " + eventKey);
                return;
            }
            
            // Get the container to dispatch the event
            ViroFabricContainer container = mContainer.get();
            if (container != null) {
                container.dispatchEventToJS(callbackId, eventData);
            } else {
                Log.w(TAG, "Container not available for event dispatch");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error dispatching event: " + e.getMessage(), e);
        }
    }
    
    /**
     * Set up an event listener on a specific component.
     */
    private void setupComponentEventListener(String componentId, String eventName, String callbackId) {
        ViroFabricContainer container = mContainer.get();
        if (container == null) {
            Log.w(TAG, "Container not available for setting up event listener");
            return;
        }
        
        // Get the component from the container's registry
        VRTComponent component = container.mComponentRegistry.get(componentId);
        if (component == null) {
            Log.w(TAG, "Component not found for event setup: " + componentId);
            return;
        }
        
        try {
            // Set up the event listener using the existing VRT event system
            if (component instanceof VRTNode) {
                VRTNode node = (VRTNode) component;
                
                // VRTNode already has its own ComponentEventDelegate and EventDelegate setup
                // We just need to enable the specific event type on the node
                enableEventOnNode(node, eventName);
                
                // Store a reference to the existing ComponentEventDelegate for cleanup
                // Note: VRTNode creates its own ComponentEventDelegate in its constructor
                mComponentDelegates.put(componentId, new WeakReference<>(null)); // Placeholder for tracking
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error setting up component event listener: " + e.getMessage(), e);
        }
    }
    
    /**
     * Enable a specific event type on a VRT node.
     */
    private void enableEventOnNode(VRTNode node, String eventName) {
        try {
            // Enable event handling on the node based on event type
            switch (eventName) {
                case "onClick":
                    setNodeEventProperty(node, "setCanClick", true);
                    break;
                    
                case "onTouch":
                    setNodeEventProperty(node, "setCanTouch", true);
                    break;
                    
                case "onHover":
                    setNodeEventProperty(node, "setCanHover", true);
                    break;
                    
                case "onDrag":
                    setNodeEventProperty(node, "setCanDrag", true);
                    break;
                    
                case "onFuse":
                    setNodeEventProperty(node, "setCanFuse", true);
                    break;
                    
                case "onPinch":
                    setNodeEventProperty(node, "setCanPinch", true);
                    break;
                    
                case "onRotate":
                    setNodeEventProperty(node, "setCanRotate", true);
                    break;
                    
                case "onScroll":
                    setNodeEventProperty(node, "setCanScroll", true);
                    break;
                    
                case "onSwipe":
                    setNodeEventProperty(node, "setCanSwipe", true);
                    break;
                    
                default:
                    Log.w(TAG, "Unsupported event type for enabling: " + eventName);
                    break;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error enabling event " + eventName + " on node: " + e.getMessage(), e);
        }
    }
    
    /**
     * Convert VRT event arguments to WritableMap.
     */
    private WritableMap convertArgsToEventData(Object... args) {
        WritableMap eventData = new WritableNativeMap();
        
        try {
            // Add common event properties
            eventData.putDouble("timestamp", System.currentTimeMillis());
            
            // Convert arguments based on their types
            for (int i = 0; i < args.length; i++) {
                Object arg = args[i];
                String key = "arg" + i;
                
                if (arg instanceof String) {
                    eventData.putString(key, (String) arg);
                } else if (arg instanceof Number) {
                    eventData.putDouble(key, ((Number) arg).doubleValue());
                } else if (arg instanceof Boolean) {
                    eventData.putBoolean(key, (Boolean) arg);
                } else if (arg instanceof float[]) {
                    // Convert float arrays (common for positions, rotations)
                    float[] floatArray = (float[]) arg;
                    WritableMap arrayMap = new WritableNativeMap();
                    for (int j = 0; j < floatArray.length; j++) {
                        arrayMap.putDouble(String.valueOf(j), floatArray[j]);
                    }
                    eventData.putMap(key, arrayMap);
                } else if (arg != null) {
                    eventData.putString(key, arg.toString());
                }
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error converting event args: " + e.getMessage(), e);
        }
        
        return eventData;
    }
    
    /**
     * Remove an event listener from a component.
     */
    private void removeComponentEventListener(String componentId, String eventName) {
        ViroFabricContainer container = mContainer.get();
        if (container == null) {
            return;
        }
        
        VRTComponent component = container.mComponentRegistry.get(componentId);
        if (component instanceof VRTNode) {
            VRTNode node = (VRTNode) component;
            
            try {
                // Remove event listeners by setting them to null
                switch (eventName) {
                    case "onClick":
                        setNodeEventProperty(node, "setOnClickListener", null);
                        break;
                    case "onTouch":
                        setNodeEventProperty(node, "setOnTouchListener", null);
                        break;
                    case "onHover":
                        setNodeEventProperty(node, "setOnHoverListener", null);
                        break;
                    // Add other event types as needed
                }
            } catch (Exception e) {
                Log.e(TAG, "Error removing event listener: " + e.getMessage(), e);
            }
        }
    }
    
    /**
     * Set an event property on a VRT node using reflection.
     */
    private void setNodeEventProperty(VRTNode node, String methodName, Object value) {
        try {
            Class<?> paramType = null;
            if (value instanceof Boolean) {
                paramType = boolean.class;
            } else if (value instanceof Float) {
                paramType = float.class;
            } else if (value instanceof Integer) {
                paramType = int.class;
            } else if (value instanceof String) {
                paramType = String.class;
            } else if (value == null) {
                paramType = Object.class;
            } else {
                paramType = value.getClass();
            }
            
            java.lang.reflect.Method method = node.getClass().getMethod(methodName, paramType);
            method.invoke(node, value);
        } catch (Exception e) {
            Log.w(TAG, "Could not set event property " + methodName + ": " + e.getMessage());
        }
    }
    
    /**
     * Check if a node has a specific method.
     */
    private boolean hasMethod(VRTNode node, String methodName) {
        try {
            node.getClass().getMethod(methodName, Object.class);
            return true;
        } catch (NoSuchMethodException e) {
            return false;
        }
    }
    
    /**
     * Register a node for memory management.
     */
    public void registerManagedNode(VRTNode node) {
        if (node != null) {
            mManagedNodes.add(new WeakReference<>(node));
        }
    }
    
    /**
     * Clean up all event listeners and managed resources.
     */
    public void dispose() {
        Log.d(TAG, "Disposing ViroFabricEventDelegate");
        
        try {
            // Clear all event callbacks
            mEventCallbackRegistry.clear();
            
            // Clear component delegates
            mComponentDelegates.clear();
            
            // Clear managed nodes
            mManagedNodes.clear();
            
            Log.d(TAG, "ViroFabricEventDelegate disposed successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error disposing ViroFabricEventDelegate: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get event statistics for debugging.
     */
    public WritableMap getEventStats() {
        WritableMap stats = new WritableNativeMap();
        
        try {
            stats.putInt("registeredCallbacks", mEventCallbackRegistry.size());
            stats.putInt("componentDelegates", mComponentDelegates.size());
            stats.putInt("managedNodes", mManagedNodes.size());
            
            // Clean up stale references
            int staleNodes = 0;
            for (WeakReference<VRTNode> nodeRef : mManagedNodes) {
                if (nodeRef.get() == null) {
                    staleNodes++;
                }
            }
            stats.putInt("staleNodeReferences", staleNodes);
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting event stats: " + e.getMessage(), e);
        }
        
        return stats;
    }
}
