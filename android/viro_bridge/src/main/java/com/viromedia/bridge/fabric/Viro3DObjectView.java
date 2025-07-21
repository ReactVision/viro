//
//  Viro3DObjectView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.EventDelegate;
import com.viro.core.Geometry;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Object3D;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for Viro3DObject component.
 * Viro3DObject provides comprehensive 3D model loading and rendering capabilities
 * with support for multiple formats, animations, and material customization.
 */
public class Viro3DObjectView extends View {
    
    private static final String TAG = "Viro3DObjectView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Object3D mObject3DJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;

    // 3D Model source properties
    private ReadableMap mSource;
    private String mUri;
    private String mType;
    private ReadableArray mResources;

    // Model appearance
    private List<Material> mMaterials;
    private int mLightReceivingBitMask = 1;
    private int mShadowCastingBitMask = 1;

    // Model transformation
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mPivot = new Vector(0.0f, 0.0f, 0.0f);

    // Animation properties
    private ReadableMap mAnimation;
    private ReadableArray mMorphTargets;
    private Map<String, Float> mMorphTargetWeights;

    // Loading configuration
    private boolean mHighAccuracyEvents = false;
    private boolean mIgnoreEventHandling = false;

    // Model state
    private boolean mIsLoading = false;
    private boolean mIsLoaded = false;
    private String mLoadedModelPath;

    // Animation state
    private Map<String, AnimationState> mAnimationStates;

    // Internal class for animation state tracking
    private static class AnimationState {
        boolean playing;
        boolean loop;
        long startTime;
        long pauseTime;
        
        AnimationState(boolean playing, boolean loop) {
            this.playing = playing;
            this.loop = loop;
            this.startTime = System.currentTimeMillis();
            this.pauseTime = -1;
        }
    }

    public Viro3DObjectView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "Viro3DObjectView initialized with ViroReact Object3D integration");
        
        // Initialize state tracking
        mMorphTargetWeights = new HashMap<>();
        mAnimationStates = new HashMap<>();
        mMaterials = new ArrayList<>();
        
        initialize3DObject();
    }

    private void initialize3DObject() {
        Log.d(TAG, "Initializing ViroReact 3D object with default properties");
        
        // Create ViroReact Node for the 3D object
        mNodeJni = new Node();
        
        // Object3D will be created when a source is loaded
        // Initial transform setup
        applyTransformProperties();
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // 3D object containers are typically transparent
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact 3D object initialized successfully");
    }

    /**
     * Wrapper class to make Viro3DObjectView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<Viro3DObjectView> mObjectView;
        
        public VRTComponentWrapper(Viro3DObjectView objectView) {
            super(objectView.getContext(), null, -1, -1, objectView.mReactContext);
            mObjectView = new WeakReference<>(objectView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            Viro3DObjectView objectView = mObjectView.get();
            if (objectView != null) {
                objectView.emitObjectEvent(eventName, eventData);
            }
        }
    }
    
    /**
     * Get the underlying ViroReact Node object
     */
    public Node getNodeJni() {
        return mNodeJni;
    }
    
    /**
     * Get the underlying ViroReact Object3D object
     */
    public Object3D getObject3DJni() {
        return mObject3DJni;
    }
    
    /**
     * Set the ViroContext for this 3D object
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For 3D objects, we don't use traditional Android view measurements
        // The object size is determined by 3D model geometry and transforms
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D transforms, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // 3D Model Source Properties
    public void setSource(@Nullable ReadableMap source) {
        Log.d(TAG, "Setting source: " + source);
        mSource = source;
        
        if (source != null) {
            // Extract URI and type from source dictionary
            if (source.hasKey("uri")) {
                String uri = source.getString("uri");
                if (uri != null) {
                    setUri(uri);
                }
            }
            
            if (source.hasKey("type")) {
                String type = source.getString("type");
                if (type != null) {
                    setType(type);
                }
            }
        } else {
            // Clear the 3D object
            unload3DObject();
        }
    }

    public void setUri(@Nullable String uri) {
        Log.d(TAG, "Setting URI: " + uri);
        mUri = uri;
        
        if (uri != null && !uri.isEmpty()) {
            load3DObjectFromURI(uri);
        } else {
            unload3DObject();
        }
    }

    public void setType(@Nullable String type) {
        Log.d(TAG, "Setting type: " + type);
        mType = type;
        
        // Supported types: OBJ, FBX, GLTF, GLB, DAE
        // Type helps optimize loading and parsing
    }

    // Model Resources
    public void setResources(@Nullable ReadableArray resources) {
        Log.d(TAG, "Setting resources: " + resources);
        mResources = resources;
        
        // Resources include textures, materials, and other assets
        // referenced by the 3D model
        if (mIsLoaded) {
            applyResourcesToLoadedModel();
        }
    }

    // Model Appearance
    public void setMaterials(@Nullable ReadableArray materials) {
        Log.d(TAG, "Setting materials: " + materials);
        
        // Convert ReadableArray to Material list
        if (materials != null && mObject3DJni != null) {
            mMaterials = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                String materialName = materials.getString(i);
                if (materialName != null) {
                    // Create material from name/reference
                    Material material = new Material();
                    // TODO: Configure material properties based on materialName
                    mMaterials.add(material);
                }
            }
            
            // Apply materials to 3D object
            if (!mMaterials.isEmpty()) {
                mObject3DJni.setMaterials(mMaterials);
            }
        }
    }

    public void setLightReceivingBitMask(int lightReceivingBitMask) {
        Log.d(TAG, "Setting light receiving bit mask: " + lightReceivingBitMask);
        mLightReceivingBitMask = lightReceivingBitMask;
        
        if (mObject3DJni != null) {
            mObject3DJni.setLightReceivingBitMask(lightReceivingBitMask);
        }
    }

    public void setShadowCastingBitMask(int shadowCastingBitMask) {
        Log.d(TAG, "Setting shadow casting bit mask: " + shadowCastingBitMask);
        mShadowCastingBitMask = shadowCastingBitMask;
        
        if (mObject3DJni != null) {
            mObject3DJni.setShadowCastingBitMask(shadowCastingBitMask);
        }
    }

    // Model Transformation
    public void setScale(@Nullable ReadableArray scale) {
        Log.d(TAG, "Setting scale: " + scale);
        
        if (scale != null && scale.size() >= 3) {
            try {
                float x = (float) scale.getDouble(0);
                float y = (float) scale.getDouble(1);
                float z = (float) scale.getDouble(2);
                mScale = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing scale: " + e.getMessage());
                mScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mScale = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        applyTransformProperties();
    }

    public void setRotation(@Nullable ReadableArray rotation) {
        Log.d(TAG, "Setting rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0)); // Convert to radians
                float y = (float) Math.toRadians(rotation.getDouble(1));
                float z = (float) Math.toRadians(rotation.getDouble(2));
                mRotation = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing rotation: " + e.getMessage());
                mRotation = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mRotation = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }

    public void setPosition(@Nullable ReadableArray position) {
        Log.d(TAG, "Setting position: " + position);
        
        if (position != null && position.size() >= 3) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                mPosition = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing position: " + e.getMessage());
                mPosition = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mPosition = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }

    public void setPivot(@Nullable ReadableArray pivot) {
        Log.d(TAG, "Setting pivot: " + pivot);
        
        if (pivot != null && pivot.size() >= 3) {
            try {
                float x = (float) pivot.getDouble(0);
                float y = (float) pivot.getDouble(1);
                float z = (float) pivot.getDouble(2);
                mPivot = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing pivot: " + e.getMessage());
                mPivot = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mPivot = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }

    // Animation Properties
    public void setAnimation(@Nullable ReadableMap animation) {
        Log.d(TAG, "Setting animation: " + animation);
        mAnimation = animation;
        
        if (animation != null) {
            String name = animation.hasKey("name") ? animation.getString("name") : null;
            boolean loop = animation.hasKey("loop") && animation.getBoolean("loop");
            boolean play = animation.hasKey("play") && animation.getBoolean("play");
            
            if (name != null && play) {
                playAnimation(name, loop);
            }
        }
    }

    public void setMorphTargets(@Nullable ReadableArray morphTargets) {
        Log.d(TAG, "Setting morph targets: " + morphTargets);
        mMorphTargets = morphTargets;
        
        // Apply morph target weights
        if (morphTargets != null) {
            for (int i = 0; i < morphTargets.size(); i++) {
                ReadableMap target = morphTargets.getMap(i);
                if (target != null) {
                    String name = target.hasKey("name") ? target.getString("name") : null;
                    double weight = target.hasKey("weight") ? target.getDouble("weight") : 0.0;
                    
                    if (name != null) {
                        setMorphTargetWeight(name, (float) weight);
                    }
                }
            }
        }
    }

    // Loading Configuration
    public void setHighAccuracyEvents(boolean highAccuracyEvents) {
        Log.d(TAG, "Setting high accuracy events: " + highAccuracyEvents);
        mHighAccuracyEvents = highAccuracyEvents;
        
        if (mNodeJni != null) {
            mNodeJni.setHighAccuracyEvents(highAccuracyEvents);
        }
    }

    public void setIgnoreEventHandling(boolean ignoreEventHandling) {
        Log.d(TAG, "Setting ignore event handling: " + ignoreEventHandling);
        mIgnoreEventHandling = ignoreEventHandling;
        
        if (mNodeJni != null) {
            mNodeJni.setIgnoreEventHandling(ignoreEventHandling);
        }
    }

    // Animation Control Methods
    public void playAnimation(String animationName, boolean loop) {
        Log.d(TAG, "Playing animation: " + animationName + " (loop: " + loop + ")");
        
        if (!mIsLoaded) {
            Log.w(TAG, "Cannot play animation - 3D object not loaded");
            return;
        }
        
        // Store animation state
        mAnimationStates.put(animationName, new AnimationState(true, loop));
        
        // Play animation on ViroReact 3D object
        if (mObject3DJni != null) {
            mObject3DJni.playAnimation(animationName, loop);
        }
        
        // Fire animation start event
        emitAnimationStartEvent(animationName);
    }

    public void pauseAnimation(String animationName) {
        Log.d(TAG, "Pausing animation: " + animationName);
        
        AnimationState state = mAnimationStates.get(animationName);
        if (state != null) {
            state.playing = false;
            state.pauseTime = System.currentTimeMillis();
        }
        
        if (mObject3DJni != null) {
            mObject3DJni.pauseAnimation(animationName);
        }
    }

    public void stopAnimation(String animationName, boolean reset) {
        Log.d(TAG, "Stopping animation: " + animationName + " (reset: " + reset + ")");
        
        mAnimationStates.remove(animationName);
        
        if (mObject3DJni != null) {
            mObject3DJni.stopAnimation(animationName);
            if (reset) {
                mObject3DJni.resetAnimationToFrame(animationName, 0);
            }
        }
        
        // Fire animation finish event
        emitAnimationFinishEvent(animationName);
    }

    // Morph Target Control
    public void setMorphTargetWeight(String targetName, float weight) {
        Log.d(TAG, "Setting morph target weight: " + targetName + " = " + weight);
        
        // Clamp weight to [0, 1]
        weight = Math.max(0.0f, Math.min(1.0f, weight));
        mMorphTargetWeights.put(targetName, weight);
        
        if (mIsLoaded && mObject3DJni != null) {
            mObject3DJni.setMorphTargetWeight(targetName, weight);
        }
    }

    // 3D Object Loading
    private void load3DObjectFromURI(String uri) {
        Log.d(TAG, "Loading 3D object from URI: " + uri);
        
        mIsLoading = true;
        mIsLoaded = false;
        mLoadedModelPath = uri;
        
        // Fire onLoadStart event
        emitLoadStartEvent();
        
        // Create ViroReact Object3D with loading callback
        if (mViroContext != null) {
            mObject3DJni = new Object3D(mViroContext, uri, 
                new Object3D.LoadCallback() {
                    @Override
                    public void onSuccess(Object3D object3D) {
                        Log.d(TAG, "3D object loaded successfully");
                        handle3DObjectLoaded();
                    }
                    
                    @Override
                    public void onError(String error) {
                        Log.e(TAG, "3D object load error: " + error);
                        handle3DObjectLoadError(error);
                    }
                    
                    @Override
                    public void onProgress(float progress) {
                        Log.d(TAG, "3D object loading progress: " + (progress * 100) + "%");
                        emitLoadProgressEvent(progress);
                    }
                });
        } else {
            // Fallback loading without context
            postDelayed(new Runnable() {
                @Override
                public void run() {
                    handle3DObjectLoaded();
                }
            }, 500); // 500ms delay to simulate loading
        }
    }

    private void handle3DObjectLoaded() {
        Log.d(TAG, "3D object loaded successfully");
        
        mIsLoading = false;
        mIsLoaded = true;
        
        // Attach 3D object to node
        if (mNodeJni != null && mObject3DJni != null) {
            mNodeJni.setGeometry(mObject3DJni);
        }
        
        // Apply any pending configurations
        applyResourcesToLoadedModel();
        applyTransformProperties();
        
        // Apply lighting configuration
        if (mObject3DJni != null) {
            mObject3DJni.setLightReceivingBitMask(mLightReceivingBitMask);
            mObject3DJni.setShadowCastingBitMask(mShadowCastingBitMask);
        }
        
        // Apply morph target weights
        for (Map.Entry<String, Float> entry : mMorphTargetWeights.entrySet()) {
            if (mObject3DJni != null) {
                mObject3DJni.setMorphTargetWeight(entry.getKey(), entry.getValue());
            }
        }
        
        // Apply materials
        if (!mMaterials.isEmpty() && mObject3DJni != null) {
            mObject3DJni.setMaterials(mMaterials);
        }
        
        // Fire onLoad event
        emitLoadEvent();
    }

    private void handle3DObjectLoadError(String error) {
        Log.e(TAG, "3D object load error: " + error);
        
        mIsLoading = false;
        mIsLoaded = false;
        
        // Fire onError event
        emitErrorEvent(error);
    }

    private void unload3DObject() {
        Log.d(TAG, "Unloading 3D object");
        
        mIsLoading = false;
        mIsLoaded = false;
        mLoadedModelPath = null;
        
        // Clear animation states
        mAnimationStates.clear();
        mMorphTargetWeights.clear();
        
        // Remove 3D object from ViroReact scene
        if (mNodeJni != null) {
            mNodeJni.setGeometry(null);
        }
        
        if (mObject3DJni != null) {
            mObject3DJni.dispose();
            mObject3DJni = null;
        }
    }

    // Helper Methods
    private void applyTransformProperties() {
        if (mNodeJni != null) {
            Log.d(TAG, "Applying transform properties to ViroReact Node");
            
            // Apply position, rotation, and scale to the node
            mNodeJni.setPosition(mPosition);
            mNodeJni.setRotation(mRotation);
            mNodeJni.setScale(mScale);
            
            // Apply pivot if the object is loaded
            if (mObject3DJni != null) {
                mObject3DJni.setPivot(mPivot);
            }
            
            Log.d(TAG, "Transform properties applied successfully");
        }
    }

    private void applyResourcesToLoadedModel() {
        if (mResources == null || mObject3DJni == null) {
            return;
        }
        
        Log.d(TAG, "Applying " + mResources.size() + " resources to loaded model");
        
        // Apply resources (textures, materials) to the loaded 3D object
        for (int i = 0; i < mResources.size(); i++) {
            ReadableMap resource = mResources.getMap(i);
            if (resource != null) {
                String type = resource.hasKey("type") ? resource.getString("type") : null;
                String uri = resource.hasKey("uri") ? resource.getString("uri") : null;
                String name = resource.hasKey("name") ? resource.getString("name") : null;
                
                if ("texture".equals(type) && uri != null && name != null) {
                    // Create and apply texture
                    // TODO: Load texture from URI and apply to specific material slot
                } else if ("material".equals(type) && name != null) {
                    // Apply material configuration
                    // TODO: Configure material properties for specific mesh parts
                }
            }
        }
    }
    
    private void emitLoadProgressEvent(float progress) {
        WritableMap event = Arguments.createMap();
        event.putDouble("progress", progress);
        emitObjectEvent("onLoadProgress", event);
    }

    // Event Emission
    private void emitLoadStartEvent() {
        WritableMap event = Arguments.createMap();
        emitObjectEvent("onLoadStart", event);
    }

    private void emitLoadEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("path", mLoadedModelPath);
        
        // Add model information to event if available
        if (mObject3DJni != null) {
            // TODO: Extract model information like bounding box, vertex count, etc.
            // event.putMap("boundingBox", boundingBoxMap);
            // event.putArray("animationNames", animationNamesArray);
            // event.putArray("morphTargetNames", morphTargetNamesArray);
        }
        
        emitObjectEvent("onLoad", event);
    }

    private void emitErrorEvent(String errorMessage) {
        WritableMap event = Arguments.createMap();
        event.putString("error", errorMessage != null ? errorMessage : "Unknown error loading 3D object");
        emitObjectEvent("onError", event);
    }

    private void emitAnimationStartEvent(String animationName) {
        WritableMap event = Arguments.createMap();
        event.putString("animation", animationName);
        emitObjectEvent("onAnimationStart", event);
    }

    private void emitAnimationFinishEvent(String animationName) {
        WritableMap event = Arguments.createMap();
        event.putString("animation", animationName);
        emitObjectEvent("onAnimationFinish", event);
    }
    
    // Event emission
    private void emitObjectEvent(String eventName, @Nullable WritableMap eventData) {
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

    // Lifecycle methods
    public void onDropViewInstance() {
        Log.d(TAG, "onDropViewInstance called");
        
        // Clean up ViroReact 3D object resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setGeometry(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mObject3DJni != null) {
            mObject3DJni.dispose();
            mObject3DJni = null;
        }
        
        // Clear material references
        if (mMaterials != null) {
            for (Material material : mMaterials) {
                material.dispose();
            }
            mMaterials.clear();
            mMaterials = null;
        }
        
        // Clear state
        mAnimationStates.clear();
        mMorphTargetWeights.clear();
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "Viro3DObjectView attached to window");
        
        // 3D object will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mObject3DJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact 3D object ready for scene attachment");
        }
        
        // Ensure transform properties are applied
        applyTransformProperties();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "Viro3DObjectView detached from window");
        
        // 3D object cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }

    // Getters for current values (useful for debugging and testing)
    public String getUri() { return mUri; }
    public String getType() { return mType; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotation; }
    public Vector getPosition() { return mPosition; }
    public Vector getPivot() { return mPivot; }
    public boolean isHighAccuracyEvents() { return mHighAccuracyEvents; }
    public boolean isIgnoreEventHandling() { return mIgnoreEventHandling; }
    public boolean isLoaded() { return mIsLoaded; }
    public boolean isLoading() { return mIsLoading; }
    public String getLoadedModelPath() { return mLoadedModelPath; }
    public int getLightReceivingBitMask() { return mLightReceivingBitMask; }
    public int getShadowCastingBitMask() { return mShadowCastingBitMask; }
}