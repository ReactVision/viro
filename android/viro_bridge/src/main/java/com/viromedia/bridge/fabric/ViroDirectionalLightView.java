package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.DirectionalLight;
import com.viro.core.EventDelegate;
import com.viro.core.Light;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroDirectionalLight component.
 * ViroDirectionalLight represents parallel lighting (like sunlight) that illuminates
 * objects from a specific direction without attenuation.
 */
public class ViroDirectionalLightView extends View {
    
    private static final String TAG = "ViroDirectionalLightView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private DirectionalLight mDirectionalLightJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Light color and intensity properties
    private int mColor = 0xFFFFFFFF; // White light by default
    private float mIntensity = 1000.0f; // Default intensity for directional lights
    private float mTemperature = 6500.0f; // Default daylight temperature
    
    // Light direction (normalized vector)
    private Vector mDirection = new Vector(0.0f, -1.0f, 0.0f); // Default downward direction
    
    // Shadow properties
    private boolean mCastsShadow = true;
    private float mShadowOpacity = 1.0f;
    private int mShadowMapSize = 1024;
    private float mShadowBias = 0.005f;
    private float mShadowNearZ = 1.0f;
    private float mShadowFarZ = 100.0f;
    
    // Light influence
    private int mInfluenceBitMask = 1;
    
    public ViroDirectionalLightView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }

    private void initializeView() {
        Log.d(TAG, "Initializing ViroDirectionalLightView with ViroReact DirectionalLight integration");
        
        // Create ViroReact Node for the light
        mNodeJni = new Node();
        
        // Create DirectionalLight with initial parameters
        mDirectionalLightJni = new DirectionalLight();
        
        // Configure initial light properties
        applyLightProperties();
        
        // Attach light to node
        mNodeJni.addLight(mDirectionalLightJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Light views are typically transparent since they represent non-visible light sources
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact DirectionalLight initialized successfully");
    }

    /**
     * Wrapper class to make ViroDirectionalLightView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroDirectionalLightView> mLightView;
        
        public VRTComponentWrapper(ViroDirectionalLightView lightView) {
            super(lightView.getContext(), null, -1, -1, lightView.mReactContext);
            mLightView = new WeakReference<>(lightView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroDirectionalLightView lightView = mLightView.get();
            if (lightView != null) {
                lightView.emitLightEvent(eventName, eventData);
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
     * Get the underlying ViroReact DirectionalLight object
     */
    public DirectionalLight getDirectionalLightJni() {
        return mDirectionalLightJni;
    }
    
    /**
     * Set the ViroContext for this light
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For lights, we don't use traditional Android view measurements
        // The light effect is determined by 3D light properties, not 2D view size
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D light positioning, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Light color and intensity setters
    
    public void setColor(@Nullable String colorString) {
        Log.d(TAG, "Setting directional light color: " + colorString);
        
        if (colorString != null) {
            try {
                // Parse color string (hex format like "#FFFFFF" or named colors)
                if (colorString.startsWith("#")) {
                    mColor = android.graphics.Color.parseColor(colorString);
                } else {
                    // Handle named colors or other formats
                    mColor = android.graphics.Color.parseColor(colorString);
                }
            } catch (IllegalArgumentException e) {
                Log.w(TAG, "Invalid color format: " + colorString + ", using white");
                mColor = 0xFFFFFFFF;
            }
        } else {
            mColor = 0xFFFFFFFF; // Default to white
        }
        
        applyLightProperties();
    }
    
    public void setIntensity(float intensity) {
        Log.d(TAG, "Setting directional light intensity: " + intensity);
        mIntensity = Math.max(0.0f, intensity); // Ensure non-negative intensity
        applyLightProperties();
    }
    
    public void setTemperature(float temperature) {
        Log.d(TAG, "Setting directional light temperature: " + temperature);
        mTemperature = Math.max(1000.0f, Math.min(12000.0f, temperature)); // Clamp to realistic range
        applyLightProperties();
    }

    // Light direction setters
    
    public void setDirection(@Nullable ReadableArray direction) {
        Log.d(TAG, "Setting directional light direction: " + direction);
        
        if (direction != null && direction.size() >= 3) {
            try {
                float x = (float) direction.getDouble(0);
                float y = (float) direction.getDouble(1);
                float z = (float) direction.getDouble(2);
                
                // Create and normalize direction vector
                mDirection = new Vector(x, y, z);
                mDirection.normalize();
                
                Log.d(TAG, "Applied direction vector: [" + x + ", " + y + ", " + z + "]");
            } catch (Exception e) {
                Log.e(TAG, "Error parsing direction array: " + e.getMessage());
                mDirection = new Vector(0.0f, -1.0f, 0.0f); // Default downward
            }
        } else {
            mDirection = new Vector(0.0f, -1.0f, 0.0f); // Default downward
        }
        
        applyLightProperties();
    }

    // Shadow properties setters
    
    public void setCastsShadow(boolean castsShadow) {
        Log.d(TAG, "Setting directional light casts shadow: " + castsShadow);
        mCastsShadow = castsShadow;
        applyLightProperties();
    }
    
    public void setShadowOpacity(float shadowOpacity) {
        Log.d(TAG, "Setting directional light shadow opacity: " + shadowOpacity);
        mShadowOpacity = Math.max(0.0f, Math.min(1.0f, shadowOpacity)); // Clamp to [0, 1]
        applyLightProperties();
    }
    
    public void setShadowMapSize(int shadowMapSize) {
        Log.d(TAG, "Setting directional light shadow map size: " + shadowMapSize);
        mShadowMapSize = Math.max(256, Math.min(4096, shadowMapSize)); // Reasonable range
        applyLightProperties();
    }
    
    public void setShadowBias(float shadowBias) {
        Log.d(TAG, "Setting directional light shadow bias: " + shadowBias);
        mShadowBias = shadowBias;
        applyLightProperties();
    }
    
    public void setShadowNearZ(float shadowNearZ) {
        Log.d(TAG, "Setting directional light shadow near Z: " + shadowNearZ);
        mShadowNearZ = Math.max(0.1f, shadowNearZ);
        applyLightProperties();
    }
    
    public void setShadowFarZ(float shadowFarZ) {
        Log.d(TAG, "Setting directional light shadow far Z: " + shadowFarZ);
        mShadowFarZ = Math.max(mShadowNearZ + 1.0f, shadowFarZ);
        applyLightProperties();
    }
    
    // Light influence setters
    
    public void setInfluenceBitMask(int influenceBitMask) {
        Log.d(TAG, "Setting directional light influence bit mask: " + influenceBitMask);
        mInfluenceBitMask = influenceBitMask;
        applyLightProperties();
    }

    private void applyLightProperties() {
        if (mDirectionalLightJni != null) {
            Log.d(TAG, "Applying directional light properties to ViroReact DirectionalLight");
            
            // Apply color (convert Android Color to RGB components)
            float red = ((mColor >> 16) & 0xFF) / 255.0f;
            float green = ((mColor >> 8) & 0xFF) / 255.0f;
            float blue = (mColor & 0xFF) / 255.0f;
            
            // Set light color and intensity
            mDirectionalLightJni.setColor(red, green, blue);
            mDirectionalLightJni.setIntensity(mIntensity);
            mDirectionalLightJni.setTemperature(mTemperature);
            
            // Set light direction
            mDirectionalLightJni.setDirection(mDirection);
            
            // Configure shadow properties
            mDirectionalLightJni.setCastsShadow(mCastsShadow);
            if (mCastsShadow) {
                mDirectionalLightJni.setShadowOpacity(mShadowOpacity);
                mDirectionalLightJni.setShadowMapSize(mShadowMapSize);
                mDirectionalLightJni.setShadowBias(mShadowBias);
                mDirectionalLightJni.setShadowNearZ(mShadowNearZ);
                mDirectionalLightJni.setShadowFarZ(mShadowFarZ);
            }
            
            // Set influence bit mask
            mDirectionalLightJni.setInfluenceBitMask(mInfluenceBitMask);
            
            Log.d(TAG, "DirectionalLight properties applied successfully");
        }
    }
    
    // Event emission
    
    private void emitLightEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact directional light resources
        if (mNodeJni != null) {
            if (mDirectionalLightJni != null) {
                mNodeJni.removeLight(mDirectionalLightJni);
            }
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mDirectionalLightJni != null) {
            mDirectionalLightJni.dispose();
            mDirectionalLightJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroDirectionalLightView attached to window");
        
        // Light will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mDirectionalLightJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact directional light ready for scene attachment");
        }
        
        // Ensure light properties are applied
        applyLightProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroDirectionalLightView detached from window");
        
        // Light cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}