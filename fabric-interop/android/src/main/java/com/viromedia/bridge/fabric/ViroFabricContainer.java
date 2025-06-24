package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.facebook.jni.HybridData;
import com.facebook.jni.annotations.DoNotStrip;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.facebook.react.bridge.RuntimeExecutor;

import com.viromedia.bridge.component.VRTSceneNavigator;
import com.viromedia.bridge.component.VRTARSceneNavigator;
import com.viromedia.bridge.component.VRTVRSceneNavigator;
import com.viromedia.bridge.component.node.VRTNode;
import com.viromedia.bridge.component.node.VRTScene;
import com.viromedia.bridge.component.node.VRTARScene;
import com.viromedia.bridge.component.node.control.VRTBox;
import com.viromedia.bridge.utility.ComponentEventDelegate.VRTEventListener;

import java.util.HashMap;
import java.util.Map;

/**
 * ViroFabricContainer is the main container view for Viro content.
 * It serves as a bridge between React Native's New Architecture (Fabric)
 * and the existing Viro implementation.
 */
public class ViroFabricContainer extends FrameLayout {

    // Native navigator references
    private VRTSceneNavigator mSceneNavigator;
    private VRTARSceneNavigator mARSceneNavigator;
    private VRTVRSceneNavigator mVRSceneNavigator;

    // Node registry
    private Map<String, Object> mNodeRegistry = new HashMap<>();

    // Event callback registry
    private Map<String, String> mEventCallbackRegistry = new HashMap<>();

    // Flags
    private boolean mIsAR = false;
    private boolean mIsVR = false;

    // React context
    private ThemedReactContext mReactContext;

    // JSI bridge
    @DoNotStrip
    private HybridData mHybridData;
    
    // Tag for logging
    private static final String TAG = "ViroFabricContainer";

    public ViroFabricContainer(ThemedReactContext context) {
        super(context);
        mReactContext = context;

        // Set layout parameters
        setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // Check if we're running with the New Architecture
        if (!isNewArchitectureEnabled()) {
            throw new RuntimeException("ViroFabricContainer requires the New Architecture to be enabled");
        }

        // Initialize JSI bridge on the UI thread
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    initHybrid();
                    Log.d(TAG, "JSI bridge initialized successfully");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to initialize JSI bridge", e);
                }
            }
        });
    }
    
    /**
     * Check if the New Architecture is enabled.
     */
    private boolean isNewArchitectureEnabled() {
        try {
            Class.forName("com.facebook.react.bridge.RuntimeExecutor");
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        super.onLayout(changed, left, top, right, bottom);

        // Update the layout of the navigator
        if (mSceneNavigator != null) {
            mSceneNavigator.layout(left, top, right, bottom);
        }
        if (mARSceneNavigator != null) {
            mARSceneNavigator.layout(left, top, right, bottom);
        }
        if (mVRSceneNavigator != null) {
            mVRSceneNavigator.layout(left, top, right, bottom);
        }
    }

    /**
     * Initialize the Viro system.
     */
    public void initialize(boolean debug, boolean arEnabled, String worldAlignment) {
        // Clean up any existing navigators
        cleanup();

        // Create the appropriate navigator based on the mode
        if (arEnabled) {
            mIsAR = true;
            mARSceneNavigator = new VRTARSceneNavigator(mReactContext);
            mARSceneNavigator.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));
            addView(mARSceneNavigator);

            // Set world alignment if specified
            if ("GravityAndHeading".equals(worldAlignment)) {
                // Set world alignment to gravity and heading
                // This would use the existing VRTARSceneNavigator API
            } else if ("Camera".equals(worldAlignment)) {
                // Set world alignment to camera
                // This would use the existing VRTARSceneNavigator API
            } else {
                // Set world alignment to gravity (default)
                // This would use the existing VRTARSceneNavigator API
            }
        } else if (mIsVR) {
            mVRSceneNavigator = new VRTVRSceneNavigator(mReactContext);
            mVRSceneNavigator.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));
            addView(mVRSceneNavigator);
        } else {
            mSceneNavigator = new VRTSceneNavigator(mReactContext);
            mSceneNavigator.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));
            addView(mSceneNavigator);
        }

        // Notify JS that initialization is complete
        WritableMap event = new WritableNativeMap();
        event.putBoolean("success", true);
        sendEvent("onInitialized", event);
    }

    /**
     * Clean up the Viro system.
     */
    public void cleanup() {
        // Remove and release any existing navigators
        if (mSceneNavigator != null) {
            removeView(mSceneNavigator);
            mSceneNavigator = null;
        }
        if (mARSceneNavigator != null) {
            removeView(mARSceneNavigator);
            mARSceneNavigator = null;
        }
        if (mVRSceneNavigator != null) {
            removeView(mVRSceneNavigator);
            mVRSceneNavigator = null;
        }

        // Clear node registry
        mNodeRegistry.clear();

        // Clear event callback registry
        mEventCallbackRegistry.clear();

        // Reset flags
        mIsAR = false;
        mIsVR = false;
    }

    /**
     * Send an event to JavaScript.
     */
    private void sendEvent(String eventName, WritableMap params) {
        // Ensure we're on the UI thread
        if (UiThreadUtil.isOnUiThread()) {
            mReactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                    getId(),
                    eventName,
                    params);
        } else {
            UiThreadUtil.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    mReactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                            getId(),
                            eventName,
                            params);
                }
            });
        }
    }

    /**
     * Initialize the hybrid C++ bridge.
     */
    private native void initHybrid();

    /**
     * Get the active navigator.
     */
    private ViewGroup getActiveNavigator() {
        if (mARSceneNavigator != null) {
            return mARSceneNavigator;
        } else if (mVRSceneNavigator != null) {
            return mVRSceneNavigator;
        } else {
            return mSceneNavigator;
        }
    }

    /**
     * Create a node.
     */
    @DoNotStrip
    private void createNode(String nodeId, String nodeType, ReadableMap props) {
        // Get the appropriate navigator
        ViewGroup navigator = getActiveNavigator();
        if (navigator == null) {
            System.err.println("Cannot create node: no active navigator");
            return;
        }
        
        // Store the node ID in the registry
        Map<String, Object> nodeInfo = new HashMap<>();
        nodeInfo.put("type", nodeType);
        nodeInfo.put("props", props != null ? props.toHashMap() : new HashMap<>());
        mNodeRegistry.put(nodeId, nodeInfo);
        
        // If this is a scene node, add it to the navigator
        if ("scene".equals(nodeType)) {
            // For scene nodes, we need to create a VRTScene and set it on the navigator
            if (mSceneNavigator != null) {
                // Create a scene using the existing VRTScene implementation
                VRTScene scene = new VRTScene(mReactContext);
                scene.setProps(props);
                mSceneNavigator.setScene(scene);
                mNodeRegistry.put(nodeId, scene);
            }
        } else if ("arScene".equals(nodeType)) {
            // For AR scene nodes, we need to create a VRTARScene and set it on the navigator
            if (mARSceneNavigator != null) {
                // Create an AR scene using the existing VRTARScene implementation
                VRTARScene arScene = new VRTARScene(mReactContext);
                arScene.setProps(props);
                mARSceneNavigator.setScene(arScene);
                mNodeRegistry.put(nodeId, arScene);
            }
        } else {
            // For other node types, create the appropriate VRT node and add it to the scene
            // This would delegate to the existing VRT node creation logic
            // For example, for a box:
            if ("box".equals(nodeType)) {
                VRTBox box = new VRTBox(mReactContext);
                box.setProps(props);
                mNodeRegistry.put(nodeId, box);
            }
            // Similar implementations for other node types
        }
    }

    /**
     * Update a node.
     */
    @DoNotStrip
    private void updateNode(String nodeId, ReadableMap props) {
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            System.err.println("Cannot update node: node not found");
            return;
        }
        
        // If the node is a VRT node, update its properties
        if (node instanceof VRTNode) {
            VRTNode vrtNode = (VRTNode) node;
            vrtNode.setProps(props);
        } else {
            // If it's just a dictionary (for nodes we don't have a VRT class for yet),
            // update the props in the registry
            Map<String, Object> nodeInfo = (Map<String, Object>) node;
            Map<String, Object> nodeProps = (Map<String, Object>) nodeInfo.get("props");
            nodeProps.putAll(props.toHashMap());
            mNodeRegistry.put(nodeId, nodeInfo);
        }
    }

    /**
     * Delete a node.
     */
    @DoNotStrip
    private void deleteNode(String nodeId) {
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            System.err.println("Cannot delete node: node not found");
            return;
        }
        
        // If the node is a VRT node, remove it from its parent
        if (node instanceof VRTNode) {
            VRTNode vrtNode = (VRTNode) node;
            ViewGroup parent = (ViewGroup) vrtNode.getParent();
            if (parent != null) {
                parent.removeView(vrtNode);
            }
        }
        
        // Remove the node from the registry
        mNodeRegistry.remove(nodeId);
    }

    /**
     * Add a child to a parent.
     */
    @DoNotStrip
    private void addChild(String childId, String parentId) {
        // Get the parent and child nodes from the registry
        Object parent = mNodeRegistry.get(parentId);
        Object child = mNodeRegistry.get(childId);
        
        if (parent == null || child == null) {
            System.err.println("Cannot add child: parent or child not found");
            return;
        }
        
        // If both parent and child are VRT nodes, add the child to the parent
        if (parent instanceof VRTNode && child instanceof VRTNode) {
            VRTNode parentNode = (VRTNode) parent;
            VRTNode childNode = (VRTNode) child;
            parentNode.addView(childNode);
        } else {
            // If they're not both VRT nodes, update the parent-child relationship in the registry
            Map<String, Object> parentInfo = (parent instanceof Map) ? (Map<String, Object>) parent : new HashMap<>();
            if (!parentInfo.containsKey("children")) {
                parentInfo.put("children", new HashMap<String, Object>());
            }
            Map<String, Object> children = (Map<String, Object>) parentInfo.get("children");
            children.put(childId, true);
            mNodeRegistry.put(parentId, parentInfo);
        }
    }

    /**
     * Remove a child from a parent.
     */
    @DoNotStrip
    private void removeChild(String childId, String parentId) {
        // Get the parent and child nodes from the registry
        Object parent = mNodeRegistry.get(parentId);
        Object child = mNodeRegistry.get(childId);
        
        if (parent == null || child == null) {
            System.err.println("Cannot remove child: parent or child not found");
            return;
        }
        
        // If both parent and child are VRT nodes, remove the child from the parent
        if (parent instanceof VRTNode && child instanceof VRTNode) {
            VRTNode parentNode = (VRTNode) parent;
            VRTNode childNode = (VRTNode) child;
            parentNode.removeView(childNode);
        } else {
            // If they're not both VRT nodes, update the parent-child relationship in the registry
            if (parent instanceof Map) {
                Map<String, Object> parentInfo = (Map<String, Object>) parent;
                if (parentInfo.containsKey("children")) {
                    Map<String, Object> children = (Map<String, Object>) parentInfo.get("children");
                    children.remove(childId);
                }
            }
        }
    }

    /**
     * Register an event callback.
     */
    @DoNotStrip
    private void registerEventCallback(String callbackId, String eventName, String nodeId) {
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            System.err.println("Cannot register event callback: node not found");
            return;
        }
        
        // Store the callback ID in the registry
        String key = nodeId + "_" + eventName;
        mEventCallbackRegistry.put(key, callbackId);
        
        // If the node is a VRT node, register the event callback
        if (node instanceof VRTNode) {
            VRTNode vrtNode = (VRTNode) node;
            
            // Create a callback that will dispatch the event to JS
            VRTEventListener listener = new VRTEventListener() {
                @Override
                public void onEvent(Map<String, Object> event) {
                    // Convert the event to a ReadableMap
                    WritableMap writableEvent = new WritableNativeMap();
                    for (Map.Entry<String, Object> entry : event.entrySet()) {
                        String key = entry.getKey();
                        Object value = entry.getValue();
                        if (value instanceof String) {
                            writableEvent.putString(key, (String) value);
                        } else if (value instanceof Integer) {
                            writableEvent.putInt(key, (Integer) value);
                        } else if (value instanceof Double) {
                            writableEvent.putDouble(key, (Double) value);
                        } else if (value instanceof Boolean) {
                            writableEvent.putBoolean(key, (Boolean) value);
                        }
                    }
                    
                    // Dispatch the event to JS
                    dispatchEventToJS(callbackId, writableEvent);
                }
            };
            
            // Register the event callback with the node
            vrtNode.addEventListener(eventName, listener);
        }
    }

    /**
     * Unregister an event callback.
     */
    @DoNotStrip
    private void unregisterEventCallback(String callbackId, String eventName, String nodeId) {
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            System.err.println("Cannot unregister event callback: node not found");
            return;
        }
        
        // Remove the callback ID from the registry
        String key = nodeId + "_" + eventName;
        mEventCallbackRegistry.remove(key);
        
        // If the node is a VRT node, unregister the event callback
        if (node instanceof VRTNode) {
            VRTNode vrtNode = (VRTNode) node;
            
            // Unregister the event callback from the node
            vrtNode.removeEventListener(eventName);
        }
    }

    /**
     * Dispatch an event to JavaScript.
     * This method is implemented in C++ (ViroFabricContainerJSI.cpp)
     * and will call the handleViroEvent function in JavaScript.
     */
    @DoNotStrip
    private native void dispatchEventToJS(String callbackId, ReadableMap data);
    
    /**
     * Implementation of the dispatchEventToJS method for the C++ side.
     * This method is called from C++ to dispatch events to JavaScript.
     */
    @DoNotStrip
    private void dispatchEventToJSImpl(String callbackId, ReadableMap data) {
        // Get the JSI runtime
        if (mHybridData == null) {
            Log.e(TAG, "Cannot dispatch event to JS: hybrid data is null");
            return;
        }
        
        try {
            // Call the native method
            dispatchEventToJS(callbackId, data);
        } catch (Exception e) {
            Log.e(TAG, "Error dispatching event to JS: " + e.getMessage(), e);
            
            // Fallback to RCTEventEmitter
            WritableMap event = new WritableNativeMap();
            event.putString("callbackId", callbackId);
            event.putMap("data", data);
            sendEvent("ViroEvent", event);
        }
    }
    
    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        if (mHybridData != null) {
            mHybridData.resetNative();
            mHybridData = null;
        }
    }
}
