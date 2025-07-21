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

import com.viro.core.EventDelegate;
import com.viro.core.Light;
import com.viro.core.Node;
import com.viro.core.SpotLight;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroSpotLight component.
 * ViroSpotLight represents a cone light source that emits light from a specific 
 * position in a specific direction with adjustable cone angles.
 */
public class ViroSpotLightView extends View {
    
    private static final String TAG = "ViroSpotLightView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private SpotLight mSpotLightJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Light color and intensity properties
    private int mColor = 0xFFFFFFFF; // White light by default
    private float mIntensity = 1000.0f; // Default intensity for spot lights
    private float mTemperature = 6500.0f; // Default daylight temperature
    
    // Light position and direction
    private Vector mPosition = new Vector(0.0f, 2.0f, 0.0f); // Default above origin
    private Vector mDirection = new Vector(0.0f, -1.0f, 0.0f); // Default pointing down
    
    // Spotlight cone properties (in degrees)
    private float mInnerAngle = 30.0f; // Full intensity cone
    private float mOuterAngle = 45.0f; // Falloff cone
    
    // Light attenuation properties
    private float mAttenuationStartDistance = 0.0f; // Full intensity from source
    private float mAttenuationEndDistance = 10.0f; // No light beyond this distance
    
    // Shadow properties
    private boolean mCastsShadow = true;
    private float mShadowOpacity = 1.0f;
    private int mShadowMapSize = 1024;
    private float mShadowBias = 0.005f;
    private float mShadowNearZ = 1.0f;
    private float mShadowFarZ = 100.0f;
    
    // Light influence
    private int mInfluenceBitMask = 1;
    
    public ViroSpotLightView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroSpotLightView with ViroReact SpotLight integration");
        
        // Create ViroReact Node for the light
        mNodeJni = new Node();
        
        // Create SpotLight with initial parameters
        mSpotLightJni = new SpotLight();
        
        // Configure initial light properties
        applyLightProperties();
        
        // Attach light to node
        mNodeJni.addLight(mSpotLightJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Light views are typically transparent since they represent non-visible light sources
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact SpotLight initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroSpotLightView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroSpotLightView> mLightView;
        
        public VRTComponentWrapper(ViroSpotLightView lightView) {
            super(lightView.getContext(), null, -1, -1, lightView.mReactContext);
            mLightView = new WeakReference<>(lightView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroSpotLightView lightView = mLightView.get();
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
     * Get the underlying ViroReact SpotLight object
     */
    public SpotLight getSpotLightJni() {
        return mSpotLightJni;
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
        Log.d(TAG, "Setting spot light color: " + colorString);
        
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
        Log.d(TAG, "Setting spot light intensity: " + intensity);
        mIntensity = Math.max(0.0f, intensity); // Ensure non-negative intensity
        applyLightProperties();
    }
    
    public void setTemperature(float temperature) {
        Log.d(TAG, "Setting spot light temperature: " + temperature);
        mTemperature = Math.max(1000.0f, Math.min(12000.0f, temperature)); // Clamp to realistic range
        applyLightProperties();
    }
    
    // Light position and direction setters
    
    public void setPosition(@Nullable ReadableArray position) {
        Log.d(TAG, "Setting spot light position: " + position);
        
        if (position != null && position.size() >= 3) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                
                mPosition = new Vector(x, y, z);
                
                // Update node position to match light position
                if (mNodeJni != null) {
                    mNodeJni.setPosition(mPosition);
                }
                
                Log.d(TAG, "Applied position: [" + x + ", " + y + ", " + z + "]");
            } catch (Exception e) {
                Log.e(TAG, "Error parsing position array: " + e.getMessage());
                mPosition = new Vector(0.0f, 2.0f, 0.0f); // Default above origin
            }
        } else {
            mPosition = new Vector(0.0f, 2.0f, 0.0f); // Default above origin
        }
        
        applyLightProperties();
    }
    
    public void setDirection(@Nullable ReadableArray direction) {
        Log.d(TAG, "Setting spot light direction: " + direction);
        
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
    
    // Spotlight cone properties setters
    
    public void setInnerAngle(float innerAngle) {
        Log.d(TAG, "Setting spot light inner angle: " + innerAngle);
        mInnerAngle = Math.max(0.0f, Math.min(180.0f, innerAngle)); // Clamp to valid range
        
        // Ensure outer angle is >= inner angle
        if (mOuterAngle < mInnerAngle) {
            mOuterAngle = mInnerAngle;
        }
        
        applyLightProperties();
    }
    
    public void setOuterAngle(float outerAngle) {
        Log.d(TAG, "Setting spot light outer angle: " + outerAngle);
        mOuterAngle = Math.max(mInnerAngle, Math.min(180.0f, outerAngle)); // Ensure >= inner
        applyLightProperties();
    }
    
    // Light attenuation setters
    
    public void setAttenuationStartDistance(float attenuationStartDistance) {
        Log.d(TAG, "Setting spot light attenuation start distance: " + attenuationStartDistance);
        mAttenuationStartDistance = Math.max(0.0f, attenuationStartDistance);
        applyLightProperties();
    }
    
    public void setAttenuationEndDistance(float attenuationEndDistance) {
        Log.d(TAG, "Setting spot light attenuation end distance: " + attenuationEndDistance);
        mAttenuationEndDistance = Math.max(mAttenuationStartDistance + 0.1f, attenuationEndDistance);
        applyLightProperties();
    }
    
    // Shadow properties setters
    
    public void setCastsShadow(boolean castsShadow) {
        Log.d(TAG, "Setting spot light casts shadow: " + castsShadow);
        mCastsShadow = castsShadow;
        applyLightProperties();
    }
    
    public void setShadowOpacity(float shadowOpacity) {
        Log.d(TAG, "Setting spot light shadow opacity: " + shadowOpacity);
        mShadowOpacity = Math.max(0.0f, Math.min(1.0f, shadowOpacity)); // Clamp to [0, 1]
        applyLightProperties();
    }
    
    public void setShadowMapSize(int shadowMapSize) {
        Log.d(TAG, "Setting spot light shadow map size: " + shadowMapSize);
        mShadowMapSize = Math.max(256, Math.min(4096, shadowMapSize)); // Reasonable range
        applyLightProperties();
    }
    
    public void setShadowBias(float shadowBias) {
        Log.d(TAG, "Setting spot light shadow bias: " + shadowBias);
        mShadowBias = shadowBias;
        applyLightProperties();
    }
    
    public void setShadowNearZ(float shadowNearZ) {
        Log.d(TAG, "Setting spot light shadow near Z: " + shadowNearZ);
        mShadowNearZ = Math.max(0.1f, shadowNearZ);
        applyLightProperties();
    }
    
    public void setShadowFarZ(float shadowFarZ) {
        Log.d(TAG, "Setting spot light shadow far Z: " + shadowFarZ);
        mShadowFarZ = Math.max(mShadowNearZ + 1.0f, shadowFarZ);
        applyLightProperties();
    }
    
    // Light influence setters
    
    public void setInfluenceBitMask(int influenceBitMask) {
        Log.d(TAG, "Setting spot light influence bit mask: " + influenceBitMask);
        mInfluenceBitMask = influenceBitMask;
        applyLightProperties();
    }
    
    private void applyLightProperties() {
        if (mSpotLightJni != null) {
            Log.d(TAG, "Applying spot light properties to ViroReact SpotLight");
            
            // Apply color (convert Android Color to RGB components)
            float red = ((mColor >> 16) & 0xFF) / 255.0f;
            float green = ((mColor >> 8) & 0xFF) / 255.0f;
            float blue = (mColor & 0xFF) / 255.0f;
            
            // Set light color and intensity
            mSpotLightJni.setColor(red, green, blue);
            mSpotLightJni.setIntensity(mIntensity);
            mSpotLightJni.setTemperature(mTemperature);
            
            // Set light direction
            mSpotLightJni.setDirection(mDirection);
            
            // Set cone angles (convert degrees to radians)
            float innerAngleRadians = (float) Math.toRadians(mInnerAngle);
            float outerAngleRadians = (float) Math.toRadians(mOuterAngle);
            mSpotLightJni.setInnerAngle(innerAngleRadians);
            mSpotLightJni.setOuterAngle(outerAngleRadians);
            
            // Set attenuation properties
            mSpotLightJni.setAttenuationStartDistance(mAttenuationStartDistance);
            mSpotLightJni.setAttenuationEndDistance(mAttenuationEndDistance);
            
            // Configure shadow properties
            mSpotLightJni.setCastsShadow(mCastsShadow);
            if (mCastsShadow) {
                mSpotLightJni.setShadowOpacity(mShadowOpacity);
                mSpotLightJni.setShadowMapSize(mShadowMapSize);
                mSpotLightJni.setShadowBias(mShadowBias);
                mSpotLightJni.setShadowNearZ(mShadowNearZ);
                mSpotLightJni.setShadowFarZ(mShadowFarZ);
            }
            
            // Set influence bit mask
            mSpotLightJni.setInfluenceBitMask(mInfluenceBitMask);
            
            Log.d(TAG, "SpotLight properties applied successfully");
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
        
        // Clean up ViroReact spot light resources
        if (mNodeJni != null) {
            if (mSpotLightJni != null) {
                mNodeJni.removeLight(mSpotLightJni);
            }
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mSpotLightJni != null) {
            mSpotLightJni.dispose();
            mSpotLightJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroSpotLightView attached to window");
        
        // Light will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mSpotLightJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact spot light ready for scene attachment");
        }
        
        // Ensure light properties are applied
        applyLightProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroSpotLightView detached from window");
        
        // Light cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}