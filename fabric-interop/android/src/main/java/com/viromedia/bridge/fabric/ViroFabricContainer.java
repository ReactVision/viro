package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.facebook.jni.HybridData;
import com.facebook.jni.annotations.DoNotStrip;
import com.facebook.react.bridge.Arguments;
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
import com.viromedia.bridge.component.node.control.VRTSphere;
import com.viromedia.bridge.component.node.control.VRTText;
import com.viromedia.bridge.component.node.control.VRTImage;
import com.viromedia.bridge.component.node.control.VRTQuad;
import com.viromedia.bridge.component.node.control.VRTVideoSurface;
import com.viromedia.bridge.component.node.control.VRT3DObject;
import com.viromedia.bridge.component.node.control.VRTPolygon;
import com.viromedia.bridge.component.node.control.VRTPolyline;
import com.viromedia.bridge.component.node.control.VRTGeometry;
import com.viromedia.bridge.component.node.control.VRTAnimatedImage;
import com.viromedia.bridge.component.node.control.VRTParticleEmitter;
import com.viromedia.bridge.component.node.VRTNode;
import com.viromedia.bridge.component.node.VRTFlexView;
import com.viromedia.bridge.component.node.VRTCamera;
import com.viromedia.bridge.component.node.VRTOrbitCamera;
import com.viromedia.bridge.component.VRT360Image;
import com.viromedia.bridge.component.VRT360Video;
import com.viromedia.bridge.component.VRTSkyBox;
import com.viromedia.bridge.component.node.VRTPortal;
import com.viromedia.bridge.component.node.VRTPortalScene;
import com.viromedia.bridge.component.VRTController;
import com.viromedia.bridge.component.VRTMaterialVideo;
import com.viromedia.bridge.component.VRTLightingEnvironment;
import com.viromedia.bridge.component.VRTAmbientLight;
import com.viromedia.bridge.component.VRTDirectionalLight;
import com.viromedia.bridge.component.VRTOmniLight;
import com.viromedia.bridge.component.VRTSpotLight;
import com.viromedia.bridge.component.VRTSound;
import com.viromedia.bridge.component.VRTSoundField;
import com.viromedia.bridge.component.VRTSpatialSound;
import com.viromedia.bridge.utility.ComponentEventDelegate.VRTEventListener;
import com.viromedia.bridge.utility.Helper;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.module.AnimationManager;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableType;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;

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

    // Material manager
    private MaterialManager mMaterialManager;

    // Animation manager
    private AnimationManager mAnimationManager;

    // Flags
    private boolean mIsAR = false;
    private boolean mIsVR = false;

    // React context
    private ThemedReactContext mReactContext;

    // JSI bridge
    @DoNotStrip
    private HybridData mHybridData;
    
    // Hybrid data pointer for C++ instance
    @DoNotStrip
    private long mHybridDataPointer = 0;
    
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

    /**
     * Get the React context for the C++ bridge.
     */
    @DoNotStrip
    public ReactContext getReactContext() {
        return mReactContext;
    }

    /**
     * Set the hybrid data pointer from C++.
     */
    @DoNotStrip
    public void setHybridData(long pointer) {
        mHybridDataPointer = pointer;
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
        Log.d(TAG, "Initializing Viro - debug: " + debug + ", AR: " + arEnabled + ", worldAlignment: " + worldAlignment);
        
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
                Log.d(TAG, "Setting AR world alignment to GravityAndHeading");
            } else if ("Camera".equals(worldAlignment)) {
                // Set world alignment to camera
                // This would use the existing VRTARSceneNavigator API
                Log.d(TAG, "Setting AR world alignment to Camera");
            } else {
                // Set world alignment to gravity (default)
                // This would use the existing VRTARSceneNavigator API
                Log.d(TAG, "Setting AR world alignment to Gravity (default)");
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
        
        Log.d(TAG, "Viro initialization completed successfully");
    }

    /**
     * Clean up the Viro system.
     */
    public void cleanup() {
        Log.d(TAG, "Cleaning up Viro system");
        
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

        // Reset managers
        mMaterialManager = null;
        mAnimationManager = null;

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
    @DoNotStrip
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
        Log.d(TAG, "Creating node: " + nodeId + " of type: " + nodeType);
        
        // Get the appropriate navigator
        ViewGroup navigator = getActiveNavigator();
        if (navigator == null) {
            Log.e(TAG, "Cannot create node: no active navigator");
            return;
        }
        
        try {
            // Create the appropriate VRT node based on type
            VRTNode node = createVRTNode(nodeType, props);
            if (node != null) {
                mNodeRegistry.put(nodeId, node);
                Log.d(TAG, "Successfully created node: " + nodeId);
            } else {
                // Store as metadata for nodes we don't have VRT classes for yet
                Map<String, Object> nodeInfo = new HashMap<>();
                nodeInfo.put("type", nodeType);
                nodeInfo.put("props", props != null ? props.toHashMap() : new HashMap<>());
                mNodeRegistry.put(nodeId, nodeInfo);
                Log.d(TAG, "Stored node metadata for: " + nodeId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating node " + nodeId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Create a VRT node based on the node type.
     */
    private VRTNode createVRTNode(String nodeType, ReadableMap props) {
        VRTNode node = null;
        
        try {
            switch (nodeType) {
                case "scene":
                    if (mSceneNavigator != null) {
                        VRTScene scene = new VRTScene(mReactContext);
                        if (props != null) {
                            scene.setProps(props);
                        }
                        mSceneNavigator.setScene(scene);
                        return scene;
                    }
                    break;
                    
                case "arScene":
                    if (mARSceneNavigator != null) {
                        VRTARScene arScene = new VRTARScene(mReactContext);
                        if (props != null) {
                            arScene.setProps(props);
                        }
                        mARSceneNavigator.setScene(arScene);
                        return arScene;
                    }
                    break;
                    
                case "box":
                    node = new VRTBox(mReactContext);
                    break;
                    
                case "sphere":
                    node = new VRTSphere(mReactContext);
                    break;
                    
                case "text":
                    node = new VRTText(mReactContext);
                    break;
                    
                case "image":
                    node = new VRTImage(mReactContext);
                    break;
                    
                case "quad":
                    node = new VRTQuad(mReactContext);
                    break;
                    
                case "video":
                    node = new VRTVideoSurface(mReactContext);
                    break;
                    
                case "3DObject":
                    node = new VRT3DObject(mReactContext);
                    break;
                    
                // Layout components
                case "node":
                    node = new VRTNode(mReactContext);
                    break;
                    
                case "flexView":
                    node = new VRTFlexView(mReactContext);
                    break;
                    
                // Shape components
                case "polygon":
                    node = new VRTPolygon(mReactContext);
                    break;
                    
                case "polyline":
                    node = new VRTPolyline(mReactContext);
                    break;
                    
                case "geometry":
                    node = new VRTGeometry(mReactContext);
                    break;
                    
                // Interactive components
                case "controller":
                    node = new VRTController(mReactContext);
                    break;
                    
                // Media components
                case "animatedImage":
                    node = new VRTAnimatedImage(mReactContext);
                    break;
                    
                case "materialVideo":
                    node = new VRTMaterialVideo(mReactContext);
                    break;
                    
                case "360Image":
                    node = new VRT360Image(mReactContext);
                    break;
                    
                case "360Video":
                    node = new VRT360Video(mReactContext);
                    break;
                    
                // Environment components
                case "skyBox":
                    node = new VRTSkyBox(mReactContext);
                    break;
                    
                case "lightingEnvironment":
                    node = new VRTLightingEnvironment(mReactContext);
                    break;
                    
                // Portal components
                case "portal":
                    node = new VRTPortal(mReactContext);
                    break;
                    
                case "portalScene":
                    node = new VRTPortalScene(mReactContext);
                    break;
                    
                // Effects components
                case "particleEmitter":
                    node = new VRTParticleEmitter(mReactContext);
                    break;
                    
                // Camera components
                case "camera":
                    node = new VRTCamera(mReactContext);
                    break;
                    
                case "orbitCamera":
                    node = new VRTOrbitCamera(mReactContext);
                    break;
                    
                // Lighting components
                case "ambientLight":
                    node = new VRTAmbientLight(mReactContext);
                    break;
                    
                case "directionalLight":
                    node = new VRTDirectionalLight(mReactContext);
                    break;
                    
                case "omniLight":
                    node = new VRTOmniLight(mReactContext);
                    break;
                    
                case "spotLight":
                    node = new VRTSpotLight(mReactContext);
                    break;
                    
                // Audio components
                case "sound":
                    node = new VRTSound(mReactContext);
                    break;
                    
                case "soundField":
                    node = new VRTSoundField(mReactContext);
                    break;
                    
                case "spatialSound":
                    node = new VRTSpatialSound(mReactContext);
                    break;
                    
                default:
                    Log.w(TAG, "Unknown node type: " + nodeType);
                    return null;
            }
            
            // Set props if node was created and props are provided
            if (node != null && props != null) {
                setNodeProperties(node, props);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error creating VRT node of type " + nodeType + ": " + e.getMessage(), e);
            return null;
        }
        
        return node;
    }

    /**
     * Update a node.
     */
    @DoNotStrip
    private void updateNode(String nodeId, ReadableMap props) {
        Log.d(TAG, "Updating node: " + nodeId);
        
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            Log.e(TAG, "Cannot update node: node not found - " + nodeId);
            return;
        }
        
        try {
            // If the node is a VRT node, update its properties
            if (node instanceof VRTNode) {
                VRTNode vrtNode = (VRTNode) node;
                setNodeProperties(vrtNode, props);
                Log.d(TAG, "Successfully updated VRT node: " + nodeId);
            } else if (node instanceof Map) {
                // If it's just a dictionary (for nodes we don't have a VRT class for yet),
                // update the props in the registry
                @SuppressWarnings("unchecked")
                Map<String, Object> nodeInfo = (Map<String, Object>) node;
                @SuppressWarnings("unchecked")
                Map<String, Object> nodeProps = (Map<String, Object>) nodeInfo.get("props");
                if (nodeProps == null) {
                    nodeProps = new HashMap<>();
                    nodeInfo.put("props", nodeProps);
                }
                nodeProps.putAll(props.toHashMap());
                mNodeRegistry.put(nodeId, nodeInfo);
                Log.d(TAG, "Successfully updated node metadata: " + nodeId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating node " + nodeId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Delete a node.
     */
    @DoNotStrip
    private void deleteNode(String nodeId) {
        Log.d(TAG, "Deleting node: " + nodeId);
        
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            Log.e(TAG, "Cannot delete node: node not found - " + nodeId);
            return;
        }
        
        try {
            // If the node is a VRT node, remove it from its parent
            if (node instanceof VRTNode) {
                VRTNode vrtNode = (VRTNode) node;
                ViewGroup parent = (ViewGroup) vrtNode.getParent();
                if (parent != null) {
                    parent.removeView(vrtNode);
                }
                Log.d(TAG, "Successfully removed VRT node from parent: " + nodeId);
            }
            
            // Remove the node from the registry
            mNodeRegistry.remove(nodeId);
            Log.d(TAG, "Successfully deleted node: " + nodeId);
        } catch (Exception e) {
            Log.e(TAG, "Error deleting node " + nodeId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Add a child to a parent.
     */
    @DoNotStrip
    private void addChild(String childId, String parentId) {
        Log.d(TAG, "Adding child " + childId + " to parent " + parentId);
        
        // Get the parent and child nodes from the registry
        Object parent = mNodeRegistry.get(parentId);
        Object child = mNodeRegistry.get(childId);
        
        if (parent == null || child == null) {
            Log.e(TAG, "Cannot add child: parent or child not found - parent: " + parentId + ", child: " + childId);
            return;
        }
        
        try {
            // If both parent and child are VRT nodes, add the child to the parent
            if (parent instanceof VRTNode && child instanceof VRTNode) {
                VRTNode parentNode = (VRTNode) parent;
                VRTNode childNode = (VRTNode) child;
                parentNode.addView(childNode);
                Log.d(TAG, "Successfully added VRT child to parent");
            } else {
                // If they're not both VRT nodes, update the parent-child relationship in the registry
                @SuppressWarnings("unchecked")
                Map<String, Object> parentInfo = (parent instanceof Map) ? (Map<String, Object>) parent : new HashMap<>();
                if (!parentInfo.containsKey("children")) {
                    parentInfo.put("children", new HashMap<String, Object>());
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> children = (Map<String, Object>) parentInfo.get("children");
                children.put(childId, true);
                mNodeRegistry.put(parentId, parentInfo);
                Log.d(TAG, "Successfully updated parent-child relationship in registry");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error adding child " + childId + " to parent " + parentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Remove a child from a parent.
     */
    @DoNotStrip
    private void removeChild(String childId, String parentId) {
        Log.d(TAG, "Removing child " + childId + " from parent " + parentId);
        
        // Get the parent and child nodes from the registry
        Object parent = mNodeRegistry.get(parentId);
        Object child = mNodeRegistry.get(childId);
        
        if (parent == null || child == null) {
            Log.e(TAG, "Cannot remove child: parent or child not found - parent: " + parentId + ", child: " + childId);
            return;
        }
        
        try {
            // If both parent and child are VRT nodes, remove the child from the parent
            if (parent instanceof VRTNode && child instanceof VRTNode) {
                VRTNode parentNode = (VRTNode) parent;
                VRTNode childNode = (VRTNode) child;
                parentNode.removeView(childNode);
                Log.d(TAG, "Successfully removed VRT child from parent");
            } else {
                // If they're not both VRT nodes, update the parent-child relationship in the registry
                if (parent instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> parentInfo = (Map<String, Object>) parent;
                    if (parentInfo.containsKey("children")) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> children = (Map<String, Object>) parentInfo.get("children");
                        children.remove(childId);
                    }
                    Log.d(TAG, "Successfully updated parent-child relationship in registry");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error removing child " + childId + " from parent " + parentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Register an event callback.
     */
    @DoNotStrip
    private void registerEventCallback(String callbackId, String eventName, String nodeId) {
        Log.d(TAG, "Registering event callback: " + callbackId + " for event: " + eventName + " on node: " + nodeId);
        
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            Log.e(TAG, "Cannot register event callback: node not found - " + nodeId);
            return;
        }
        
        try {
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
                        // Convert the event to a WritableMap
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
                            } else if (value instanceof Float) {
                                writableEvent.putDouble(key, ((Float) value).doubleValue());
                            }
                        }
                        
                        // Dispatch the event to JS
                        dispatchEventToJSImpl(callbackId, writableEvent);
                    }
                };
                
                // Register the event callback with the node
                vrtNode.addEventListener(eventName, listener);
                Log.d(TAG, "Successfully registered event callback for VRT node");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error registering event callback for node " + nodeId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Unregister an event callback.
     */
    @DoNotStrip
    private void unregisterEventCallback(String callbackId, String eventName, String nodeId) {
        Log.d(TAG, "Unregistering event callback: " + callbackId + " for event: " + eventName + " on node: " + nodeId);
        
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            Log.e(TAG, "Cannot unregister event callback: node not found - " + nodeId);
            return;
        }
        
        try {
            // Remove the callback ID from the registry
            String key = nodeId + "_" + eventName;
            mEventCallbackRegistry.remove(key);
            
            // If the node is a VRT node, unregister the event callback
            if (node instanceof VRTNode) {
                VRTNode vrtNode = (VRTNode) node;
                
                // Unregister the event callback from the node
                vrtNode.removeEventListener(eventName);
                Log.d(TAG, "Successfully unregistered event callback for VRT node");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering event callback for node " + nodeId + ": " + e.getMessage(), e);
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
     * This method is called from Java to dispatch events to JavaScript.
     */
    @DoNotStrip
    private void dispatchEventToJSImpl(String callbackId, ReadableMap data) {
        try {
            // Try to use the native JSI method first
            if (mHybridDataPointer != 0) {
                dispatchEventToJS(callbackId, data);
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "JSI event dispatch failed, falling back to RCTEventEmitter: " + e.getMessage());
        }
        
        // Fallback to RCTEventEmitter
        WritableMap event = new WritableNativeMap();
        event.putString("callbackId", callbackId);
        event.putMap("data", data);
        sendEvent("ViroEvent", event);
    }

    /**
     * Create a material.
     */
    @DoNotStrip
    private void createMaterial(String materialName, ReadableMap properties) {
        Log.d(TAG, "Creating material: " + materialName);
        
        try {
            // Initialize material manager if needed
            if (mMaterialManager == null) {
                mMaterialManager = mReactContext.getNativeModule(MaterialManager.class);
            }
            
            if (mMaterialManager != null) {
                // Use the correct MaterialManager API - setJSMaterials expects a map of materials
                WritableMap materialsMap = Arguments.createMap();
                materialsMap.putMap(materialName, properties);
                mMaterialManager.setJSMaterials(materialsMap);
                Log.d(TAG, "Successfully created material: " + materialName);
            } else {
                Log.e(TAG, "MaterialManager not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating material " + materialName + ": " + e.getMessage(), e);
        }
    }

    /**
     * Update a material.
     */
    @DoNotStrip
    private void updateMaterial(String materialName, ReadableMap properties) {
        Log.d(TAG, "Updating material: " + materialName);
        
        try {
            // Initialize material manager if needed
            if (mMaterialManager == null) {
                mMaterialManager = mReactContext.getNativeModule(MaterialManager.class);
            }
            
            if (mMaterialManager != null) {
                // For updates, we also use setJSMaterials - it will overwrite existing materials
                WritableMap materialsMap = Arguments.createMap();
                materialsMap.putMap(materialName, properties);
                mMaterialManager.setJSMaterials(materialsMap);
                Log.d(TAG, "Successfully updated material: " + materialName);
            } else {
                Log.e(TAG, "MaterialManager not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating material " + materialName + ": " + e.getMessage(), e);
        }
    }

    /**
     * Create an animation.
     */
    @DoNotStrip
    private void createAnimation(String animationName, ReadableMap properties) {
        Log.d(TAG, "Creating animation: " + animationName);
        
        try {
            // Initialize animation manager if needed
            if (mAnimationManager == null) {
                mAnimationManager = mReactContext.getNativeModule(AnimationManager.class);
            }
            
            if (mAnimationManager != null) {
                // Use the correct AnimationManager API - setJSAnimations expects a map of animations
                WritableMap animationsMap = Arguments.createMap();
                animationsMap.putMap(animationName, properties);
                mAnimationManager.setJSAnimations(animationsMap);
                Log.d(TAG, "Successfully created animation: " + animationName);
            } else {
                Log.e(TAG, "AnimationManager not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating animation " + animationName + ": " + e.getMessage(), e);
        }
    }

    /**
     * Execute an animation on a node.
     */
    @DoNotStrip
    private void executeAnimation(String nodeId, String animationName, ReadableMap options) {
        Log.d(TAG, "Executing animation: " + animationName + " on node: " + nodeId);
        
        // Get the node from the registry
        Object node = mNodeRegistry.get(nodeId);
        if (node == null) {
            Log.e(TAG, "Cannot execute animation: node not found - " + nodeId);
            return;
        }
        
        try {
            // Initialize animation manager if needed
            if (mAnimationManager == null) {
                mAnimationManager = mReactContext.getNativeModule(AnimationManager.class);
            }
            
            // If the node is a VRT node, execute the animation
            if (node instanceof VRTNode && mAnimationManager != null) {
                VRTNode vrtNode = (VRTNode) node;
                
                // Use the existing VRT node animation system
                // VRT nodes have their own animation system via setAnimation
                WritableMap animationConfig = Arguments.createMap();
                animationConfig.putString("name", animationName);
                if (options != null) {
                    // Merge options into animation config
                    WritableMap mergedConfig = Arguments.createMap();
                    mergedConfig.merge(animationConfig);
                    mergedConfig.merge(options);
                    animationConfig = mergedConfig;
                }
                vrtNode.setAnimation(animationConfig);
                
                Log.d(TAG, "Successfully executed animation: " + animationName + " on node: " + nodeId);
            } else {
                Log.w(TAG, "Cannot execute animation: node is not VRT node or AnimationManager not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error executing animation " + animationName + " on node " + nodeId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Set AR plane detection configuration.
     */
    @DoNotStrip
    private void setARPlaneDetection(ReadableMap config) {
        Log.d(TAG, "Setting AR plane detection configuration");
        
        if (!mIsAR || mARSceneNavigator == null) {
            Log.w(TAG, "Cannot set AR plane detection: not in AR mode");
            return;
        }
        
        try {
            // Configure AR plane detection using the existing VRTARSceneNavigator API
            if (config != null) {
                // Extract configuration options
                boolean enabled = config.hasKey("enabled") ? config.getBoolean("enabled") : true;
                String alignment = config.hasKey("alignment") ? config.getString("alignment") : "Horizontal";
                
                // Apply configuration to the AR scene navigator
                mARSceneNavigator.setPlaneDetectionEnabled(enabled);
                mARSceneNavigator.setPlaneDetectionAlignment(alignment);
                
                Log.d(TAG, "Successfully configured AR plane detection - enabled: " + enabled + ", alignment: " + alignment);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting AR plane detection: " + e.getMessage(), e);
        }
    }

    /**
     * Set AR image targets.
     */
    @DoNotStrip
    private void setARImageTargets(ReadableMap targets) {
        Log.d(TAG, "Setting AR image targets");
        
        if (!mIsAR || mARSceneNavigator == null) {
            Log.w(TAG, "Cannot set AR image targets: not in AR mode");
            return;
        }
        
        try {
            // Configure AR image targets using the existing VRTARSceneNavigator API
            if (targets != null) {
                // Convert ReadableMap to a format suitable for the AR scene navigator
                Map<String, Object> targetMap = targets.toHashMap();
                
                // Apply image targets to the AR scene navigator
                mARSceneNavigator.setImageTargets(targetMap);
                
                Log.d(TAG, "Successfully configured AR image targets with " + targetMap.size() + " targets");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting AR image targets: " + e.getMessage(), e);
        }
    }
    
    /**
     * Set properties on a VRT node using individual property setters.
     * This replaces the generic setProps() method with the actual VRT property setting pattern.
     */
    private void setNodeProperties(VRTNode node, ReadableMap props) {
        if (node == null || props == null) {
            return;
        }
        
        try {
            // Default values for missing properties
            final float[] DEFAULT_ZERO_VEC = new float[]{0, 0, 0};
            final float[] DEFAULT_SCALE_VEC = new float[]{1, 1, 1};
            
            // Transform properties
            if (props.hasKey("position") && props.getType("position") == ReadableType.Array) {
                ReadableArray position = props.getArray("position");
                node.setPosition(Helper.toFloatArray(position, DEFAULT_ZERO_VEC));
            }
            
            if (props.hasKey("rotation") && props.getType("rotation") == ReadableType.Array) {
                ReadableArray rotation = props.getArray("rotation");
                node.setRotation(Helper.toFloatArray(rotation, DEFAULT_ZERO_VEC));
            }
            
            if (props.hasKey("scale") && props.getType("scale") == ReadableType.Array) {
                ReadableArray scale = props.getArray("scale");
                node.setScale(Helper.toFloatArray(scale, DEFAULT_SCALE_VEC));
            }
            
            if (props.hasKey("rotationPivot") && props.getType("rotationPivot") == ReadableType.Array) {
                ReadableArray rotationPivot = props.getArray("rotationPivot");
                node.setRotationPivot(Helper.toFloatArray(rotationPivot, DEFAULT_ZERO_VEC));
            }
            
            if (props.hasKey("scalePivot") && props.getType("scalePivot") == ReadableType.Array) {
                ReadableArray scalePivot = props.getArray("scalePivot");
                node.setScalePivot(Helper.toFloatArray(scalePivot, DEFAULT_ZERO_VEC));
            }
            
            // Appearance properties
            if (props.hasKey("opacity") && props.getType("opacity") == ReadableType.Number) {
                float opacity = (float) props.getDouble("opacity");
                node.setOpacity(opacity);
            }
            
            if (props.hasKey("visible") && props.getType("visible") == ReadableType.Boolean) {
                boolean visible = props.getBoolean("visible");
                node.setVisible(visible);
            }
            
            if (props.hasKey("renderingOrder") && props.getType("renderingOrder") == ReadableType.Number) {
                int renderingOrder = props.getInt("renderingOrder");
                node.setRenderingOrder(renderingOrder);
            }
            
            // Lighting properties
            if (props.hasKey("lightReceivingBitMask") && props.getType("lightReceivingBitMask") == ReadableType.Number) {
                int bitMask = props.getInt("lightReceivingBitMask");
                node.setLightReceivingBitMask(bitMask);
            }
            
            if (props.hasKey("shadowCastingBitMask") && props.getType("shadowCastingBitMask") == ReadableType.Number) {
                int bitMask = props.getInt("shadowCastingBitMask");
                node.setShadowCastingBitMask(bitMask);
            }
            
            // Event handling properties
            if (props.hasKey("canHover") && props.getType("canHover") == ReadableType.Boolean) {
                boolean canHover = props.getBoolean("canHover");
                node.setCanHover(canHover);
            }
            
            if (props.hasKey("canClick") && props.getType("canClick") == ReadableType.Boolean) {
                boolean canClick = props.getBoolean("canClick");
                node.setCanClick(canClick);
            }
            
            if (props.hasKey("canTouch") && props.getType("canTouch") == ReadableType.Boolean) {
                boolean canTouch = props.getBoolean("canTouch");
                node.setCanTouch(canTouch);
            }
            
            if (props.hasKey("canScroll") && props.getType("canScroll") == ReadableType.Boolean) {
                boolean canScroll = props.getBoolean("canScroll");
                node.setCanScroll(canScroll);
            }
            
            if (props.hasKey("canSwipe") && props.getType("canSwipe") == ReadableType.Boolean) {
                boolean canSwipe = props.getBoolean("canSwipe");
                node.setCanSwipe(canSwipe);
            }
            
            if (props.hasKey("canDrag") && props.getType("canDrag") == ReadableType.Boolean) {
                boolean canDrag = props.getBoolean("canDrag");
                node.setCanDrag(canDrag);
            }
            
            if (props.hasKey("canFuse") && props.getType("canFuse") == ReadableType.Boolean) {
                boolean canFuse = props.getBoolean("canFuse");
                node.setCanFuse(canFuse);
            }
            
            if (props.hasKey("canPinch") && props.getType("canPinch") == ReadableType.Boolean) {
                boolean canPinch = props.getBoolean("canPinch");
                node.setCanPinch(canPinch);
            }
            
            if (props.hasKey("canRotate") && props.getType("canRotate") == ReadableType.Boolean) {
                boolean canRotate = props.getBoolean("canRotate");
                node.setCanRotate(canRotate);
            }
            
            if (props.hasKey("timeToFuse") && props.getType("timeToFuse") == ReadableType.Number) {
                float timeToFuse = (float) props.getDouble("timeToFuse");
                node.setTimeToFuse(timeToFuse);
            }
            
            if (props.hasKey("highAccuracyEvents") && props.getType("highAccuracyEvents") == ReadableType.Boolean) {
                boolean highAccuracyEvents = props.getBoolean("highAccuracyEvents");
                node.setHighAccuracyEvents(highAccuracyEvents);
            }
            
            if (props.hasKey("ignoreEventHandling") && props.getType("ignoreEventHandling") == ReadableType.Boolean) {
                boolean ignoreEventHandling = props.getBoolean("ignoreEventHandling");
                node.setIgnoreEventHandling(ignoreEventHandling);
            }
            
            // Drag properties
            if (props.hasKey("dragType") && props.getType("dragType") == ReadableType.String) {
                String dragType = props.getString("dragType");
                node.setDragType(dragType);
            }
            
            if (props.hasKey("dragPlane") && props.getType("dragPlane") == ReadableType.Map) {
                ReadableMap dragPlane = props.getMap("dragPlane");
                node.setDragPlane(dragPlane);
            }
            
            // Animation properties
            if (props.hasKey("animation") && props.getType("animation") == ReadableType.Map) {
                ReadableMap animation = props.getMap("animation");
                node.setAnimation(animation);
            }
            
            // Material properties
            if (props.hasKey("materials") && props.getType("materials") == ReadableType.Array) {
                ReadableArray materials = props.getArray("materials");
                setNodeMaterials(node, materials);
            }
            
            // Transform behaviors
            if (props.hasKey("transformBehaviors") && props.getType("transformBehaviors") == ReadableType.Array) {
                ReadableArray transformBehaviors = props.getArray("transformBehaviors");
                String[] behaviors = new String[transformBehaviors.size()];
                for (int i = 0; i < transformBehaviors.size(); i++) {
                    behaviors[i] = transformBehaviors.getString(i);
                }
                node.setTransformBehaviors(behaviors);
            }
            
            // Physics properties
            if (props.hasKey("physicsBody") && props.getType("physicsBody") == ReadableType.Map) {
                ReadableMap physicsBody = props.getMap("physicsBody");
                node.setPhysicsBody(physicsBody);
            }
            
            if (props.hasKey("canCollide") && props.getType("canCollide") == ReadableType.Boolean) {
                boolean canCollide = props.getBoolean("canCollide");
                node.setCanCollide(canCollide);
            }
            
            // Viro tag
            if (props.hasKey("viroTag") && props.getType("viroTag") == ReadableType.String) {
                String viroTag = props.getString("viroTag");
                node.setViroTag(viroTag);
            }
            
            // Transform delegate
            if (props.hasKey("hasTransformDelegate") && props.getType("hasTransformDelegate") == ReadableType.Boolean) {
                boolean hasTransformDelegate = props.getBoolean("hasTransformDelegate");
                node.setOnNativeTransformDelegate(hasTransformDelegate);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error setting node properties: " + e.getMessage(), e);
        }
    }
    
    /**
     * Set materials on a VRT node using the MaterialManager.
     */
    private void setNodeMaterials(VRTNode node, ReadableArray materials) {
        if (node == null || materials == null) {
            return;
        }
        
        try {
            // Initialize material manager if needed
            if (mMaterialManager == null) {
                mMaterialManager = mReactContext.getNativeModule(MaterialManager.class);
            }
            
            if (mMaterialManager != null) {
                // Convert material names to actual Material objects
                List<com.viro.core.Material> nativeMaterials = new ArrayList<>();
                for (int i = 0; i < materials.size(); i++) {
                    String materialName = materials.getString(i);
                    com.viro.core.Material nativeMaterial = mMaterialManager.getMaterial(materialName);
                    
                    if (mMaterialManager.isVideoMaterial(materialName)) {
                        if (!(nativeMaterial.getDiffuseTexture() instanceof com.viro.core.VideoTexture)) {
                            // Recreate the material with the proper context
                            if (node.getViroContext() != null) {
                                MaterialManager.MaterialWrapper materialWrapper = mMaterialManager.getMaterialWrapper(materialName);
                                com.viro.core.VideoTexture videoTexture = new com.viro.core.VideoTexture(node.getViroContext(), materialWrapper.getVideoTextureURI());
                                materialWrapper.recreate(videoTexture);
                                nativeMaterial = materialWrapper.getNativeMaterial();
                            }
                        }
                    }
                    
                    if (nativeMaterial == null) {
                        Log.w(TAG, "Material [" + materialName + "] not found. Did you create it?");
                        continue;
                    }
                    
                    nativeMaterials.add(nativeMaterial);
                }
                
                // Set the materials on the node
                node.setMaterials(nativeMaterials);
            } else {
                Log.w(TAG, "MaterialManager not available for setting materials");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting node materials: " + e.getMessage(), e);
        }
    }

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        if (mHybridData != null) {
            mHybridData.resetNative();
            mHybridData = null;
        }
        mHybridDataPointer = 0;
    }
}
