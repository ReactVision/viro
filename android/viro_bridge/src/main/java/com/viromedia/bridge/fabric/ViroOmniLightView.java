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
import com.viro.core.OmniLight;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroOmniLight component.
 * ViroOmniLight represents a point light source that emits light uniformly 
 * in all directions with distance-based attenuation.
 */
public class ViroOmniLightView extends View {
    
    private static final String TAG = "ViroOmniLightView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private OmniLight mOmniLightJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Light color and intensity properties
    private int mColor = 0xFFFFFFFF; // White light by default
    private float mIntensity = 1000.0f; // Default intensity for omni lights
    private float mTemperature = 6500.0f; // Default daylight temperature
    
    // Light position
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f); // Default at origin
    
    // Light attenuation properties
    private float mAttenuationStartDistance = 0.0f; // Full intensity from source
    private float mAttenuationEndDistance = 10.0f; // No light beyond this distance
    
    // Light influence
    private int mInfluenceBitMask = 1;
    
    public ViroOmniLightView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroOmniLightView with ViroReact OmniLight integration");
        
        // Create ViroReact Node for the light
        mNodeJni = new Node();
        
        // Create OmniLight with initial parameters
        mOmniLightJni = new OmniLight();
        
        // Configure initial light properties
        applyLightProperties();
        
        // Attach light to node
        mNodeJni.addLight(mOmniLightJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Light views are typically transparent since they represent non-visible light sources
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact OmniLight initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroOmniLightView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroOmniLightView> mLightView;
        
        public VRTComponentWrapper(ViroOmniLightView lightView) {
            super(lightView.getContext(), null, -1, -1, lightView.mReactContext);
            mLightView = new WeakReference<>(lightView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroOmniLightView lightView = mLightView.get();
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
     * Get the underlying ViroReact OmniLight object
     */
    public OmniLight getOmniLightJni() {
        return mOmniLightJni;
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
        Log.d(TAG, "Setting omni light color: " + colorString);
        
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
        Log.d(TAG, "Setting omni light intensity: " + intensity);
        mIntensity = Math.max(0.0f, intensity); // Ensure non-negative intensity
        applyLightProperties();
    }
    
    public void setTemperature(float temperature) {
        Log.d(TAG, "Setting omni light temperature: " + temperature);
        mTemperature = Math.max(1000.0f, Math.min(12000.0f, temperature)); // Clamp to realistic range
        applyLightProperties();
    }
    
    // Light position setters
    
    public void setPosition(@Nullable ReadableArray position) {
        Log.d(TAG, "Setting omni light position: " + position);
        
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
                mPosition = new Vector(0.0f, 0.0f, 0.0f); // Default at origin
            }
        } else {
            mPosition = new Vector(0.0f, 0.0f, 0.0f); // Default at origin
        }
        
        applyLightProperties();
    }
    
    // Light attenuation setters
    
    public void setAttenuationStartDistance(float attenuationStartDistance) {
        Log.d(TAG, "Setting omni light attenuation start distance: " + attenuationStartDistance);
        mAttenuationStartDistance = Math.max(0.0f, attenuationStartDistance);
        applyLightProperties();
    }
    
    public void setAttenuationEndDistance(float attenuationEndDistance) {
        Log.d(TAG, "Setting omni light attenuation end distance: " + attenuationEndDistance);
        mAttenuationEndDistance = Math.max(mAttenuationStartDistance + 0.1f, attenuationEndDistance);
        applyLightProperties();
    }
    
    // Light influence setters
    
    public void setInfluenceBitMask(int influenceBitMask) {
        Log.d(TAG, "Setting omni light influence bit mask: " + influenceBitMask);
        mInfluenceBitMask = influenceBitMask;
        applyLightProperties();
    }
    
    private void applyLightProperties() {
        if (mOmniLightJni != null) {
            Log.d(TAG, "Applying omni light properties to ViroReact OmniLight");
            
            // Apply color (convert Android Color to RGB components)
            float red = ((mColor >> 16) & 0xFF) / 255.0f;
            float green = ((mColor >> 8) & 0xFF) / 255.0f;
            float blue = (mColor & 0xFF) / 255.0f;
            
            // Set light color and intensity
            mOmniLightJni.setColor(red, green, blue);
            mOmniLightJni.setIntensity(mIntensity);
            mOmniLightJni.setTemperature(mTemperature);
            
            // Set attenuation properties
            mOmniLightJni.setAttenuationStartDistance(mAttenuationStartDistance);
            mOmniLightJni.setAttenuationEndDistance(mAttenuationEndDistance);
            
            // Set influence bit mask
            mOmniLightJni.setInfluenceBitMask(mInfluenceBitMask);
            
            Log.d(TAG, "OmniLight properties applied successfully");
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
        
        // Clean up ViroReact omni light resources
        if (mNodeJni != null) {
            if (mOmniLightJni != null) {
                mNodeJni.removeLight(mOmniLightJni);
            }
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mOmniLightJni != null) {
            mOmniLightJni.dispose();
            mOmniLightJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroOmniLightView attached to window");
        
        // Light will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mOmniLightJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact omni light ready for scene attachment");
        }
        
        // Ensure light properties are applied
        applyLightProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroOmniLightView detached from window");
        
        // Light cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}