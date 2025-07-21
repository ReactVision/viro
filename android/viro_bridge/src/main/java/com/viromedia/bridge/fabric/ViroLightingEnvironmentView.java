//
//  ViroLightingEnvironmentView.java
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
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.EventDelegate;
import com.viro.core.LightingEnvironment;
import com.viro.core.Node;
import com.viro.core.Texture;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;

/**
 * Native Android view for ViroLightingEnvironment component.
 * ViroLightingEnvironment provides comprehensive HDR environment lighting for realistic scene illumination
 * with Image-Based Lighting (IBL), diffuse/specular intensity control, and multiple environment formats.
 */
public class ViroLightingEnvironmentView extends View {
    
    private static final String TAG = "ViroLightingEnvironmentView";
    
    // Loading states
    private static final int LOADING_STATE_NONE = 0;
    private static final int LOADING_STATE_LOADING = 1;
    private static final int LOADING_STATE_LOADED = 2;
    private static final int LOADING_STATE_ERROR = 3;
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private LightingEnvironment mLightingEnvironmentJni;
    private Texture mEnvironmentTextureJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Lighting environment properties
    private Map<String, Object> mSource;
    private float mIntensity = 1.0f;
    private float mRotation = 0.0f;
    private Vector mRotationVector = new Vector(0.0f, 0.0f, 0.0f);
    
    // IBL (Image-Based Lighting) properties
    private boolean mEnableImageBasedLighting = true;
    private float mDiffuseIntensity = 1.0f;
    private float mSpecularIntensity = 1.0f;
    
    // Advanced lighting properties
    private float mEnvironmentIntensity = 1.0f;
    private boolean mCastShadows = true;
    private int mShadowMapSize = 1024;
    private float mShadowBias = 0.005f;
    private float mShadowOpacity = 0.7f;
    
    // State management
    private int mLoadingState = LOADING_STATE_NONE;
    private String mCurrentSourceURI;
    private LightingEnvironment.EnvironmentType mEnvironmentType = LightingEnvironment.EnvironmentType.HDR;
    
    public ViroLightingEnvironmentView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroLightingEnvironmentView initialized with ViroReact LightingEnvironment integration");
        
        initializeLightingEnvironment();
    }
    
    private void initializeLightingEnvironment() {
        Log.d(TAG, "Initializing ViroReact lighting environment with default properties");
        
        // Create ViroReact Node for the lighting environment
        mNodeJni = new Node();
        
        // Create LightingEnvironment with initial properties
        mLightingEnvironmentJni = new LightingEnvironment(mViroContext);
        
        // Configure initial lighting environment properties
        applyLightingEnvironmentProperties();
        
        // Attach lighting environment to node
        mNodeJni.setLightingEnvironment(mLightingEnvironmentJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Lighting environment views are typically invisible
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact LightingEnvironment initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroLightingEnvironmentView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroLightingEnvironmentView> mLightingEnvironmentView;
        
        public VRTComponentWrapper(ViroLightingEnvironmentView lightingEnvironmentView) {
            super(lightingEnvironmentView.getContext(), null, -1, -1, lightingEnvironmentView.mReactContext);
            mLightingEnvironmentView = new WeakReference<>(lightingEnvironmentView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroLightingEnvironmentView lightingEnvironmentView = mLightingEnvironmentView.get();
            if (lightingEnvironmentView != null) {
                lightingEnvironmentView.emitLightingEnvironmentEvent(eventName, eventData);
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
     * Get the underlying ViroReact LightingEnvironment object
     */
    public LightingEnvironment getLightingEnvironmentJni() {
        return mLightingEnvironmentJni;
    }
    
    /**
     * Set the ViroContext for this lighting environment
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate lighting environment with ViroContext if needed
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.dispose();
            mLightingEnvironmentJni = new LightingEnvironment(mViroContext);
            applyLightingEnvironmentProperties();
            if (mNodeJni != null) {
                mNodeJni.setLightingEnvironment(mLightingEnvironmentJni);
            }
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // Lighting environments don't have traditional dimensions
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Lighting environment layout is handled by the lighting system
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Source management
    
    public void setSource(@Nullable ReadableMap source) {
        Log.d(TAG, "Setting lighting environment source: " + source);
        
        mSource = source != null ? source.toHashMap() : null;
        
        if (mSource == null) {
            clearLightingEnvironment();
            return;
        }
        
        // Get source URI
        String uri = (String) mSource.get("uri");
        if (uri != null) {
            mCurrentSourceURI = uri;
            loadLightingEnvironment();
        }
    }
    
    public void setIntensity(float intensity) {
        Log.d(TAG, "Setting lighting environment intensity: " + intensity);
        mIntensity = intensity;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setIntensity(intensity);
        }
        applyLightingEnvironmentProperties();
    }
    
    public void setRotation(float rotation) {
        Log.d(TAG, "Setting lighting environment rotation: " + rotation);
        mRotation = rotation;
        
        // Convert degrees to radians and create rotation vector
        float rotationRadians = (float) Math.toRadians(rotation);
        mRotationVector = new Vector(0.0f, rotationRadians, 0.0f);
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setRotation(mRotationVector);
        }
        applyLightingEnvironmentProperties();
    }
    
    public void setEnableImageBasedLighting(boolean enabled) {
        Log.d(TAG, "Setting IBL enabled: " + enabled);
        mEnableImageBasedLighting = enabled;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setImageBasedLightingEnabled(enabled);
        }
        applyLightingEnvironmentProperties();
    }
    
    public void setDiffuseIntensity(float intensity) {
        Log.d(TAG, "Setting diffuse intensity: " + intensity);
        mDiffuseIntensity = intensity;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setDiffuseIntensity(intensity);
        }
        applyLightingEnvironmentProperties();
    }
    
    public void setSpecularIntensity(float intensity) {
        Log.d(TAG, "Setting specular intensity: " + intensity);
        mSpecularIntensity = intensity;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setSpecularIntensity(intensity);
        }
        applyLightingEnvironmentProperties();
    }
    
    public void setEnvironmentIntensity(float intensity) {
        Log.d(TAG, "Setting environment intensity: " + intensity);
        mEnvironmentIntensity = intensity;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setEnvironmentIntensity(intensity);
        }
    }
    
    public void setCastShadows(boolean castShadows) {
        Log.d(TAG, "Setting cast shadows: " + castShadows);
        mCastShadows = castShadows;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setCastShadows(castShadows);
        }
    }
    
    public void setShadowMapSize(int shadowMapSize) {
        Log.d(TAG, "Setting shadow map size: " + shadowMapSize);
        mShadowMapSize = shadowMapSize;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setShadowMapSize(shadowMapSize);
        }
    }
    
    public void setShadowBias(float shadowBias) {
        Log.d(TAG, "Setting shadow bias: " + shadowBias);
        mShadowBias = shadowBias;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setShadowBias(shadowBias);
        }
    }
    
    public void setShadowOpacity(float shadowOpacity) {
        Log.d(TAG, "Setting shadow opacity: " + shadowOpacity);
        mShadowOpacity = shadowOpacity;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setShadowOpacity(shadowOpacity);
        }
    }
    
    // Loading methods
    
    private void loadLightingEnvironment() {
        if (mCurrentSourceURI == null) {
            return;
        }
        
        Log.d(TAG, "Loading lighting environment from: " + mCurrentSourceURI);
        
        mLoadingState = LOADING_STATE_LOADING;
        
        // Emit load start event
        emitLoadStartEvent();
        
        // Determine file type by extension
        String lowerCaseURI = mCurrentSourceURI.toLowerCase();
        if (lowerCaseURI.endsWith(".hdr") || lowerCaseURI.endsWith(".exr")) {
            mEnvironmentType = LightingEnvironment.EnvironmentType.HDR;
            loadHDREnvironment();
        } else if (lowerCaseURI.endsWith(".jpg") || lowerCaseURI.endsWith(".png")) {
            mEnvironmentType = LightingEnvironment.EnvironmentType.EQUIRECTANGULAR;
            loadEquirectangularEnvironment();
        } else if (lowerCaseURI.contains("cubemap") || mSource.containsKey("cubemap")) {
            mEnvironmentType = LightingEnvironment.EnvironmentType.CUBEMAP;
            loadCubeMapEnvironment();
        } else {
            // Try to load as HDR by default
            mEnvironmentType = LightingEnvironment.EnvironmentType.HDR;
            loadHDREnvironment();
        }
    }
    
    private void loadHDREnvironment() {
        Log.d(TAG, "Loading HDR environment");
        
        if (mLightingEnvironmentJni != null && mViroContext != null) {
            // Create HDR texture
            mEnvironmentTextureJni = new Texture(mViroContext, mCurrentSourceURI, 
                new Texture.LoadCallback() {
                    @Override
                    public void onSuccess(Texture texture) {
                        handleHDRLoadSuccess(texture);
                    }
                    
                    @Override
                    public void onError(String error) {
                        handleLoadError("HDR loading failed: " + error);
                    }
                });
        } else {
            handleLoadError("ViroContext not available for HDR loading");
        }
    }
    
    private void loadEquirectangularEnvironment() {
        Log.d(TAG, "Loading equirectangular environment");
        
        if (mLightingEnvironmentJni != null && mViroContext != null) {
            // Create equirectangular texture
            mEnvironmentTextureJni = new Texture(mViroContext, mCurrentSourceURI,
                new Texture.LoadCallback() {
                    @Override
                    public void onSuccess(Texture texture) {
                        handleEquirectangularLoadSuccess(texture);
                    }
                    
                    @Override
                    public void onError(String error) {
                        handleLoadError("Equirectangular loading failed: " + error);
                    }
                });
        } else {
            handleLoadError("ViroContext not available for equirectangular loading");
        }
    }
    
    private void loadCubeMapEnvironment() {
        Log.d(TAG, "Loading cube map environment");
        
        if (mSource != null && mSource.containsKey("cubemap")) {
            Map<String, Object> cubemapData = (Map<String, Object>) mSource.get("cubemap");
            if (cubemapData != null && mLightingEnvironmentJni != null && mViroContext != null) {
                // Load cube map faces
                String[] faces = {
                    (String) cubemapData.get("px"), // positive X
                    (String) cubemapData.get("nx"), // negative X
                    (String) cubemapData.get("py"), // positive Y
                    (String) cubemapData.get("ny"), // negative Y
                    (String) cubemapData.get("pz"), // positive Z
                    (String) cubemapData.get("nz")  // negative Z
                };
                
                // Create cubemap texture
                mEnvironmentTextureJni = new Texture(mViroContext, faces,
                    new Texture.LoadCallback() {
                        @Override
                        public void onSuccess(Texture texture) {
                            handleCubeMapLoadSuccess(texture);
                        }
                        
                        @Override
                        public void onError(String error) {
                            handleLoadError("Cubemap loading failed: " + error);
                        }
                    });
            } else {
                handleLoadError("Invalid cubemap data provided");
            }
        } else {
            handleLoadError("Cubemap data not found in source");
        }
    }
    
    // Load success handlers
    
    private void handleHDRLoadSuccess(Texture texture) {
        Log.d(TAG, "HDR environment loaded successfully");
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setEnvironmentTexture(texture, LightingEnvironment.EnvironmentType.HDR);
            mLoadingState = LOADING_STATE_LOADED;
            applyLightingEnvironmentProperties();
            emitLoadEndEvent(true);
        }
    }
    
    private void handleEquirectangularLoadSuccess(Texture texture) {
        Log.d(TAG, "Equirectangular environment loaded successfully");
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setEnvironmentTexture(texture, LightingEnvironment.EnvironmentType.EQUIRECTANGULAR);
            mLoadingState = LOADING_STATE_LOADED;
            applyLightingEnvironmentProperties();
            emitLoadEndEvent(true);
        }
    }
    
    private void handleCubeMapLoadSuccess(Texture texture) {
        Log.d(TAG, "Cubemap environment loaded successfully");
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.setEnvironmentTexture(texture, LightingEnvironment.EnvironmentType.CUBEMAP);
            mLoadingState = LOADING_STATE_LOADED;
            applyLightingEnvironmentProperties();
            emitLoadEndEvent(true);
        }
    }
    
    // Helper Methods
    private void applyLightingEnvironmentProperties() {
        if (mLightingEnvironmentJni != null) {
            Log.d(TAG, "Applying lighting environment properties to ViroReact LightingEnvironment");
            
            // Apply intensity and rotation
            mLightingEnvironmentJni.setIntensity(mIntensity);
            mLightingEnvironmentJni.setRotation(mRotationVector);
            
            // Apply IBL settings
            mLightingEnvironmentJni.setImageBasedLightingEnabled(mEnableImageBasedLighting);
            if (mEnableImageBasedLighting) {
                mLightingEnvironmentJni.setDiffuseIntensity(mDiffuseIntensity);
                mLightingEnvironmentJni.setSpecularIntensity(mSpecularIntensity);
            }
            
            // Apply advanced lighting properties
            mLightingEnvironmentJni.setEnvironmentIntensity(mEnvironmentIntensity);
            mLightingEnvironmentJni.setCastShadows(mCastShadows);
            mLightingEnvironmentJni.setShadowMapSize(mShadowMapSize);
            mLightingEnvironmentJni.setShadowBias(mShadowBias);
            mLightingEnvironmentJni.setShadowOpacity(mShadowOpacity);
            
            Log.d(TAG, "Lighting environment properties applied successfully");
        }
    }
    
    // Environment management
    
    private void clearLightingEnvironment() {
        Log.d(TAG, "Clearing lighting environment");
        
        mLoadingState = LOADING_STATE_NONE;
        mCurrentSourceURI = null;
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.clearEnvironmentTexture();
        }
        
        if (mEnvironmentTextureJni != null) {
            mEnvironmentTextureJni.dispose();
            mEnvironmentTextureJni = null;
        }
    }
    
    // Error handling
    
    private void handleLoadError(String errorMessage) {
        Log.e(TAG, "Lighting environment load error: " + errorMessage);
        
        mLoadingState = LOADING_STATE_ERROR;
        
        // Clean up failed texture
        if (mEnvironmentTextureJni != null) {
            mEnvironmentTextureJni.dispose();
            mEnvironmentTextureJni = null;
        }
        
        // Emit error event
        emitErrorEvent(errorMessage);
    }
    
    // Event emission
    
    private void emitLoadStartEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroLightingEnvironment");
        event.putString("uri", mCurrentSourceURI);
        emitLightingEnvironmentEvent("onLoadStartViro", event);
    }
    
    private void emitLoadEndEvent(boolean success) {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroLightingEnvironment");
        event.putBoolean("success", success);
        event.putString("uri", mCurrentSourceURI);
        event.putString("environmentType", mEnvironmentType.toString());
        emitLightingEnvironmentEvent("onLoadEndViro", event);
    }
    
    private void emitErrorEvent(String errorMessage) {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroLightingEnvironment");
        event.putString("error", errorMessage != null ? errorMessage : "Unknown lighting environment error");
        event.putString("uri", mCurrentSourceURI);
        emitLightingEnvironmentEvent("onErrorViro", event);
    }
    
    private void emitLightingEnvironmentEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clear lighting environment
        clearLightingEnvironment();
        
        // Clean up ViroReact lighting environment resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setLightingEnvironment(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mLightingEnvironmentJni != null) {
            mLightingEnvironmentJni.dispose();
            mLightingEnvironmentJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mSource = null;
        mCurrentSourceURI = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroLightingEnvironmentView attached to window");
        
        // Lighting environment will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mLightingEnvironmentJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact lighting environment ready for scene attachment");
        }
        
        // Ensure lighting environment properties are applied
        applyLightingEnvironmentProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroLightingEnvironmentView detached from window");
        
        // Lighting environment cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public float getIntensity() { return mIntensity; }
    public float getRotation() { return mRotation; }
    public boolean isImageBasedLightingEnabled() { return mEnableImageBasedLighting; }
    public float getDiffuseIntensity() { return mDiffuseIntensity; }
    public float getSpecularIntensity() { return mSpecularIntensity; }
    public float getEnvironmentIntensity() { return mEnvironmentIntensity; }
    public boolean getCastShadows() { return mCastShadows; }
    public int getShadowMapSize() { return mShadowMapSize; }
    public float getShadowBias() { return mShadowBias; }
    public float getShadowOpacity() { return mShadowOpacity; }
    public int getLoadingState() { return mLoadingState; }
    public String getCurrentSourceURI() { return mCurrentSourceURI; }
    public LightingEnvironment.EnvironmentType getEnvironmentType() { return mEnvironmentType; }
}