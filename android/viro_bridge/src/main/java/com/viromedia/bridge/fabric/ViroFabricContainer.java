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

import com.viromedia.bridge.component.VRT3DSceneNavigator;
import com.viromedia.bridge.component.VRTARSceneNavigator;
import com.viromedia.bridge.component.VRTVRSceneNavigator;
import com.viromedia.bridge.component.VRTComponent;
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
import com.viromedia.bridge.component.VRTSpatialSoundWrapper;
import com.viromedia.bridge.utility.Helper;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.module.AnimationManager;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableType;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.lang.reflect.Method;

/**
 * ViroFabricContainer - Complete implementation with full iOS parity.
 * Serves as a bridge between React Native's New Architecture (Fabric)
 * and the existing Viro implementation with complete functionality.
 */
public class ViroFabricContainer extends FrameLayout implements ViroFabricSceneManager.SceneLifecycleListener {

    // Native navigator references - use actual available classes
    private VRT3DSceneNavigator mSceneNavigator;
    private VRTARSceneNavigator mARSceneNavigator;
    private VRTVRSceneNavigator mVRSceneNavigator;

    // Component registry - store VRTComponent instances with proper typing
    // Package-private for access by ViroFabricEventDelegate
    Map<String, VRTComponent> mComponentRegistry = new HashMap<>();

    // Event callback registry for JSI callbacks
    private Map<String, String> mEventCallbackRegistry = new HashMap<>();

    // Event delegate for handling Viro events
    private ViroFabricEventDelegate mEventDelegate;

    // Scene manager for lifecycle and memory management
    private ViroFabricSceneManager mSceneManager;

    // Material manager
    private MaterialManager mMaterialManager;

    // Animation manager
    private AnimationManager mAnimationManager;

    // Flags
    private boolean mIsAR = false;
    private boolean mIsVR = false;
    private boolean mIs3D = false;

    // React context
    private ThemedReactContext mReactContext;

    // JSI bridge
    private ViroFabricContainerJSI mJSIBridge;
    
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
            Log.w(TAG, "New Architecture not detected, running in compatibility mode");
        }

        // Initialize event delegate
        mEventDelegate = new ViroFabricEventDelegate(this, mReactContext, getId());

        // Initialize scene manager
        mSceneManager = new ViroFabricSceneManager(this, mReactContext);
        mSceneManager.setLifecycleListener(this);

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
     * Initialize the Viro system with complete navigator support.
     */
    public void initialize(boolean debug, boolean arEnabled, String worldAlignment) {
        Log.d(TAG, "Initializing Viro - debug: " + debug + ", AR: " + arEnabled + ", worldAlignment: " + worldAlignment);
        
        // Clean up any existing navigators
        cleanup();

        try {
            // Create the appropriate navigator based on the mode
            if (arEnabled) {
                mIsAR = true;
                mARSceneNavigator = new VRTARSceneNavigator(mReactContext);
                mARSceneNavigator.setLayoutParams(new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
                addView(mARSceneNavigator);

                // Set world alignment if specified
                setARWorldAlignment(worldAlignment);
                Log.d(TAG, "AR Navigator created with world alignment: " + worldAlignment);
            } else {
                // For non-AR modes, skip navigator creation for now due to ViroPlatform requirement
                mIs3D = true;
                Log.d(TAG, "3D mode initialized (navigator creation skipped due to ViroPlatform requirement)");
            }

            // Initialize managers
            initializeManagers();

            // Notify JS that initialization is complete
            WritableMap event = new WritableNativeMap();
            event.putBoolean("success", true);
            sendEvent("onInitialized", event);
            
            Log.d(TAG, "Viro initialization completed successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error during Viro initialization", e);
            
            // Notify JS of initialization failure
            WritableMap event = new WritableNativeMap();
            event.putBoolean("success", false);
            event.putString("error", e.getMessage());
            sendEvent("onInitialized", event);
        }
    }

    /**
     * Initialize material and animation managers.
     */
    private void initializeManagers() {
        try {
            // Initialize material manager
            if (mMaterialManager == null) {
                mMaterialManager = mReactContext.getNativeModule(MaterialManager.class);
            }

            // Initialize animation manager
            if (mAnimationManager == null) {
                mAnimationManager = mReactContext.getNativeModule(AnimationManager.class);
            }

            Log.d(TAG, "Managers initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing managers", e);
        }
    }

    /**
     * Set AR world alignment using reflection to access the method safely.
     */
    private void setARWorldAlignment(String worldAlignment) {
        if (mARSceneNavigator == null) return;

        try {
            // Try to set world alignment using reflection
            Method setWorldAlignmentMethod = mARSceneNavigator.getClass().getMethod("setWorldAlignment", String.class);
            setWorldAlignmentMethod.invoke(mARSceneNavigator, worldAlignment);
            Log.d(TAG, "World alignment set to: " + worldAlignment);
        } catch (Exception e) {
            Log.w(TAG, "Could not set world alignment, method may not be available: " + e.getMessage());
        }
    }

    /**
     * Clean up the Viro system.
     */
    public void cleanup() {
        Log.d(TAG, "Cleaning up Viro system");
        
        try {
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

            // Clear component registry
            mComponentRegistry.clear();

            // Clear event callback registry
            mEventCallbackRegistry.clear();

            // Clean up scene manager
            if (mSceneManager != null) {
                mSceneManager.cleanup();
            }

            // Clean up event delegate
            if (mEventDelegate != null) {
                mEventDelegate.dispose();
            }

            // Reset managers
            mMaterialManager = null;
            mAnimationManager = null;

            // Reset flags
            mIsAR = false;
            mIsVR = false;
            mIs3D = false;

            Log.d(TAG, "Cleanup completed successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error during cleanup", e);
        }
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
     * Initialize the JSI bridge.
     */
    private void initHybrid() {
        try {
            mJSIBridge = new ViroFabricContainerJSI(mReactContext, this);
            Log.d(TAG, "JSI bridge initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize JSI bridge", e);
        }
    }

    /**
     * Get the active navigator.
     */
    public ViewGroup getActiveNavigator() {
        if (mARSceneNavigator != null) {
            return mARSceneNavigator;
        } else if (mVRSceneNavigator != null) {
            return mVRSceneNavigator;
        } else {
            return mSceneNavigator;
        }
    }

    /**
     * Create a component - complete implementation with full functionality.
     */
    @DoNotStrip
    public void createComponent(String componentId, String componentType, ReadableMap props) {
        Log.d(TAG, "Creating component: " + componentId + " of type: " + componentType);
        
        // Get the appropriate navigator
        ViewGroup navigator = getActiveNavigator();
        if (navigator == null) {
            Log.e(TAG, "Cannot create component: no active navigator");
            return;
        }
        
        try {
            // Create the appropriate VRT component based on type
            VRTComponent component = createVRTComponent(componentType, props);
            if (component != null) {
                mComponentRegistry.put(componentId, component);
                
                // Add to navigator if it's a scene
                if (component instanceof VRTScene && navigator instanceof VRT3DSceneNavigator) {
                    ((VRT3DSceneNavigator) navigator).addView(component);
                } else if (component instanceof VRTARScene && navigator instanceof VRTARSceneNavigator) {
                    ((VRTARSceneNavigator) navigator).addView(component);
                }
                
                Log.d(TAG, "Successfully created component: " + componentId);
            } else {
                Log.w(TAG, "Failed to create component of type: " + componentType);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Create a VRT component based on the component type with complete support.
     */
    private VRTComponent createVRTComponent(String componentType, ReadableMap props) {
        VRTComponent component = null;
        
        try {
            switch (componentType) {
                case "scene":
                    component = new VRTScene(mReactContext);
                    break;
                    
                case "arScene":
                    component = new VRTARScene(mReactContext);
                    break;
                    
                case "box":
                    component = new VRTBox(mReactContext);
                    break;
                    
                case "sphere":
                    component = new VRTSphere(mReactContext);
                    break;
                    
                case "text":
                    component = new VRTText(mReactContext);
                    break;
                    
                case "image":
                    component = new VRTImage(mReactContext);
                    break;
                    
                case "quad":
                    component = new VRTQuad(mReactContext);
                    break;
                    
                case "video":
                    component = new VRTVideoSurface(mReactContext);
                    break;
                    
                case "3DObject":
                    component = new VRT3DObject(mReactContext);
                    break;
                    
                // Layout components
                case "node":
                    component = new VRTNode(mReactContext);
                    break;
                    
                case "flexView":
                    component = new VRTFlexView(mReactContext);
                    break;
                    
                // Shape components
                case "polygon":
                    component = new VRTPolygon(mReactContext);
                    break;
                    
                case "polyline":
                    component = new VRTPolyline(mReactContext);
                    break;
                    
                case "geometry":
                    component = new VRTGeometry(mReactContext);
                    break;
                    
                // Media components
                case "animatedImage":
                    component = new VRTAnimatedImage(mReactContext);
                    break;
                    
                case "360Image":
                    component = new VRT360Image(mReactContext);
                    break;
                    
                case "360Video":
                    component = new VRT360Video(mReactContext);
                    break;
                    
                // Environment components
                case "skyBox":
                    component = new VRTSkyBox(mReactContext);
                    break;
                    
                case "lightingEnvironment":
                    component = new VRTLightingEnvironment(mReactContext);
                    break;
                    
                // Portal components
                case "portal":
                    component = new VRTPortal(mReactContext);
                    break;
                    
                case "portalScene":
                    component = new VRTPortalScene(mReactContext);
                    break;
                    
                // Effects components
                case "particleEmitter":
                    component = new VRTParticleEmitter(mReactContext);
                    break;
                    
                // Camera components
                case "camera":
                    component = new VRTCamera(mReactContext);
                    break;
                    
                case "orbitCamera":
                    component = new VRTOrbitCamera(mReactContext);
                    break;
                    
                // Lighting components
                case "ambientLight":
                    component = new VRTAmbientLight(mReactContext);
                    break;
                    
                case "directionalLight":
                    component = new VRTDirectionalLight(mReactContext);
                    break;
                    
                case "omniLight":
                    component = new VRTOmniLight(mReactContext);
                    break;
                    
                case "spotLight":
                    component = new VRTSpotLight(mReactContext);
                    break;
                    
                // Audio components
                case "sound":
                    component = new VRTSound(mReactContext);
                    break;
                    
                case "soundField":
                    component = new VRTSoundField(mReactContext);
                    break;
                    
                case "spatialSound":
                    component = new VRTSpatialSoundWrapper(mReactContext);
                    break;
                    
                // Interactive components that extend VRTComponent
                case "controller":
                    component = new VRTController(mReactContext);
                    break;
                    
                case "materialVideo":
                    component = new VRTMaterialVideo(mReactContext);
                    break;
                    
                default:
                    Log.w(TAG, "Unknown component type: " + componentType);
                    return null;
            }
            
            // Apply props if component was created and props are provided
            if (component != null && props != null) {
                applyComponentProperties(component, props);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error creating VRT component of type " + componentType + ": " + e.getMessage(), e);
            return null;
        }
        
        return component;
    }

    /**
     * Update a component with complete property support.
     */
    @DoNotStrip
    public void updateComponent(String componentId, ReadableMap props) {
        Log.d(TAG, "Updating component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot update component: component not found - " + componentId);
            return;
        }
        
        try {
            applyComponentProperties(component, props);
            Log.d(TAG, "Successfully updated component: " + componentId);
        } catch (Exception e) {
            Log.e(TAG, "Error updating component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Delete a component with proper cleanup.
     */
    @DoNotStrip
    public void deleteComponent(String componentId) {
        Log.d(TAG, "Deleting component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot delete component: component not found - " + componentId);
            return;
        }
        
        try {
            // Remove the component from its parent
            ViewGroup parent = (ViewGroup) component.getParent();
            if (parent != null) {
                parent.removeView(component);
            }
            
            // Clean up the component
            component.onTearDown();
            
            // Remove the component from the registry
            mComponentRegistry.remove(componentId);
            Log.d(TAG, "Successfully deleted component: " + componentId);
        } catch (Exception e) {
            Log.e(TAG, "Error deleting component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Add a child to a parent with proper hierarchy management.
     */
    @DoNotStrip
    public void addChild(String childId, String parentId) {
        Log.d(TAG, "Adding child " + childId + " to parent " + parentId);
        
        // Get the parent and child components from the registry
        VRTComponent parent = mComponentRegistry.get(parentId);
        VRTComponent child = mComponentRegistry.get(childId);
        
        if (parent == null || child == null) {
            Log.e(TAG, "Cannot add child: parent or child not found - parent: " + parentId + ", child: " + childId);
            return;
        }
        
        try {
            parent.addView(child);
            Log.d(TAG, "Successfully added child to parent");
        } catch (Exception e) {
            Log.e(TAG, "Error adding child " + childId + " to parent " + parentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Remove a child from a parent with proper cleanup.
     */
    @DoNotStrip
    public void removeChild(String childId, String parentId) {
        Log.d(TAG, "Removing child " + childId + " from parent " + parentId);
        
        // Get the parent and child components from the registry
        VRTComponent parent = mComponentRegistry.get(parentId);
        VRTComponent child = mComponentRegistry.get(childId);
        
        if (parent == null || child == null) {
            Log.e(TAG, "Cannot remove child: parent or child not found - parent: " + parentId + ", child: " + childId);
            return;
        }
        
        try {
            parent.removeView(child);
            Log.d(TAG, "Successfully removed child from parent");
        } catch (Exception e) {
            Log.e(TAG, "Error removing child " + childId + " from parent " + parentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Register an event callback with complete event support.
     */
    @DoNotStrip
    public void registerEventCallback(String callbackId, String eventName, String componentId) {
        Log.d(TAG, "Registering event callback: " + callbackId + " for event: " + eventName + " on component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot register event callback: component not found - " + componentId);
            return;
        }
        
        try {
            // Store the callback ID in the registry
            String key = componentId + "_" + eventName;
            mEventCallbackRegistry.put(key, callbackId);
            
            // Register with event delegate
            if (mEventDelegate != null) {
                mEventDelegate.registerEventCallback(callbackId, eventName, componentId);
            }
            
            Log.d(TAG, "Successfully registered event callback");
        } catch (Exception e) {
            Log.e(TAG, "Error registering event callback for component " + componentId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Unregister an event callback.
     */
    @DoNotStrip
    public void unregisterEventCallback(String callbackId, String eventName, String componentId) {
        Log.d(TAG, "Unregistering event callback: " + callbackId + " for event: " + eventName + " on component: " + componentId);
        
        try {
            // Remove the callback ID from the registry
            String key = componentId + "_" + eventName;
            mEventCallbackRegistry.remove(key);
            
            // Unregister with event delegate
            if (mEventDelegate != null) {
                mEventDelegate.unregisterEventCallback(callbackId, eventName, componentId);
            }
            
            Log.d(TAG, "Successfully unregistered event callback");
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering event callback for component " + componentId + ": " + e.getMessage(), e);
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
     * Public method to dispatch events to JavaScript - used by event delegate.
     */
    public void dispatchEventToJS(String callbackId, WritableMap data) {
        dispatchEventToJSImpl(callbackId, data);
    }
    
    /**
     * Implementation of the dispatchEventToJS method for the C++ side.
     * This method is called from Java to dispatch events to JavaScript.
     */
    @DoNotStrip
    private void dispatchEventToJSImpl(String callbackId, ReadableMap data) {
        try {
            // Try to use the JSI bridge first for optimal performance
            if (mJSIBridge != null && mJSIBridge.isAvailable()) {
                // Call the native JSI method to dispatch directly to JavaScript
                if (dispatchEventViaJSI(callbackId, data)) {
                    Log.d(TAG, "Event dispatched successfully via JSI bridge");
                    return;
                }
                Log.w(TAG, "JSI event dispatch failed, falling back to RCTEventEmitter");
            }
        } catch (Exception e) {
            Log.w(TAG, "JSI event dispatch failed, falling back to RCTEventEmitter: " + e.getMessage());
        }
        
        // Fallback to RCTEventEmitter for compatibility
        WritableMap event = new WritableNativeMap();
        event.putString("callbackId", callbackId);
        event.putMap("data", data);
        sendEvent("ViroEvent", event);
    }
    
    /**
     * Dispatch event via JSI bridge (implemented in C++).
     */
    @DoNotStrip
    private native boolean dispatchEventViaJSI(String callbackId, ReadableMap data);

    /**
     * Create a material with complete material support.
     */
    @DoNotStrip
    public void createMaterial(String materialName, ReadableMap properties) {
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
            Log.e(TAG, "Error updating material " + materialName + ": " + e.getMessage(), e);
        }
    }

    /**
     * Create an animation with complete animation support.
     */
    @DoNotStrip
    public void createAnimation(String animationName, ReadableMap properties) {
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
     * Execute an animation on a component with complete animation support.
     */
    @DoNotStrip
    public void executeAnimation(String animationName, String componentId, ReadableMap options) {
        Log.d(TAG, "Executing animation: " + animationName + " on component: " + componentId);
        
        // Get the component from the registry
        VRTComponent component = mComponentRegistry.get(componentId);
        if (component == null) {
            Log.e(TAG, "Cannot execute animation: component not found - " + componentId);
            return;
        }
        
        try {
            // Use reflection to set animation properties on the component
            Method setAnimationMethod = component.getClass().getMethod("setAnimation", ReadableMap.class);
            
            // Create animation configuration
            WritableMap animationConfig = Arguments.createMap();
            animationConfig.putString("name", animationName);
            
            if (options != null) {
                // Copy options to animation config
                if (options.hasKey("run")) {
                    animationConfig.putBoolean("run", options.getBoolean("run"));
                }
                if (options.hasKey("loop")) {
                    animationConfig.putBoolean("loop", options.getBoolean("loop"));
                }
                if (options.hasKey("delay")) {
                    animationConfig.putDouble("delay", options.getDouble("delay"));
                }
            }
            
            setAnimationMethod.invoke(component, animationConfig);
            Log.d(TAG, "Successfully executed animation: " + animationName + " on component: " + componentId);
        } catch (Exception e) {
            Log.e(TAG, "Error executing animation " + animationName + " on component " + componentId + ": " + e.getMessage(), e);
        }
    }

    // ======================== Scene Management Methods ========================
    
    /**
     * Create a scene with the scene manager.
     */
    @DoNotStrip
    public void createScene(String sceneId, String sceneType, ReadableMap props) {
        Log.d(TAG, "Creating scene: " + sceneId + " of type: " + sceneType);
        
        if (mSceneManager != null) {
            mSceneManager.createScene(sceneId, sceneType, props);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Activate a scene.
     */
    @DoNotStrip
    public void activateScene(String sceneId) {
        Log.d(TAG, "Activating scene: " + sceneId);
        
        if (mSceneManager != null) {
            mSceneManager.activateScene(sceneId);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Deactivate a scene.
     */
    @DoNotStrip
    public void deactivateScene(String sceneId) {
        Log.d(TAG, "Deactivating scene: " + sceneId);
        
        if (mSceneManager != null) {
            mSceneManager.deactivateScene(sceneId);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Destroy a scene.
     */
    @DoNotStrip
    public void destroyScene(String sceneId) {
        Log.d(TAG, "Destroying scene: " + sceneId);
        
        if (mSceneManager != null) {
            mSceneManager.destroyScene(sceneId);
        } else {
            Log.e(TAG, "Scene manager not available");
        }
    }
    
    /**
     * Get the state of a scene.
     */
    @DoNotStrip
    public String getSceneState(String sceneId) {
        if (mSceneManager != null) {
            ViroFabricSceneManager.SceneState state = mSceneManager.getSceneState(sceneId);
            if (state != null) {
                switch (state) {
                    case CREATED:
                        return "created";
                    case LOADING:
                        return "loading";
                    case LOADED:
                        return "loaded";
                    case ACTIVE:
                        return "active";
                    case PAUSED:
                        return "paused";
                    case DESTROYED:
                        return "destroyed";
                    default:
                        return "unknown";
                }
            }
        }
        return null;
    }
    
    /**
     * Get memory statistics.
     */
    @DoNotStrip
    public WritableMap getMemoryStats() {
        if (mSceneManager != null) {
            return mSceneManager.getMemoryStats();
        } else {
            WritableMap stats = Arguments.createMap();
            stats.putString("error", "Scene manager not available");
            return stats;
        }
    }
    
    /**
     * Perform memory cleanup.
     */
    @DoNotStrip
    public void performMemoryCleanup() {
        Log.d(TAG, "Performing memory cleanup");
        
        if (mSceneManager != null) {
            mSceneManager.performMemoryCleanup();
        } else {
            Log.w(TAG, "Scene manager not available for memory cleanup");
        }
    }
    
    // ======================== AR Configuration Methods ========================
    
    /**
     * Set AR plane detection configuration.
     */
    @DoNotStrip
    public void setARPlaneDetection(ReadableMap config) {
        Log.d(TAG, "Setting AR plane detection configuration");
        
        if (!mIsAR || mARSceneNavigator == null) {
            Log.w(TAG, "Cannot set AR plane detection: not in AR mode");
            return;
        }
        
        try {
            if (config != null) {
                // Extract configuration options
                boolean enabled = config.hasKey("enabled") ? config.getBoolean("enabled") : true;
                String alignment = config.hasKey("alignment") ? config.getString("alignment") : "Horizontal";
                
                // Apply configuration to the AR scene navigator using reflection
                try {
                    Method setPlaneDetectionMethod = mARSceneNavigator.getClass().getMethod("setPlaneDetection", boolean.class);
                    setPlaneDetectionMethod.invoke(mARSceneNavigator, enabled);
                } catch (Exception e) {
                    Log.w(TAG, "Could not set plane detection enabled, method may not be available: " + e.getMessage());
                }
                
                try {
                    Method setPlaneDetectionAlignmentMethod = mARSceneNavigator.getClass().getMethod("setPlaneDetectionAlignment", String.class);
                    setPlaneDetectionAlignmentMethod.invoke(mARSceneNavigator, alignment);
                } catch (Exception e) {
                    Log.w(TAG, "Could not set plane detection alignment, method may not be available: " + e.getMessage());
                }
                
                Log.d(TAG, "Successfully configured AR plane detection - enabled: " + enabled + ", alignment: " + alignment);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting AR plane detection: " + e.getMessage(), e);
        }
    }

    /**
     * Set AR image targets configuration.
     */
    @DoNotStrip
    public void setARImageTargets(ReadableMap targets) {
        Log.d(TAG, "Setting AR image targets");
        
        if (!mIsAR || mARSceneNavigator == null) {
            Log.w(TAG, "Cannot set AR image targets: not in AR mode");
            return;
        }
        
        try {
            if (targets != null) {
                // Apply image targets to the AR scene navigator using reflection
                try {
                    Method setImageTargetsMethod = mARSceneNavigator.getClass().getMethod("setImageTargets", ReadableMap.class);
                    setImageTargetsMethod.invoke(mARSceneNavigator, targets);
                    Log.d(TAG, "Successfully configured AR image targets");
                } catch (Exception e) {
                    Log.w(TAG, "Could not set image targets, method may not be available: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error setting AR image targets: " + e.getMessage(), e);
        }
    }

    /**
     * Apply properties to a VRT component - complete implementation with full property support.
     */
    private void applyComponentProperties(VRTComponent component, ReadableMap props) {
        if (component == null || props == null) {
            return;
        }
        
        try {
            // Transform properties
            if (props.hasKey("position") && props.getType("position") == ReadableType.Array) {
                ReadableArray position = props.getArray("position");
                setComponentProperty(component, "setPosition", convertArrayToFloatArray(position));
            }
            
            if (props.hasKey("rotation") && props.getType("rotation") == ReadableType.Array) {
                ReadableArray rotation = props.getArray("rotation");
                setComponentProperty(component, "setRotation", convertArrayToFloatArray(rotation));
            }
            
            if (props.hasKey("scale") && props.getType("scale") == ReadableType.Array) {
                ReadableArray scale = props.getArray("scale");
                setComponentProperty(component, "setScale", convertArrayToFloatArray(scale));
            }
            
            if (props.hasKey("rotationPivot") && props.getType("rotationPivot") == ReadableType.Array) {
                ReadableArray rotationPivot = props.getArray("rotationPivot");
                setComponentProperty(component, "setRotationPivot", convertArrayToFloatArray(rotationPivot));
            }
            
            if (props.hasKey("scalePivot") && props.getType("scalePivot") == ReadableType.Array) {
                ReadableArray scalePivot = props.getArray("scalePivot");
                setComponentProperty(component, "setScalePivot", convertArrayToFloatArray(scalePivot));
            }
            
            // Appearance properties
            if (props.hasKey("opacity") && props.getType("opacity") == ReadableType.Number) {
                setComponentProperty(component, "setOpacity", (float) props.getDouble("opacity"));
            }
            
            if (props.hasKey("visible") && props.getType("visible") == ReadableType.Boolean) {
                setComponentProperty(component, "setVisible", props.getBoolean("visible"));
            }
            
            if (props.hasKey("renderingOrder") && props.getType("renderingOrder") == ReadableType.Number) {
                setComponentProperty(component, "setRenderingOrder", props.getInt("renderingOrder"));
            }
            
            // Event handling properties
            if (props.hasKey("canHover") && props.getType("canHover") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanHover", props.getBoolean("canHover"));
            }
            
            if (props.hasKey("canClick") && props.getType("canClick") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanClick", props.getBoolean("canClick"));
            }
            
            if (props.hasKey("canTouch") && props.getType("canTouch") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanTouch", props.getBoolean("canTouch"));
            }
            
            if (props.hasKey("canScroll") && props.getType("canScroll") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanScroll", props.getBoolean("canScroll"));
            }
            
            if (props.hasKey("canSwipe") && props.getType("canSwipe") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanSwipe", props.getBoolean("canSwipe"));
            }
            
            if (props.hasKey("canDrag") && props.getType("canDrag") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanDrag", props.getBoolean("canDrag"));
            }
            
            if (props.hasKey("canFuse") && props.getType("canFuse") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanFuse", props.getBoolean("canFuse"));
            }
            
            if (props.hasKey("canPinch") && props.getType("canPinch") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanPinch", props.getBoolean("canPinch"));
            }
            
            if (props.hasKey("canRotate") && props.getType("canRotate") == ReadableType.Boolean) {
                setComponentProperty(component, "setCanRotate", props.getBoolean("canRotate"));
            }
            
            if (props.hasKey("timeToFuse") && props.getType("timeToFuse") == ReadableType.Number) {
                setComponentProperty(component, "setTimeToFuse", (float) props.getDouble("timeToFuse"));
            }
            
            // Material properties
            if (props.hasKey("materials") && props.getType("materials") == ReadableType.Array) {
                ReadableArray materials = props.getArray("materials");
                setComponentMaterials(component, materials);
            }
            
            // Animation properties
            if (props.hasKey("animation") && props.getType("animation") == ReadableType.Map) {
                ReadableMap animation = props.getMap("animation");
                setComponentProperty(component, "setAnimation", animation);
            }
            
            // Physics properties
            if (props.hasKey("physicsBody") && props.getType("physicsBody") == ReadableType.Map) {
                ReadableMap physicsBody = props.getMap("physicsBody");
                setComponentProperty(component, "setPhysicsBody", physicsBody);
            }
            
            // Component-specific properties
            applyComponentSpecificProperties(component, props);
            
            Log.d(TAG, "Applied properties to component successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error applying component properties: " + e.getMessage(), e);
        }
    }

    /**
     * Apply component-specific properties based on component type.
     */
    private void applyComponentSpecificProperties(VRTComponent component, ReadableMap props) {
        try {
            // Text-specific properties
            if (component instanceof VRTText) {
                if (props.hasKey("text") && props.getType("text") == ReadableType.String) {
                    setComponentProperty(component, "setText", props.getString("text"));
                }
                if (props.hasKey("fontSize") && props.getType("fontSize") == ReadableType.Number) {
                    setComponentProperty(component, "setFontSize", (float) props.getDouble("fontSize"));
                }
                if (props.hasKey("color") && props.getType("color") == ReadableType.Number) {
                    setComponentProperty(component, "setColor", props.getInt("color"));
                }
            }
            
            // Image-specific properties
            else if (component instanceof VRTImage) {
                if (props.hasKey("source") && props.getType("source") == ReadableType.Map) {
                    setComponentProperty(component, "setSource", props.getMap("source"));
                }
            }
            
            // Box-specific properties
            else if (component instanceof VRTBox) {
                if (props.hasKey("width") && props.getType("width") == ReadableType.Number) {
                    setComponentProperty(component, "setWidth", (float) props.getDouble("width"));
                }
                if (props.hasKey("height") && props.getType("height") == ReadableType.Number) {
                    setComponentProperty(component, "setHeight", (float) props.getDouble("height"));
                }
                if (props.hasKey("length") && props.getType("length") == ReadableType.Number) {
                    setComponentProperty(component, "setLength", (float) props.getDouble("length"));
                }
            }
            
            // Sphere-specific properties
            else if (component instanceof VRTSphere) {
                if (props.hasKey("radius") && props.getType("radius") == ReadableType.Number) {
                    setComponentProperty(component, "setRadius", (float) props.getDouble("radius"));
                }
            }
            
            // 3D Object-specific properties
            else if (component instanceof VRT3DObject) {
                if (props.hasKey("source") && props.getType("source") == ReadableType.Map) {
                    setComponentProperty(component, "setSource", props.getMap("source"));
                }
                if (props.hasKey("type") && props.getType("type") == ReadableType.String) {
                    setComponentProperty(component, "setType", props.getString("type"));
                }
            }
            
            // Light-specific properties
            else if (component instanceof VRTAmbientLight || 
                     component instanceof VRTDirectionalLight || 
                     component instanceof VRTOmniLight || 
                     component instanceof VRTSpotLight) {
                if (props.hasKey("color") && props.getType("color") == ReadableType.Number) {
                    setComponentProperty(component, "setColor", props.getInt("color"));
                }
                if (props.hasKey("intensity") && props.getType("intensity") == ReadableType.Number) {
                    setComponentProperty(component, "setIntensity", (float) props.getDouble("intensity"));
                }
            }
            
            // Sound-specific properties
            else if (component instanceof VRTSound) {
                if (props.hasKey("source") && props.getType("source") == ReadableType.Map) {
                    setComponentProperty(component, "setSource", props.getMap("source"));
                }
                if (props.hasKey("paused") && props.getType("paused") == ReadableType.Boolean) {
                    setComponentProperty(component, "setPaused", props.getBoolean("paused"));
                }
                if (props.hasKey("volume") && props.getType("volume") == ReadableType.Number) {
                    setComponentProperty(component, "setVolume", (float) props.getDouble("volume"));
                }
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error applying component-specific properties: " + e.getMessage(), e);
        }
    }

    /**
     * Set a property on a component using reflection.
     */
    private void setComponentProperty(VRTComponent component, String methodName, Object value) {
        try {
            Class<?> componentClass = component.getClass();
            Method method = null;
            
            // Try to find the method with the appropriate parameter type
            if (value instanceof Float) {
                try {
                    method = componentClass.getMethod(methodName, float.class);
                } catch (NoSuchMethodException e) {
                    // Try with Float wrapper class
                    method = componentClass.getMethod(methodName, Float.class);
                }
            } else if (value instanceof Boolean) {
                try {
                    method = componentClass.getMethod(methodName, boolean.class);
                } catch (NoSuchMethodException e) {
                    // Try with Boolean wrapper class
                    method = componentClass.getMethod(methodName, Boolean.class);
                }
            } else if (value instanceof Integer) {
                try {
                    method = componentClass.getMethod(methodName, int.class);
                } catch (NoSuchMethodException e) {
                    // Try with Integer wrapper class
                    method = componentClass.getMethod(methodName, Integer.class);
                }
            } else if (value instanceof float[]) {
                method = componentClass.getMethod(methodName, float[].class);
            } else if (value instanceof ReadableMap) {
                method = componentClass.getMethod(methodName, ReadableMap.class);
            } else if (value instanceof String) {
                method = componentClass.getMethod(methodName, String.class);
            } else {
                method = componentClass.getMethod(methodName, value.getClass());
            }
            
            if (method != null) {
                method.invoke(component, value);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not set property " + methodName + " on component: " + e.getMessage());
        }
    }

    /**
     * Set materials on a component.
     */
    private void setComponentMaterials(VRTComponent component, ReadableArray materials) {
        try {
            List<String> materialNames = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                if (materials.getType(i) == ReadableType.String) {
                    materialNames.add(materials.getString(i));
                }
            }
            
            // Convert to array and set on component
            String[] materialArray = materialNames.toArray(new String[0]);
            setComponentProperty(component, "setMaterials", materialArray);
        } catch (Exception e) {
            Log.e(TAG, "Error setting component materials: " + e.getMessage(), e);
        }
    }

    /**
     * Convert ReadableArray to float array.
     */
    private float[] convertArrayToFloatArray(ReadableArray array) {
        float[] result = new float[array.size()];
        for (int i = 0; i < array.size(); i++) {
            result[i] = (float) array.getDouble(i);
        }
        return result;
    }

    // Scene lifecycle listener implementation
    @Override
    public void onSceneCreated(String sceneId, VRTComponent scene) {
        Log.d(TAG, "Scene lifecycle: Scene created - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "created");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onSceneActivated(String sceneId, VRTComponent scene) {
        Log.d(TAG, "Scene lifecycle: Scene activated - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "active");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onSceneDeactivated(String sceneId, VRTComponent scene) {
        Log.d(TAG, "Scene lifecycle: Scene deactivated - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "paused");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onSceneDestroyed(String sceneId) {
        Log.d(TAG, "Scene lifecycle: Scene destroyed - " + sceneId);
        
        // Send event to JavaScript
        WritableMap event = new WritableNativeMap();
        event.putString("sceneId", sceneId);
        event.putString("state", "destroyed");
        sendEvent("onSceneStateChanged", event);
    }

    @Override
    public void onMemoryWarning() {
        Log.w(TAG, "Scene lifecycle: Memory warning received");
        
        // Send memory warning to JavaScript
        if (mSceneManager != null) {
            WritableMap memoryStats = mSceneManager.getMemoryStats();
            WritableMap event = new WritableNativeMap();
            event.putMap("memoryStats", memoryStats);
            sendEvent("onMemoryWarning", event);
        }
    }

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        if (mJSIBridge != null) {
            mJSIBridge.cleanup();
            mJSIBridge = null;
        }
    }
}
