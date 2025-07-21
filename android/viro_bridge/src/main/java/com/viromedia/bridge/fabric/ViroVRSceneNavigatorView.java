//
//  ViroVRSceneNavigatorView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.EventDelegate;
import com.viro.core.Renderer;
import com.viro.core.Scene;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.ViroViewScene;
import com.viro.core.VRScene;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for ViroVRSceneNavigator component.
 * ViroVRSceneNavigator provides comprehensive VR scene navigation and rendering
 * with advanced VR features including HDR, PBR, shadows, bloom, and multisampling.
 */
public class ViroVRSceneNavigatorView extends ViewGroup {
    
    private static final String TAG = "ViroVRSceneNavigatorView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private ViroViewScene mViroViewScene;
    private VRScene mVRSceneJni;
    private Renderer mRendererJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // VR-specific properties
    private boolean mVrModeEnabled = true;
    private boolean mAutofocus = true;
    private boolean mDebug = false;
    
    // Scene navigation properties
    private String mInitialSceneKey;
    private int mCurrentSceneIndex = 0;
    private int mPreviousSceneIndex = -1;
    private Map<String, Scene> mSceneMap = new HashMap<>();
    private List<Scene> mSceneStack = new ArrayList<>();
    
    // Renderer settings
    private boolean mHdrEnabled = true;
    private boolean mPbrEnabled = true;
    private boolean mBloomEnabled = false;
    private boolean mShadowsEnabled = true;
    private boolean mMultisamplingEnabled = true;
    
    // VR app properties
    private Map<String, Object> mViroAppProps;
    
    // Event handling
    private boolean mHasOnExitViroCallback = false;
    
    // VR state management
    private boolean mIsVRModeActive = false;
    private List<android.view.View> mSceneViews;
    
    // VR tracking and projection
    private Vector mHeadPose = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mEyePosition = new Vector(0.0f, 0.0f, 0.0f);
    private float[] mProjectionMatrix = new float[16];
    private float[] mViewMatrix = new float[16];
    
    public ViroVRSceneNavigatorView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroVRSceneNavigatorView initialized with ViroReact VR integration");
        
        initializeVRNavigator();
    }
    
    private void initializeVRNavigator() {
        Log.d(TAG, "Initializing ViroReact VR navigator with default properties");
        
        // Initialize scene management
        mSceneViews = new ArrayList<>();
        
        // Create ViroReact ViroViewScene for VR
        mViroViewScene = new ViroViewScene(getContext(), null);
        
        // Create VRScene with initial properties
        mVRSceneJni = new VRScene(mViroContext);
        
        // Create Renderer with VR-specific configuration
        mRendererJni = new Renderer(mViroContext);
        
        // Configure initial VR properties
        applyVRProperties();
        
        // Set up VR scene in ViroViewScene
        if (mViroViewScene != null) {
            mViroViewScene.setScene(mVRSceneJni);
        }
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        
        setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        
        // Configure VR renderer
        configureVRRenderer();
        
        // Enable VR mode by default
        if (mVrModeEnabled) {
            enableVRMode();
        }
        
        Log.d(TAG, "ViroReact VR Navigator initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroVRSceneNavigatorView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroVRSceneNavigatorView> mVRNavigatorView;
        
        public VRTComponentWrapper(ViroVRSceneNavigatorView vrNavigatorView) {
            super(vrNavigatorView.getContext(), null, -1, -1, vrNavigatorView.mReactContext);
            mVRNavigatorView = new WeakReference<>(vrNavigatorView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroVRSceneNavigatorView vrNavigatorView = mVRNavigatorView.get();
            if (vrNavigatorView != null) {
                vrNavigatorView.emitVRSceneNavigatorEvent(eventName, eventData);
            }
        }
    }
    
    /**
     * Get the underlying ViroReact ViroViewScene object
     */
    public ViroViewScene getViroViewScene() {
        return mViroViewScene;
    }
    
    /**
     * Get the underlying ViroReact VRScene object
     */
    public VRScene getVRSceneJni() {
        return mVRSceneJni;
    }
    
    /**
     * Get the underlying ViroReact Renderer object
     */
    public Renderer getRendererJni() {
        return mRendererJni;
    }
    
    /**
     * Set the ViroContext for this VR navigator
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate VR components with ViroContext if needed
        if (mVRSceneJni != null) {
            mVRSceneJni.dispose();
            mVRSceneJni = new VRScene(mViroContext);
            applyVRProperties();
        }
        if (mRendererJni != null) {
            mRendererJni.dispose();
            mRendererJni = new Renderer(mViroContext);
            configureVRRenderer();
        }
    }
    
    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
        // Layout VR scene views
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + l + "," + t + "," + r + "," + b + "]");
        
        // Layout ViroViewScene to fill the entire container
        if (mViroViewScene != null) {
            mViroViewScene.layout(0, 0, r - l, b - t);
        }
        
        // Layout child scene views
        for (int i = 0; i < getChildCount(); i++) {
            android.view.View child = getChildAt(i);
            child.layout(0, 0, r - l, b - t);
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
        
        // Measure ViroViewScene
        if (mViroViewScene != null) {
            measureChild(mViroViewScene, widthMeasureSpec, heightMeasureSpec);
        }
        
        // Measure child views
        for (int i = 0; i < getChildCount(); i++) {
            measureChild(getChildAt(i), widthMeasureSpec, heightMeasureSpec);
        }
    }
    
    // VR-specific setters
    
    public void setVrModeEnabled(boolean enabled) {
        Log.d(TAG, "Setting VR mode enabled: " + enabled);
        mVrModeEnabled = enabled;
        
        if (enabled) {
            enableVRMode();
        } else {
            disableVRMode();
        }
    }
    
    public void setAutofocus(boolean autofocus) {
        Log.d(TAG, "Setting autofocus: " + autofocus);
        mAutofocus = autofocus;
        updateVRSettings();
    }
    
    public void setDebug(boolean debug) {
        Log.d(TAG, "Setting debug: " + debug);
        mDebug = debug;
        updateVRSettings();
    }
    
    // Scene navigation setters
    
    public void setInitialSceneKey(@Nullable String sceneKey) {
        Log.d(TAG, "Setting initial scene key: " + sceneKey);
        mInitialSceneKey = sceneKey;
        
        // Navigate to initial scene if VR is active
        if (mIsVRModeActive && sceneKey != null && mSceneMap.containsKey(sceneKey)) {
            navigateToScene(mSceneMap.get(sceneKey));
        }
    }
    
    public void setCurrentSceneIndex(int index) {
        Log.d(TAG, "Setting current scene index: " + index);
        if (mCurrentSceneIndex != index) {
            mCurrentSceneIndex = index;
            navigateToSceneAtIndex(index);
        }
    }
    
    // Renderer settings setters
    
    public void setHdrEnabled(boolean enabled) {
        Log.d(TAG, "Setting HDR enabled: " + enabled);
        mHdrEnabled = enabled;
        configureVRRenderer();
    }
    
    public void setPbrEnabled(boolean enabled) {
        Log.d(TAG, "Setting PBR enabled: " + enabled);
        mPbrEnabled = enabled;
        configureVRRenderer();
    }
    
    public void setBloomEnabled(boolean enabled) {
        Log.d(TAG, "Setting bloom enabled: " + enabled);
        mBloomEnabled = enabled;
        configureVRRenderer();
    }
    
    public void setShadowsEnabled(boolean enabled) {
        Log.d(TAG, "Setting shadows enabled: " + enabled);
        mShadowsEnabled = enabled;
        configureVRRenderer();
    }
    
    public void setMultisamplingEnabled(boolean enabled) {
        Log.d(TAG, "Setting multisampling enabled: " + enabled);
        mMultisamplingEnabled = enabled;
        configureVRRenderer();
    }
    
    // App properties setter
    
    public void setViroAppProps(@Nullable ReadableMap props) {
        Log.d(TAG, "Setting viro app props: " + props);
        mViroAppProps = props != null ? props.toHashMap() : null;
        
        if (mVRSceneJni != null && mViroAppProps != null) {
            applyAppPropsToVRScene();
        }
    }
    
    // Event handling setters
    
    public void setHasOnExitViroCallback(boolean hasCallback) {
        Log.d(TAG, "Setting has exit viro callback: " + hasCallback);
        mHasOnExitViroCallback = hasCallback;
    }
    
    // Helper Methods
    private void applyVRProperties() {
        if (mVRSceneJni != null) {
            Log.d(TAG, "Applying VR properties to ViroReact VRScene");
            
            // Apply VR-specific settings
            updateVRSettings();
            
            // Apply app props if available
            if (mViroAppProps != null) {
                applyAppPropsToVRScene();
            }
            
            Log.d(TAG, "VR properties applied successfully");
        }
    }
    
    private void applyAppPropsToVRScene() {
        if (mVRSceneJni != null && mViroAppProps != null) {
            Log.d(TAG, "Applying app properties to VR scene");
            
            // Apply background color if specified
            if (mViroAppProps.containsKey("backgroundColor")) {
                Object bgColor = mViroAppProps.get("backgroundColor");
                if (bgColor instanceof List) {
                    List<?> colorList = (List<?>) bgColor;
                    if (colorList.size() >= 3) {
                        float r = ((Number) colorList.get(0)).floatValue();
                        float g = ((Number) colorList.get(1)).floatValue();
                        float b = ((Number) colorList.get(2)).floatValue();
                        mVRSceneJni.setBackgroundColor(r, g, b);
                    }
                }
            }
            
            // Apply other VR-specific properties
            if (mViroAppProps.containsKey("vrEnabled")) {
                boolean vrEnabled = (Boolean) mViroAppProps.get("vrEnabled");
                mVrModeEnabled = vrEnabled;
            }
            
            Log.d(TAG, "App properties applied to VR scene successfully");
        }
    }
    
    // VR mode management
    
    private void enableVRMode() {
        Log.d(TAG, "Enabling VR mode");
        
        mIsVRModeActive = true;
        
        if (mVRSceneJni != null) {
            mVRSceneJni.setVRModeEnabled(true);
        }
        
        if (mRendererJni != null) {
            mRendererJni.setVRMode(true);
        }
        
        // Add ViroViewScene to this ViewGroup if not already added
        if (mViroViewScene != null && mViroViewScene.getParent() == null) {
            addView(mViroViewScene, 0);
        }
        
        updateVRSettings();
        configureVRRenderer();
        
        // Emit VR mode enabled event
        emitVRModeChangedEvent(true);
    }
    
    private void disableVRMode() {
        Log.d(TAG, "Disabling VR mode");
        
        mIsVRModeActive = false;
        
        if (mVRSceneJni != null) {
            mVRSceneJni.setVRModeEnabled(false);
        }
        
        if (mRendererJni != null) {
            mRendererJni.setVRMode(false);
        }
        
        // Remove ViroViewScene from this ViewGroup
        if (mViroViewScene != null && mViroViewScene.getParent() == this) {
            removeView(mViroViewScene);
        }
        
        updateVRSettings();
        
        // Emit VR mode disabled event
        emitVRModeChangedEvent(false);
    }
    
    private void updateVRSettings() {
        if (!mIsVRModeActive || mVRSceneJni == null) {
            return;
        }
        
        Log.d(TAG, "Updating VR settings - autofocus: " + mAutofocus + ", debug: " + mDebug);
        
        // Configure autofocus
        mVRSceneJni.setAutofocusEnabled(mAutofocus);
        
        // Configure debug settings
        mVRSceneJni.setDebugEnabled(mDebug);
        
        Log.d(TAG, "VR settings updated successfully");
    }
    
    private void configureVRRenderer() {
        if (!mIsVRModeActive || mRendererJni == null) {
            return;
        }
        
        Log.d(TAG, "Configuring VR renderer - HDR: " + mHdrEnabled + 
                   ", PBR: " + mPbrEnabled + ", Shadows: " + mShadowsEnabled + 
                   ", Bloom: " + mBloomEnabled + ", Multisampling: " + mMultisamplingEnabled);
        
        // Configure HDR
        mRendererJni.setHDREnabled(mHdrEnabled);
        
        // Configure PBR
        mRendererJni.setPBREnabled(mPbrEnabled);
        
        // Configure shadows
        mRendererJni.setShadowsEnabled(mShadowsEnabled);
        
        // Configure bloom
        mRendererJni.setBloomEnabled(mBloomEnabled);
        
        // Configure multisampling
        mRendererJni.setMultisamplingEnabled(mMultisamplingEnabled);
        
        Log.d(TAG, "VR renderer configured successfully");
    }
    
    // Scene navigation
    
    private void navigateToSceneAtIndex(int index) {
        if (index == mPreviousSceneIndex || index < 0 || index >= mSceneStack.size()) {
            return;
        }
        
        Log.d(TAG, "Navigating to scene at index: " + index);
        
        mPreviousSceneIndex = mCurrentSceneIndex;
        
        Scene targetScene = mSceneStack.get(index);
        navigateToScene(targetScene);
    }
    
    private void navigateToScene(Scene scene) {
        if (scene == null || !mIsVRModeActive) {
            return;
        }
        
        Log.d(TAG, "Navigating to VR scene");
        
        if (mVRSceneJni != null) {
            mVRSceneJni.setRootNode(scene.getRootNode());
        }
        
        updateCurrentScene();
        
        // Emit scene navigation event
        emitSceneNavigationEvent(scene);
    }
    
    private void updateCurrentScene() {
        Log.d(TAG, "Updating current VR scene");
        
        if (mViroViewScene != null && mVRSceneJni != null) {
            mViroViewScene.setScene(mVRSceneJni);
        }
    }
    
    public void pushScene(Scene scene, String sceneKey) {
        Log.d(TAG, "Pushing VR scene: " + sceneKey);
        
        if (scene != null && sceneKey != null) {
            mSceneStack.add(scene);
            mSceneMap.put(sceneKey, scene);
            
            // Navigate to the new scene
            mCurrentSceneIndex = mSceneStack.size() - 1;
            navigateToScene(scene);
        }
    }
    
    public void popScene() {
        Log.d(TAG, "Popping VR scene");
        
        if (mSceneStack.size() > 1) {
            // Remove current scene
            mSceneStack.remove(mSceneStack.size() - 1);
            
            // Navigate to previous scene
            mCurrentSceneIndex = mSceneStack.size() - 1;
            navigateToSceneAtIndex(mCurrentSceneIndex);
        }
    }
    
    public void replaceScene(Scene scene, String sceneKey) {
        Log.d(TAG, "Replacing VR scene: " + sceneKey);
        
        if (scene != null && sceneKey != null && !mSceneStack.isEmpty()) {
            // Replace current scene
            mSceneStack.set(mCurrentSceneIndex, scene);
            mSceneMap.put(sceneKey, scene);
            
            // Navigate to the replacement scene
            navigateToScene(scene);
        }
    }
    
    // VR utilities
    
    public void recenterVRTracking() {
        Log.d(TAG, "Recentering VR tracking");
        
        if (mVRSceneJni != null) {
            mVRSceneJni.recenterTracking();
        }
    }
    
    public Vector projectPoint(Vector point) {
        Log.d(TAG, "Projecting VR point: " + point);
        
        if (mVRSceneJni != null) {
            return mVRSceneJni.projectPoint(point);
        }
        
        // Fallback: return the same point
        return point;
    }
    
    public Vector unprojectPoint(Vector point) {
        Log.d(TAG, "Unprojecting VR point: " + point);
        
        if (mVRSceneJni != null) {
            return mVRSceneJni.unprojectPoint(point);
        }
        
        // Fallback: return the same point
        return point;
    }
    
    public void setHeadPose(@Nullable ReadableArray headPose) {
        Log.d(TAG, "Setting head pose: " + headPose);
        
        if (headPose != null && headPose.size() >= 3) {
            try {
                float x = (float) Math.toRadians(headPose.getDouble(0)); // Convert to radians
                float y = (float) Math.toRadians(headPose.getDouble(1));
                float z = (float) Math.toRadians(headPose.getDouble(2));
                mHeadPose = new Vector(x, y, z);
                
                if (mVRSceneJni != null) {
                    mVRSceneJni.setHeadPose(mHeadPose);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing head pose: " + e.getMessage());
            }
        }
    }
    
    // Event emission
    
    private void emitVRModeChangedEvent(boolean enabled) {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroVRSceneNavigator");
        event.putBoolean("vrModeEnabled", enabled);
        emitVRSceneNavigatorEvent("onVRModeChanged", event);
    }
    
    private void emitSceneNavigationEvent(Scene scene) {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroVRSceneNavigator");
        event.putInt("sceneIndex", mCurrentSceneIndex);
        event.putInt("previousSceneIndex", mPreviousSceneIndex);
        emitVRSceneNavigatorEvent("onSceneNavigation", event);
    }
    
    public void emitExitViroEvent() {
        if (mHasOnExitViroCallback) {
            Log.d(TAG, "Emitting VR exit event");
            
            WritableMap event = Arguments.createMap();
            event.putString("source", "ViroVRSceneNavigator");
            emitVRSceneNavigatorEvent("onExitViro", event);
        }
    }
    
    private void emitVRSceneNavigatorEvent(String eventName, @Nullable WritableMap eventData) {
        try {
            if (mReactContext != null && mReactContext.hasActiveCatalystInstance()) {
                mReactContext.getJSModule(RCTEventEmitter.class)
                    .receiveEvent(getId(), eventName, eventData);
            } else {
                Log.w(TAG, "Cannot emit event " + eventName + ": no active React context");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error emitting event " + eventName + ": " + e.getMessage(), e);
        }
    }
    
    // Child view management
    
    @Override
    public void addView(android.view.View child, int index) {
        super.addView(child, index);
        
        // Add scene views to our tracking list (excluding ViroViewScene)
        if (child != null && child != mViroViewScene && !mSceneViews.contains(child)) {
            mSceneViews.add(child);
            Log.d(TAG, "Added VR scene view at index: " + index);
        }
    }
    
    @Override
    public void removeView(android.view.View child) {
        super.removeView(child);
        
        // Remove from tracking list
        if (mSceneViews.contains(child)) {
            mSceneViews.remove(child);
            Log.d(TAG, "Removed VR scene view");
        }
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        Log.d(TAG, "onDropViewInstance called");
        
        // Disable VR mode
        disableVRMode();
        
        // Clean up ViroReact VR resources
        if (mVRSceneJni != null) {
            mVRSceneJni.dispose();
            mVRSceneJni = null;
        }
        
        if (mRendererJni != null) {
            mRendererJni.dispose();
            mRendererJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        // Clear scene data
        mSceneViews.clear();
        mSceneStack.clear();
        mSceneMap.clear();
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mViroAppProps = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroVRSceneNavigatorView attached to window");
        
        // VR navigator will be initialized when attached
        if (mViroViewScene != null && mVRSceneJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact VR navigator ready for rendering");
        }
        
        // Ensure VR properties are applied
        applyVRProperties();
        
        // Start VR mode if enabled
        if (mVrModeEnabled) {
            enableVRMode();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroVRSceneNavigatorView detached from window");
        
        // VR cleanup is handled in onDropViewInstance
        // Disable VR mode when detached
        disableVRMode();
    }
    
    // Getters for current values (useful for debugging and testing)
    public boolean isVrModeEnabled() { return mVrModeEnabled; }
    public boolean isAutofocus() { return mAutofocus; }
    public boolean isDebug() { return mDebug; }
    public String getInitialSceneKey() { return mInitialSceneKey; }
    public int getCurrentSceneIndex() { return mCurrentSceneIndex; }
    public int getPreviousSceneIndex() { return mPreviousSceneIndex; }
    public boolean isHdrEnabled() { return mHdrEnabled; }
    public boolean isPbrEnabled() { return mPbrEnabled; }
    public boolean isBloomEnabled() { return mBloomEnabled; }
    public boolean isShadowsEnabled() { return mShadowsEnabled; }
    public boolean isMultisamplingEnabled() { return mMultisamplingEnabled; }
    public boolean hasOnExitViroCallback() { return mHasOnExitViroCallback; }
    public boolean isVRModeActive() { return mIsVRModeActive; }
    public Vector getHeadPose() { return mHeadPose; }
    public int getSceneCount() { return mSceneStack.size(); }
}